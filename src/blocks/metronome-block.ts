import plusMinusControls from "../plus-minus-controls";
import { Block, ClickState } from "./block";

export default class MetronomeBlock extends Block {
  static readonly type = "metronome";

  private bpm;
  private recordSubdivisions;
  private playbackSubdivisions;

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row">
        <div class="col-3 text-left">
          <strong>Set Metronome</strong>
        </div>
        <div class="col-3">
          BPM:
        </div>
        <div class="col input-group">
          <button class="btn" id="${this.id}-bpm-minus" type="button" tabindex="-1">-</button>
          <input type="text" class="form-control" id="${this.id}-bpm-val" value="60" pattern="[0-9]*">
          <button class="btn" id="${this.id}-bpm-plus" type="button" tabindex="-1">+</button>
        </div>
      </div>
      <div class="row">
        <div class="col container">
          <div class="row block-element collapse show rec-metronome">
            <div class="col">
              Subdivisions:
            </div>
            <div class="col input-group">
              <button class="btn" id="${this.id}-rec-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-rec-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-rec-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
        <div class="col container">
          <div class="row block-element collapse show play-metronome">
            <div class="col">
              Subdivisions:
            </div>
            <div class="col input-group">
              <button class="btn" id="${this.id}-play-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-play-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-play-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.bpm = plusMinusControls(`${this.id}-bpm`, { initial: 60, min: 5, max: 512 });
    this.recordSubdivisions = plusMinusControls(`${this.id}-rec-subdivisions`, { initial: 1, min: 1, max: 64 });
    this.playbackSubdivisions = plusMinusControls(`${this.id}-play-subdivisions`, { initial: 1, min: 1, max: 64 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
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
}
