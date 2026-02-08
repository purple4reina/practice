import { Block } from "./block";
import { Click, ClickState } from "./clicks";
import { plusMinusControls } from "../controls";

export default class MeasuresBlock extends Block {
  static readonly type = "measures";

  private count;

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, opts.index, {
      title: "Measures",
      col_4: `
        <div class="container">
          <div class="row-col">
            Measures:
          </div>
          <div class="row-col input-group">
            <button class="btn" id="${this.id}-measures-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-measures-val" value="0" pattern="[0-9]*">
            <button class="btn" id="${this.id}-measures-plus" type="button" tabindex="-1">+</button>
          </div>
        </div>`,
    });
    this.count = plusMinusControls(`${this.id}-measures`, { initial: opts.count || 0, min: 0, max: 256 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    const addClick = function* (click: Click) {
      if (state.accel.enabled) {
        state.accel.clicks.push(click);
      } else {
        yield click;
      }
    }

    let { bpm, subdivisions, started, recording } = state;
    if (bpm === 0 || subdivisions === 0) return;

    const delay = 60 / bpm / subdivisions * 1000;
    for (let i = 0; i < this.count(); i++) {
      for (let j = 0; j < state.beatsPerMeasure; j++) {
        const level = state.getLevel();
        yield* addClick({ delay, level: level, started, recording });
        for (let k = 0; k < subdivisions - 1; k++) {
          yield* addClick({ delay, level: 4, started, recording });
        }
        state.beatIndex++;
      }
    }
  }

  getOpts(): any {
    return { count: this.count() };
  }

  queryString(): string {
    return `count:${this.count()}`;
  }
}
