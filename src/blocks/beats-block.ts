import plusMinusControls from "../plus-minus-controls";
import { Block, ClickState, Click } from "./block";

export default class ClicksBlock extends Block {
  static readonly type = "beats";

  private count;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Beats</strong>
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
              <button class="btn" id="${this.id}-beats-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-beats-val" value="0" pattern="[0-9]*">
              <button class="btn" id="${this.id}-beats-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.count = plusMinusControls(`${this.id}-beats`, { initial: opts.count || 0, min: 0, max: 256 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    const addClick = function* (delay: number, strong: boolean, recording: boolean) {
      const click = { delay, strong, recording };
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
      yield* addClick(delay, true, recording);
      for (let j = 0; j < subdivisions - 1; j++) {
        yield* addClick(delay, false, recording);
      }
    }
  }
}
