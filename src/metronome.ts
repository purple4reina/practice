import { Click } from "./blocks/clicks";
import { ClipSettings, Clip } from "./clips";
import {
  boolSwitchControls,
  plusMinusControls,
  slideControls,
} from "./controls";

interface ClickSound {
  hz: number,
  vol: number,
}

abstract class Metronome {
  private audioContext: AudioContext;

  private clickHz: number = 1000;
  private offbeatHz: number = 750;
  private clickSounds: { [key: number]: ClickSound } = {
    1: { hz: 1000, vol: 2 },
    2: { hz: 900, vol: 2 },
    3: { hz: 800, vol: 1 },
    4: { hz: 700, vol: 1 },
    0: { hz: 0, vol: 0 },
  };

  private oscillatorType: OscillatorType = "square";
  private flashBox = document.getElementById("click-flash-box") as HTMLElement;

  private isPlaying: boolean = false;
  private nextClickTime: number = 0;
  private clickIter: Iterator<Click> | null = null;
  private playbackRate: number = 1;
  private pitchMultiplier: number = 1;
  private activeMidiNodes: { masterGain: GainNode, oscillators: OscillatorNode[] }[] = [];

  private scheduleLookahead: number = 25.0; // Look ahead 25ms
  private scheduleInterval: number = 25.0; // Schedule every 25ms

  public enabled;
  protected clickSilencing = () => 0;
  protected flash = () => false;

  constructor(prefix: string, audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.enabled = boolSwitchControls(`${prefix}-metronome-enabled`, { initial: true });
  }

  private createClickSound(when: number, click: Click) {
    if (this.enabled()) {
      // Show flash even if volume all the way down or click is silenced
      if (this.flash()) {
        const delay = when - this.audioContext.currentTime;
        setTimeout(() => this.flashBox.hidden = false, delay);
        setTimeout(() => this.flashBox.hidden = true, delay + 50);
      }

      // Random click silencing — skips both the click sound and MIDI for this beat
      if (click.recording && Math.random() * 100 < this.clickSilencing()) {
        return;
      }

      const clickSound = this.clickSounds[click.level];
      if (clickSound.vol > 0) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = this.oscillatorType;
        oscillator.frequency.setValueAtTime(clickSound.hz, when);

        // Create a sharp click envelope
        gainNode.gain.setValueAtTime(0, when);
        gainNode.gain.linearRampToValueAtTime(clickSound.vol, when + 0.001);
        gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(when);
        oscillator.stop(when + 0.05);
      }
    }

    // Schedule any MIDI notes attached to this click — independent of metronome enabled
    if (click.midiNotes) {
      for (const note of click.midiNotes) {
        const noteWhen = when + note.offsetMs / this.playbackRate / 1000;
        const noteDuration = note.durationMs / this.playbackRate / 1000;
        this.createMidiNoteSound(noteWhen, note.frequency * this.pitchMultiplier, noteDuration);
      }
    }
  }

  // Same overtone series as the drone for a consistent timbre
  private midiOvertones = [
    { ratio: 1,  volume: 0.45  },
    { ratio: 2,  volume: 0.25  },
    { ratio: 3,  volume: 0.05  },
    { ratio: 4,  volume: 0.10  },
    { ratio: 5,  volume: 0.04  },
    { ratio: 6,  volume: 0.03  },
    { ratio: 8,  volume: 0.02  },
    { ratio: 16, volume: 0.005 },
  ];

  private createMidiNoteSound(when: number, frequency: number, durationSec: number): void {
    const minDuration = 0.02;
    const duration = Math.max(durationSec, minDuration);

    const attackTime = Math.min(0.005, duration * 0.1);
    const releaseTime = Math.min(0.08, duration * 0.25);

    // Master gain carries the amplitude envelope; individual oscillator gains
    // set the overtone mix (matching the drone's volume of 0.25).
    const masterGain = this.audioContext.createGain();
    masterGain.gain.setValueAtTime(0, when);
    masterGain.gain.linearRampToValueAtTime(0.25, when + attackTime);
    masterGain.gain.setValueAtTime(0.25, when + duration - releaseTime);
    masterGain.gain.linearRampToValueAtTime(0, when + duration);
    masterGain.connect(this.audioContext.destination);

    const oscillators: OscillatorNode[] = [];
    for (const { ratio, volume } of this.midiOvertones) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * ratio, when);
      gainNode.gain.value = volume;

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      oscillator.start(when);
      oscillator.stop(when + duration + 0.01);
      oscillators.push(oscillator);
    }

    // Track this note so stop() can cancel it if needed
    const nodeSet = { masterGain, oscillators };
    this.activeMidiNodes.push(nodeSet);

    // Auto-remove from tracking list once the note has naturally finished
    const cleanupDelay = Math.max((when - this.audioContext.currentTime + duration + 0.1) * 1000, 0);
    setTimeout(() => {
      const idx = this.activeMidiNodes.indexOf(nodeSet);
      if (idx !== -1) this.activeMidiNodes.splice(idx, 1);
    }, cleanupDelay);
  }

  private scheduler = (): void => {
    if (!this.clickIter) return;
    while (this.nextClickTime < this.audioContext.currentTime + (this.scheduleLookahead / 1000)) {
      const { value, done } = this.clickIter.next();
      if (done) return;
      this.createClickSound(this.nextClickTime, value);
      this.nextClickTime += (value.delay / this.playbackRate / 1000);
    }

    if (this.isPlaying) {
      setTimeout(this.scheduler, this.scheduleInterval);
    }
  };

  _start(startTime: number, clicks: Click[], playbackRate: number, pitchMultiplier: number = 1) {
    if (this.isPlaying) {
      this.stop();
    }

    this.nextClickTime = startTime;
    this.clickIter = clicks[Symbol.iterator]();
    this.playbackRate = playbackRate;
    this.pitchMultiplier = pitchMultiplier;
    this.isPlaying = true;
    this.scheduler();
  }

  stop(): void {
    this.isPlaying = false;
    const now = this.audioContext.currentTime;
    for (const { masterGain, oscillators } of this.activeMidiNodes) {
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(0, now);
      for (const osc of oscillators) {
        try { osc.stop(now); } catch (_) {}
      }
    }
    this.activeMidiNodes = [];
  }
}

export class RecordingMetronome extends Metronome {
  protected flash = boolSwitchControls("rec-click-flash", { initial: false });
  protected clickSilencing = slideControls("rec-silencing", {
    initial: 0,
    min: 0,
    max: 100,
    step: 1,
    valueSuffix: "%",
    label: "Random Click Silencing",
  });

  constructor(audioContext: AudioContext) {
    super("rec", audioContext);
  }

  start(startTime: number, clipSettings: ClipSettings) {
    super._start(
      startTime + clipSettings.recordingPrelay / 1000,  // in seconds
      clipSettings.recordClicks,
      clipSettings.recordSpeed,
    );
  }
}

export class PlaybackMetronome extends Metronome {
  constructor(audioContext: AudioContext) {
    super("play", audioContext);
  }

  start(audioStartTime: number, clip: Clip, playbackRate: number) {
    const startTime = audioStartTime + clip.latency / playbackRate / 1000;
    super._start(startTime, clip.playClicks.filter(c => c.recording), playbackRate * clip.recordSpeed, playbackRate);
  }
}
