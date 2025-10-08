export class ClickState {
  bpm: number = 0;
  subdivisions: number = 0;
  recording: boolean = false;
}

export interface Click {
  delay: number,
  strong: boolean,
  recording: boolean,
}

export interface IBlock {
  readonly id: string;
  clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;
}

export abstract class Block implements IBlock {
  readonly id: string;
  abstract clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;

  protected constructor() {
    this.id = Math.random().toString(36).substr(2, 6);
  }
}
