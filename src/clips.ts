import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];
  public recordSpeed: number;
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
    this.startRecordingDelay = startRecordingDelay;
    this.stopDelay = stopDelay;
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
}
