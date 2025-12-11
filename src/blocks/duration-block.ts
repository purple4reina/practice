import { plusMinusControls } from "../controls";
import { Block, ClickState, Click } from "./block";

export default class DurationBlock extends Block {
  static readonly type = "duration";

  private seconds;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Duration</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col">
          <div class="container">
            <div class="row-col">
              Seconds:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-duration-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-duration-val" value="0" pattern="[0-9]*">
              <button class="btn" id="${this.id}-duration-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.seconds = plusMinusControls(`${this.id}-duration`, { initial: opts.seconds || 0, min: 0, max: 60 * 10 });  // max 10m
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    let { bpm, subdivisions, recording } = state;
    if (bpm > 0 && subdivisions > 0) {
      const addClick = function* (click: Click) {
        if (state.accel.enabled) {
          state.accel.clicks.push(click);
        } else {
          yield click;
        }
      }

      // TODO: if there is an accel in place, this is wrong, must take accel
      // into account when calculating number of beats.
      const beats = this.seconds() / 60 * state.bpm;
      const delay = 60 / bpm / subdivisions * 1000;
      for (let i = 0; i < beats; i++) {
        const level = state.getLevel();
        yield* addClick({ delay, level: level, recording });
        for (let j = 0; j < subdivisions - 1; j++) {
          yield* addClick({ delay, level: 4, recording });
        }
        state.beatIndex++;
      }

    } else {
      yield {
        delay: this.seconds() * 1000,
        level: 0,
        recording,
      };
    }
  }

  getOpts(): any {
    return { seconds: this.seconds() };
  }

  queryString(): string {
    return `seconds:${this.seconds()}`;
  }
}
