export interface ClickState {
  bpm: number,
  subdivisions: number,
}

export interface Click {
  delay: number,
  strong: boolean,
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
