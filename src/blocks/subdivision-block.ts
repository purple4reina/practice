import { Block } from "./block";
import { ClickState, Click } from "./clicks";
import { plusMinusControls } from "../controls";

export default class SubdivisionBlock extends Block {
  static readonly type = "subdivision";

  private recordSubdivisions;
  private playbackSubdivisions;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent, {
      title: "Set Subdivision",
      col_3: `
        <div class="container">
          <div class="row">
            <div class="col-6 hanging-left">
              Recording:
            </div>
            <div class="col input-group">
              <button class="btn" id="${this.id}-rec-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-rec-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-rec-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
          <div class="row">
            <div class="col-6 hanging-left">
              Playback:
            </div>
            <div class="col input-group">
              <button class="btn" id="${this.id}-play-subdivisions-minus" type="button" tabindex="-1">-</button>
              <input type="text" class="form-control" id="${this.id}-play-subdivisions-val" value="1" pattern="[0-9]*">
              <button class="btn" id="${this.id}-play-subdivisions-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>`,
    });
    this.recordSubdivisions = plusMinusControls(`${this.id}-rec-subdivisions`, { initial: opts.recordSubdivisions || 1, min: 1, max: 64 });
    this.playbackSubdivisions = plusMinusControls(`${this.id}-play-subdivisions`, { initial: opts.playbackSubdivisions || 1, min: 1, max: 64 });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
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
      recordSubdivisions: this.recordSubdivisions(),
      playbackSubdivisions: this.playbackSubdivisions(),
    };
  }

  queryString(): string {
    return [
      `recordSubdivisions:${this.recordSubdivisions()}`,
      `playbackSubdivisions:${this.playbackSubdivisions()}`,
    ].join(" ");
  }
}
