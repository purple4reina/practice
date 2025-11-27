import { plusMinusControls } from "../controls";
import { Block, ClickState, Click } from "./block";

export default class MeasuresBlock extends Block {
  static readonly type = "measures";

  private count;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Measures</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col">
          <div class="container">
            <div class="row-col">
              Count:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-measures-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-measures-val" value="0" pattern="[0-9]*">
              <button class="btn" id="${this.id}-measures-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
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

    let { bpm, subdivisions, recording } = state;
    if (bpm === 0 || subdivisions === 0) return;

    const delay = 60 / bpm / subdivisions * 1000;
    for (let i = 0; i < this.count(); i++) {
      for (let j = 0; j < state.beatsPerMeasure; j++) {
        const level = (state.beatIndex % state.beatsPerMeasure) === 0 ? 1 : 2;
        yield* addClick({ delay, level: level, recording });
        for (let k = 0; k < subdivisions - 1; k++) {
          yield* addClick({ delay, level: 4, recording });
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
