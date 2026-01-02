import { Block } from "./block";
import { ClickState, Click } from "./clicks";
import { PatternControls, plusMinusControls } from "../controls";

export default class PatternBlock extends Block {
  static readonly type = "pattern";

  private beats;
  private start;
  private pattern;
  private recordSubdivisions;
  private playbackSubdivisions;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent, {
      title: "Set Beat Pattern",
      col_2: `
        <div class="container">
          <div class="row-col">
            Beat Pattern:
          </div>
          <div class="row-col input-group pattern-div" id="${this.id}-pattern">
            <div class="btn-group-vertical" role="group">
              <button class="btn" id="${this.id}-beats-minus" type="button" tabindex="-1">-</button>
              <button class="btn" id="${this.id}-start-minus" type="button" tabindex="-1">-</button>
            </div>
            <input type="text" class="form-control" id="${this.id}-beats-val" hidden>
            <input type="text" class="form-control" id="${this.id}-start-val" hidden>
            <div class="btn-group-vertical" role="group">
              <button class="btn" id="${this.id}-beats-plus" type="button" tabindex="-1">+</button>
              <button class="btn" id="${this.id}-start-plus" type="button" tabindex="-1">+</button>
            </div>
          </div>
        </div>`,
      col_3: `
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
        <div class="container">
          <div class="row-col input-group">
            <button class="btn" id="${this.id}-play-subdivisions-minus" type="button" tabindex="-1">-</button>
            <input type="text" class="form-control" id="${this.id}-play-subdivisions-val" value="1" pattern="[0-9]*">
            <button class="btn" id="${this.id}-play-subdivisions-plus" type="button" tabindex="-1">+</button>
          </div>
        </div>`,
    });
    this.beats = plusMinusControls(`${this.id}-beats`, { initial: opts.beats || 4, min: 1, max: 16 });
    this.start = plusMinusControls(`${this.id}-start`, { initial: opts.start || 1, min: 1, max: 16 });
    this.recordSubdivisions = plusMinusControls(`${this.id}-rec-subdivisions`, { initial: opts.recordSubdivisions || 1, min: 1, max: 64 });
    this.playbackSubdivisions = plusMinusControls(`${this.id}-play-subdivisions`, { initial: opts.playbackSubdivisions || 1, min: 1, max: 64 });

    const initPattern = (opts.pattern || '1,2,2,2').split(',').map((v: string) => parseInt(v));
    this.pattern = new PatternControls(`${this.id}-pattern`, {
      initial: initPattern,
      start: parseInt(opts.start || "1"),
    });

    div.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === `${this.id}-beats-val`) {
        this.pattern.setBeatCount(parseInt(target.value));
      }
      if (target.id === `${this.id}-start-val`) {
        this.pattern.setStartBeat(parseInt(target.value));
      }
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.beatIndex = this.start() - 1;
    state.beatsPerMeasure = this.beats();
    state.beatPattern = this.pattern.values();

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
      beats: this.beats(),
      start: this.start(),
      pattern: this.pattern.values().join(),
      recordSubdivisions: this.recordSubdivisions(),
      playbackSubdivisions: this.playbackSubdivisions(),
    };
  }

  queryString(): string {
    return [
      `beats:${this.beats()}`,
      `start:${this.start()}`,
      `pattern:${this.pattern.values().join()}`,
      `recordSubdivisions:${this.recordSubdivisions()}`,
      `playbackSubdivisions:${this.playbackSubdivisions()}`,
    ].join(" ");
  }
}
