import { Block } from "./block";
import { Click, ClickState } from "./clicks";
import { accelFunctions } from "./accel-functions";
import { plusMinusControls } from "../controls";

export default class MetronomeBlock extends Block {
  static readonly type = "metronome";

  private bpm;
  private bpmLabel;
  private recSpeed;

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, {
      title: "Set Metronome",
      col_1: `
        <div class="container">
          <div class="row-col" id="${this.id}-bpm-label">
            BPM:
          </div>
          <div class="row-col input-group">
            <button class="btn" id="${this.id}-bpm-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-bpm-val" value="60" pattern="[0-9]*">
            <button class="btn" id="${this.id}-bpm-plus" type="button" tabindex="-1">+</button>
          </div>
        </div>`,
    });
    this.bpm = plusMinusControls(`${this.id}-bpm`, { initial: opts.bpm || 60, min: 5, max: 512 });

    this.bpmLabel = document.getElementById(`${this.id}-bpm-label`) as HTMLElement;
    this.recSpeed = document.getElementById("rec-speed") as HTMLInputElement;
    this.recSpeed.addEventListener("input", e => { this.updateBpmLabel() });
    document.getElementById(`${this.id}-bpm-val`)?.addEventListener("input", e => { this.updateBpmLabel() });
  }

  private updateBpmLabel() {
    const bpm = this.bpm();
    const percent = parseInt(this.recSpeed.value);
    const value = Math.round(bpm * percent / 100);
    this.bpmLabel.innerText = (value === bpm) ? `BPM:` : `BPM (${value}):`;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    if (state.accel.enabled) {
      const timeFn = accelFunctions[state.accel.kind as keyof typeof accelFunctions];
      if (!timeFn) {
        throw new Error(`${state.accel.kind} accelerando kind not found`);
      }

      const totalClicks = state.accel.clicks.length;
      const finalTempo = this.bpm() / 60 / 1000 * state.subdivisions;  // clicks per ms
      const initialTempo = state.bpm / 60 / 1000 * state.subdivisions;  // clicks per ms

      let prevTime = 0;
      for (let thisClick = 1; thisClick <= totalClicks; thisClick++) {
        const click = state.accel.clicks.shift() as Click;
        const thisTime = timeFn({ thisClick, totalClicks, initialTempo, finalTempo });
        if (thisTime) {
          click.delay = thisTime - prevTime;
          prevTime = thisTime;
        }
        yield click;
      }
    }

    state.accel.reset();
    state.bpm = this.bpm();
  }

  getOpts(): any {
    return {
      bpm: this.bpm(),
    };
  }

  queryString(): string {
    return `bpm:${this.bpm()}`;
  }
}
