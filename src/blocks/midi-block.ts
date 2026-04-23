import { Block } from "./block";
import { ClickState } from "./clicks";
import { parseLilypond, MidiSequencer } from "../midi";

const TIME_SIGNATURES = [
  { label: "2/2", bottom: 2 },
  { label: "4/4", bottom: 4 },
  { label: "6/8", bottom: 8 },
];

export default class MidiBlock extends Block {
  static readonly type = "midi";

  private timeSig: () => number;
  private notation: () => string;
  private recEnable: () => boolean;
  private playEnable: () => boolean;

  constructor(parent: HTMLElement, opts: any) {
    super();

    const initBottom = parseInt(opts.timeSig) || 4;
    const initNotation = (opts.notation || "").replace(/\+/g, ' ');
    const initRecEnable = opts.recEnable !== "false";
    const initPlayEnable = opts.playEnable === "true";

    this.newBlockDiv(parent, opts.index, {
      title: "Midi",
      col_1: `
        <div class="container">
          <div class="row-col input-group">
            <select class="form-select form-select" id="${this.id}-timesig">
              ${TIME_SIGNATURES.map(ts =>
                `<option value="${ts.bottom}"${ts.bottom === initBottom ? ' selected' : ''}>${ts.label}</option>`
              ).join('')}
            </select>
          </div>
        </div>`,
      col_2: `
        <div class="container">
          <div class="col input-group">
            <input type="text" class="form-control text-left" id="${this.id}-notation" value="${initNotation}">
          </div>
        </div>`,
        col_4: `
          <div class="container">
            <div class="row">
              <div class="col-6 hanging-left">
                Recording:
              </div>
              <div class="col">
                <div class="form-check form-switch d-flex justify-content-center">
                  <input class="form-check-input" type="checkbox" id="${this.id}-rec-enable"${initRecEnable ? ' checked' : ''}>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col-6 hanging-left">
                Playback:
              </div>
              <div class="col">
                <div class="form-check form-switch d-flex justify-content-center">
                  <input class="form-check-input" type="checkbox" id="${this.id}-play-enable"${initPlayEnable ? ' checked' : ''}>
                </div>
              </div>
            </div>
          </div>`,
    });

    const timeSigSelect = document.getElementById(`${this.id}-timesig`) as HTMLSelectElement;
    const notationInput = document.getElementById(`${this.id}-notation`) as HTMLTextAreaElement;
    const recEnableCheckbox = document.getElementById(`${this.id}-rec-enable`) as HTMLInputElement;
    const playEnableCheckbox = document.getElementById(`${this.id}-play-enable`) as HTMLInputElement;

    this.timeSig = () => parseInt(timeSigSelect.value, 10);
    this.notation = () => notationInput.value;
    this.recEnable = () => recEnableCheckbox.checked;
    this.playEnable = () => playEnableCheckbox.checked;

    const validate = () => {
      const text = notationInput.value.trim();
      if (text === '') {
        notationInput.classList.remove('is-invalid');
        return;
      }
      const result = parseLilypond(text, this.timeSig());
      if (result === null) {
        notationInput.classList.add('is-invalid');
      } else {
        notationInput.classList.remove('is-invalid');
      }
    };

    timeSigSelect.addEventListener('change', validate);
    notationInput.addEventListener('blur', validate);
    notationInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        validate();
      } else if (e.key === ' ') {
        // Prevent space from starting/stopping record/play
        e.stopPropagation();
      }
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    const enabled = phase === 'record' ? this.recEnable() : this.playEnable();
    if (!enabled) return;

    const notes = parseLilypond(this.notation(), this.timeSig());
    if (notes === null || notes.length === 0) return;

    state.midiSequencers.push(new MidiSequencer(notes));
  }

  getOpts(): any {
    return {
      timeSig: this.timeSig(),
      notation: this.notation(),
      recEnable: this.recEnable(),
      playEnable: this.playEnable(),
    };
  }

  queryString(): string {
    return [
      `timeSig:${this.timeSig()}`,
      `notation:${this.notation().replace(/ /g, '+')}`,
      `recEnable:${this.recEnable()}`,
      `playEnable:${this.playEnable()}`,
    ].join(' ');
  }
}
