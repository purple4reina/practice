import { Click } from "./blocks/clicks";
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
  private clickGen: Generator<Click> | null = null;
  private playbackRate: number = 1;

  private scheduleLookahead: number = 25.0; // Look ahead 25ms
  private scheduleInterval: number = 25.0; // Schedule every 25ms
  protected countOffAllowance: number = 100; // Allow 100ms before the first click

  public enabled;
  protected clickSilencing = () => 0;
  protected flash = () => false;

  constructor(prefix: string, audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.enabled = boolSwitchControls(`${prefix}-metronome-enabled`, { initial: true });
  }

  private createClickSound(when: number, click: Click) { //clickHz: number, gain: number): void {
    // show flash even if volume all the way down or click is silenced
    if (this.flash()) {
      const delay = when - this.audioContext.currentTime;
      setTimeout(() => this.flashBox.hidden = false, delay);
      setTimeout(() => this.flashBox.hidden = true, delay + 50);
    }

    // click silencing
    if (click.recording && Math.random() * 100 < this.clickSilencing()) {
      return;
    }

    const clickSound = this.clickSounds[click.level];
    if (clickSound.vol === 0) {
      return;
    }

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

  private scheduler = (): void => {
    if (!this.clickGen) return;
    while (this.nextClickTime < this.audioContext.currentTime + (this.scheduleLookahead / 1000)) {
      const { value, done } = this.clickGen.next();
      if (done) return;
      this.createClickSound(this.nextClickTime, value);
      this.nextClickTime += (value.delay / this.playbackRate / 1000);
    }

    if (this.isPlaying) {
      setTimeout(this.scheduler, this.scheduleInterval);
    }
  };

  start(startTime: number, clickGen: Generator<Click>, playbackRate: number, withCountOff: boolean): void {
    if (!this.enabled()) {
      return;
    }

    if (this.isPlaying) {
      this.stop();
    }

    this.nextClickTime = startTime;
    this.clickGen = clickGen;
    this.playbackRate = playbackRate;
    this.isPlaying = true;
    this.scheduler();
  }

  stop(): void {
    this.isPlaying = false;
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
}

export class PlaybackMetronome extends Metronome {
  private latency = plusMinusControls("play-latency", { initial: -75, min: -500, max: 500 });

  getPlaybackStartTime(audioStartTime: number, playbackRate: number = 1.0): number {
    const scaledCompensation = this.latency() / playbackRate;
    let startTime = audioStartTime - (scaledCompensation / 1000);
    // TODO: only add this if there are count offs
    startTime += (this.countOffAllowance / playbackRate / 1000);
    return startTime;
  }

  constructor(audioContext: AudioContext) {
    super("play", audioContext);
  }
}
