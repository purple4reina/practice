import boolSwitchControls from "./bool-switch-controls";
import plusMinusControls from "./plus-minus-controls";

export default class Metronome {
  private audioContext: AudioContext;

  private clickHz: number = 1000;
  private offbeatHz: number = 750;
  private oscillatorType: OscillatorType = "square";

  private nextClickTime: number = 0;
  private nextClickSubdivision: number = 0;

  private isPlaying: boolean = false;
  private tempo: number = 60;
  private scheduleLookahead: number = 25.0; // Look ahead 25ms
  private scheduleInterval: number = 25.0; // Schedule every 25ms
  private countOffAllowance: number = 100; // Allow 100ms before the first click

  public enabled = boolSwitchControls("click-enabled");
  public bpm = plusMinusControls("bpm", { initial: 60, min: 15, max: 300 });
  public latency = plusMinusControls("latency", { initial: -75, min: -500, max: 500 });
  public countOff = plusMinusControls("count-off", { initial: 0, min: 0, max: 8 });
  private volume = plusMinusControls("click-volume", { initial: 1.0, min: 0, max: 10 });
  private subdivisions = plusMinusControls("subdivisions", { initial: 1, min: 1, max: 16 });

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  getPlaybackStartTime(audioStartTime: number, playbackRate: number = 1.0): number {
    const scaledCompensation = this.latency() / playbackRate;
    let startTime = audioStartTime - (scaledCompensation / 1000);
    if (this.countOff() > 0) {
      startTime += (this.countOffAllowance / playbackRate / 1000);
    }
    return startTime;
  }

  countOffMs(): number {
    if (!this.enabled() || this.countOff() <= 0) {
      return 0;
    }
    // Calculate the count-off duration in milliseconds
    // Minus 100ms to ensure recording starts before the first click
    return this.countOff() / this.bpm() * 60 * 1000 - this.countOffAllowance;
  }

  private click(oscillator: OscillatorNode, gainNode: GainNode, hz: number, when: number): void {
  }

  private createClickSound(when: number, clickHz: number): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = this.oscillatorType;
    oscillator.frequency.setValueAtTime(clickHz, when);

    // Create a sharp click envelope
    gainNode.gain.setValueAtTime(0, when);
    gainNode.gain.linearRampToValueAtTime(this.volume(), when + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.05);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(when);
    oscillator.stop(when + 0.05);
  }

  private scheduler = (): void => {
    // Schedule clicks that fall within our lookahead window
    while (this.nextClickTime < this.audioContext.currentTime + (this.scheduleLookahead / 1000)) {
      const clickHz = this.nextClickSubdivision % this.subdivisions() === 0 ? this.clickHz : this.offbeatHz;
      this.createClickSound(this.nextClickTime, clickHz);
      this.nextClickTime += this.tempo;
      this.nextClickSubdivision++;
    }

    if (this.isPlaying) {
      setTimeout(this.scheduler, this.scheduleInterval);
    }
  };

  start(startTime: number = this.audioContext.currentTime, playbackRate: number): void {
    const delay = this.isPlaying ? this.tempo : 0;
    if (this.isPlaying) {
      this.stop();
    }

    this.tempo = 60 / (this.bpm() * this.subdivisions() * playbackRate);
    setTimeout(() => {
      this.isPlaying = true;
      this.nextClickTime = startTime;
      this.nextClickSubdivision = 0;
      this.scheduler();
    }, delay);
  }

  stop(): void {
    this.isPlaying = false;
  }
}
