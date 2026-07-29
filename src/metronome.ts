import { Click } from "./blocks/clicks";
import { ClipSettings, Clip } from "./clips";
import {
  boolSwitchControls,
  plusMinusControls,
  slideControls,
} from "./controls";
import { Synth } from "./synth";

interface ClickSound {
  hz: number,
  vol: number,
}

abstract class Metronome {
  private audioContext: AudioContext;
  private synth: Synth;

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
    this.synth = new Synth(audioContext);
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
        this.synth.scheduleClick(when, clickSound.hz, clickSound.vol, this.oscillatorType);
      }
    }

    // Schedule any MIDI notes attached to this click — independent of metronome enabled
    if (click.midiNotes) {
      for (const note of click.midiNotes) {
        const noteWhen = when + note.offsetMs / this.playbackRate / 1000;
        const noteDuration = note.durationMs / this.playbackRate / 1000;
        this.scheduleMidiNote(noteWhen, note.frequency * this.pitchMultiplier, noteDuration);
      }
    }
  }

  private scheduleMidiNote(when: number, frequency: number, durationSec: number): void {
    const nodeSet = this.synth.scheduleNote(when, frequency, durationSec);

    // Track this note so stop() can cancel it if needed
    this.activeMidiNodes.push(nodeSet);

    // Auto-remove from tracking list once the note has naturally finished
    const duration = Math.max(durationSec, 0.02);
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

  start(audioStartTime: number, clip: Clip, playbackRate: number, offsetMs: number = 0) {
    const startTime = audioStartTime + (clip.latency - offsetMs) / playbackRate / 1000;
    super._start(startTime, clip.playClicks.filter(c => c.recording), playbackRate * clip.recordSpeed, playbackRate);
  }
}
