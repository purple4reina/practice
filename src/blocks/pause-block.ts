import { Block } from "./block";
import { Click, ClickState } from "./clicks";
import { plusMinusControls } from "../controls";

export default class PauseBlock extends Block {
  static readonly type = "pause";

  private pause;

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, opts.index, {
      title: "Pause",
      col_4: `
        <div class="container">
          <div class="row-col">
            Milliseconds:
          </div>
          <div class="row-col input-group">
            <button class="btn" id="${this.id}-pause-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-pause-val" value="0" pattern="[0-9]*">
            <button class="btn" id="${this.id}-pause-plus" type="button" tabindex="-1">+</button>
          </div>
        </div>`,
    });
    this.pause = plusMinusControls(`${this.id}-pause`, { initial: opts.pause || 0, min: 0, max: 60 * 1000 });  // max 1m
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    yield {
      delay: this.pause(),
      level: 0,
      started: state.started,
      recording: state.recording,
    };
  }

  getOpts(): any {
    return { pause: this.pause() };
  }

  queryString(): string {
    return `pause:${this.pause()}`;
  }
}
