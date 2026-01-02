class ClickStateAccel {
  enabled: boolean = false;
  kind: string | undefined;
  clicks: Click[] = [];

  reset() {
    this.enabled = false;
    this.kind = undefined;
    this.clicks = [];
  }

  start(kind: string) {
    this.reset();
    this.enabled = true;
    this.kind = kind;
  }
}

export class ClickState {
  phase: string;
  bpm: number = 0;
  beatsPerMeasure: number = 1;
  subdivisions: number = 1;
  beatIndex: number = 1;
  beatPattern: number[] = [1];
  recording: boolean = false;
  accel = new ClickStateAccel();

  constructor(phase: "record" | "play") {
    this.phase = phase;
  }

  getLevel(): number {
    let level = this.beatPattern[this.beatIndex % this.beatsPerMeasure];
    if (this.phase == "play" && level === 0) {
      level = (this.beatIndex % this.beatsPerMeasure) === 0 ? 1 : 2;
    }
    return level;
  }
}

export interface Click {
  delay: number,
  level: number,
  recording: boolean,
}

export class ClickGen {
  private index = 0;
  private clicks = [] as Click[];

  protected lastClick = { delay: 0, level: 0, recording: false };

  push(click: Click) {
    this.clicks.push(click);
  }

  next(): { click: Click, done: boolean } {
    const done = this.index >= this.clicks.length;
    let click = this.lastClick;
    if (done) {
      click = this.clicks[this.index];
      this.index++;
    }
    return { click, done }
  }

  [Symbol.iterator](): Iterator<Click> {
    return {
      next(): IteratorResult<Click> {
        return this.next();
      }
    };
  }

  clone(): ClickGen {
    const clickGen = new ClickGen();
    clickGen.clicks = this.clicks.slice();
    return clickGen;
  }

  reset() {
    this.index = 0;
  }
}
