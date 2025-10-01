export interface IBlock {
  readonly id: string;
  start(): void;
  stop(): void;
}

export abstract class Block implements IBlock {
  readonly id: string;

  protected constructor() {
    this.id = Math.random().toString(36).substr(2, 6);
  }

  start(): void {}

  stop(): void {}
}
