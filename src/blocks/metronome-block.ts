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
      const subs = state.subdivisions;
      const numStrongBeats = state.accel.clicks.length / subs;

      const oldDur = 60 / state.bpm * 1000;
      const newDur = 60 / this.bpm() * 1000;
      const durDiff = (newDur - oldDur) / (numStrongBeats + 1);

      let beatDur = oldDur;
      for (let beat = 0; beat < numStrongBeats; beat++) {
        let subDur = beatDur / subs;

        beatDur += durDiff;
        const subDiff = 2 * (beatDur - subs * subDur) / subs / (subs + 1);

        for (let sub = 0; sub < subs; sub++) {
          subDur += subDiff;
          const click = state.accel.clicks.shift() as Click;
          click.delay = subDur;
          yield click;
        }
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
