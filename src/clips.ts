import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];
  public recordSpeed: number;

  constructor(
    recordClicks: Click[],
    playClicks: Click[],
    recordSpeed: number,
  ) {
    this.recordClicks = recordClicks;
    this.playClicks = playClicks;
    this.recordSpeed = recordSpeed;
  }
}

export class Clip {
}
