import { plusMinusControls } from "../controls";
import { Block, ClickState } from "./block";

export default class MetronomeBlock extends Block {
  static readonly type = "metronome";

  private bpm;
  private recordSubdivisions;
  private playbackSubdivisions;

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
            <div class="row-col">
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
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    const bpm = this.bpm();

    if (state.accel.enabled) {
      const coef = (60 / bpm - 60 / state.bpm) / state.accel.clicks.length * 1000;
      for (let i = 0; i < state.accel.clicks.length; i++) {
        const click = state.accel.clicks[i];
        click.delay += coef * (i + 1);
        yield click;
      }
    }

    state.accel.reset();
    state.bpm = bpm;
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

  queryString(): string {
    return `bpm:${this.bpm()} recordSubdivisions:${this.recordSubdivisions()} playbackSubdivisions:${this.playbackSubdivisions()}`;
  }
}
