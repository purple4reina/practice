import { plusMinusControls } from "../controls";
import { Block, ClickState, Click } from "./block";

export default class PatternBlock extends Block {
  static readonly type = "pattern";

  private beats;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Set Beat Pattern</strong>
        </div>
        <div class="col">
          <div class="container">
            <div class="row-col">
              Beats per Measure:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-beats-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-beats-val" value="4" pattern="[0-9]*">
              <button class="btn" id="${this.id}-beats-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
    this.beats = plusMinusControls(`${this.id}-beats`, { initial: opts.beats || 4, min: 1, max: 16 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
  }

  getOpts(): any {
    return {
      beats: this.beats(),
    };
  }

  queryString(): string {
    return `beats:${this.beats()}`;
  }
}
