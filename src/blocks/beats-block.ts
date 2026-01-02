import { Block } from "./block";
import { Click, ClickState } from "./clicks";
import { plusMinusControls } from "../controls";

export default class BeatsBlock extends Block {
  static readonly type = "beats";

  private count;

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, {
      title: "Beats",
      col_4: `
        <div class="container">
          <div class="row-col">
            Beats:
          </div>
          <div class="row-col input-group">
            <button class="btn" id="${this.id}-beats-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-beats-val" value="0" pattern="[0-9]*">
            <button class="btn" id="${this.id}-beats-plus" type="button" tabindex="-1">+</button>
          </div>`,
    });
    this.count = plusMinusControls(`${this.id}-beats`, { initial: opts.count || 0, min: 0, max: 256 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    const addClick = function* (click: Click) {
      if (state.accel.enabled) {
        state.accel.clicks.push(click);
      } else {
        yield click;
      }
    }

    let { bpm, subdivisions, recording } = state;
    if (bpm === 0 || subdivisions === 0) return;

    const delay = 60 / bpm / subdivisions * 1000;
    for (let i = 0; i < this.count(); i++) {
      const level = state.getLevel();
      yield* addClick({ delay, level: level, recording });
      for (let j = 0; j < subdivisions - 1; j++) {
        yield* addClick({ delay, level: 4, recording });
      }
      state.beatIndex++;
    }
  }

  getOpts(): any {
    return { count: this.count() };
  }

  queryString(): string {
    return `count:${this.count()}`;
  }
}
