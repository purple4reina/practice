import { patternControls, plusMinusControls } from "../controls";
import { Block, ClickState, Click } from "./block";

export default class PatternBlock extends Block {
  static readonly type = "pattern";

  private beats;
  private start;
  private pattern;

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
        <div class="col">
          <div class="container">
            <div class="row-col">
              Starting Beat:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-start-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-start-val" value="4" pattern="[0-9]*">
              <button class="btn" id="${this.id}-start-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col align-items-center">
          <div class="row pattern-div" id="${this.id}-pattern"></div>
        </div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
    this.beats = plusMinusControls(`${this.id}-beats`, { initial: opts.beats || 4, min: 1, max: 16 });
    this.start = plusMinusControls(`${this.id}-start`, { initial: opts.start || 1, min: 1, max: 16 });
    const initPattern = (opts.pattern || '1,2,2,2').split(',').map((v: string) => parseInt(v));
    this.pattern = patternControls(`${this.id}-pattern`, { initial: initPattern });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.beatIndex = this.start() - 1;
    state.beatsPerMeasure = this.beats();
    state.beatPattern = this.pattern();
  }

  getOpts(): any {
    return {
      beats: this.beats(),
    };
  }

  queryString(): string {
    return `beats:${this.beats()} start:${this.start()} pattern:${this.pattern().join()}`;
  }
}
