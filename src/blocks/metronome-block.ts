import { plusMinusControls } from "../controls";
import { Block, ClickState, Click } from "./block";

export default class MetronomeBlock extends Block {
  static readonly type = "metronome";

  private bpm;
  private recordSubdivisions;
  private playbackSubdivisions;
  private bpmLabel;
  private recSpeed;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Set Metronome</strong>
        </div>
        <div class="col">
          <div class="container">
            <div class="row-col" id="${this.id}-bpm-label">
              BPM:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-bpm-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-bpm-val" value="60" pattern="[0-9]*">
              <button class="btn" id="${this.id}-bpm-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="container">
            <div class="row-col">
              Subdivisions:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-rec-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-rec-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-rec-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="container">
            <div class="row-col">
              Subdivisions:
            </div>
            <div class="row-col input-group">
              <button class="btn" id="${this.id}-play-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-play-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-play-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
    this.bpm = plusMinusControls(`${this.id}-bpm`, { initial: opts.bpm || 60, min: 5, max: 512 });
    this.recordSubdivisions = plusMinusControls(`${this.id}-rec-subdivisions`, { initial: opts.recordSubdivisions || 1, min: 1, max: 64 });
    this.playbackSubdivisions = plusMinusControls(`${this.id}-play-subdivisions`, { initial: opts.playbackSubdivisions || 1, min: 1, max: 64 });

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
      const timeFn = timeFunctions[state.accel.kind as keyof typeof timeFunctions];
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
        click.delay = thisTime - prevTime;
        prevTime = thisTime;
        yield click;
      }
    }

    state.accel.reset();
    state.bpm = this.bpm();
    switch (phase) {
      case "record":
        state.subdivisions = this.recordSubdivisions();
        break;
      case "play":
        state.subdivisions = this.playbackSubdivisions();
        break;
      default:
        throw new Error(`Unknown phase type "${phase}"`);
    }
  }

  getOpts(): any {
    return {
      bpm: this.bpm(),
      recordSubdivisions: this.recordSubdivisions(),
      playbackSubdivisions: this.playbackSubdivisions(),
    };
  }

  queryString(): string {
    return `bpm:${this.bpm()} recordSubdivisions:${this.recordSubdivisions()} playbackSubdivisions:${this.playbackSubdivisions()}`;
  }
}

type timeFunctionOpts = {thisClick: number, totalClicks: number, initialTempo: number, finalTempo: number};
type timeFunction = (opts: timeFunctionOpts) => number;

function linearTimeFn(opts: timeFunctionOpts): number {
  const totalTime = opts.totalClicks / (opts.initialTempo + (opts.finalTempo - opts.initialTempo) / 2)
  const A = (opts.finalTempo - opts.initialTempo) / 2 / totalTime;
  const B = opts.initialTempo;
  const C = -opts.thisClick;
  return (-B + Math.sqrt(B**2 - 4*A*C)) / (2*A);
}

const timeFunctions = {
  linear: linearTimeFn,
};
