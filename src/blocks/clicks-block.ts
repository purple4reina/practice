import plusMinusControls from "../plus-minus-controls";
import { Block, ClickState, Click } from "./block";

export default class ClicksBlock extends Block {
  static readonly type = "clicks";

  private count;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row">
        <div class="col-3 text-left">
          <strong>Clicks</strong>
        </div>
        <div class="col-3">
          Count:
        </div>
        <div class="col input-group">
          <button class="btn" id="${this.id}-clicks-minus" type="button" tabindex="-1">-</button>
          <input type="text" class="form-control" id="${this.id}-clicks-val" value="0" pattern="[0-9]*">
          <button class="btn" id="${this.id}-clicks-plus" type="button" tabindex="-1">+</button>
        </div>
      </div>
    `;
    this.count = plusMinusControls(`${this.id}-clicks`, {
      initial: opts.initial || 0,
      min: opts.min || 0,
      max: opts.max || 256,
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    let { bpm, subdivisions, recording } = state;
    const delay = 60 / bpm / subdivisions * 1000;
    for (let i = 0; i < this.count(); i++) {
      yield { delay, strong: true, recording };
      for (let j = 0; j < subdivisions - 1; j++) {
        yield { delay, strong: false, recording };
      }
    }
  }
}
