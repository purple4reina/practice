import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];

  public recordSpeed: number;
  public recordingPrelay = 0.1;  // sec before first click
  public startRecordingDelay: number;
  public stopDelay: number;

  constructor(
    recordClicks: Click[],
    playClicks: Click[],
    recordSpeed: number,
  ) {
    this.recordClicks = recordClicks;
    this.playClicks = playClicks;
    this.recordSpeed = recordSpeed;

    const { startRecordingDelay, stopDelay } = this.getRecordDelays();
    this.startRecordingDelay = startRecordingDelay / this.recordSpeed;
    this.stopDelay = (stopDelay / this.recordSpeed) + (this.recordingPrelay * 2);
  }

  private getRecordDelays() {
    let startRecordingDelay = 0;
    let stopDelay = 0;
    let started = false;
    for (const click of this.recordClicks) {
      started = started || click.recording;
      stopDelay += click.delay;
      if (!click.recording && !started) {
        startRecordingDelay += click.delay;
      }
    }
    return { startRecordingDelay, stopDelay };
  }
}

export class Clip {
  public audioBuffer: AudioBuffer;
  public playClicks: Click[];
  public recordSpeed: number;

  constructor(settings: ClipSettings, audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    this.playClicks = settings.playClicks;
    this.recordSpeed = settings.recordSpeed;
  }
}
