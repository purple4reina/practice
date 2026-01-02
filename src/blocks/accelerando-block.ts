import { Block } from "./block";
import { ClickState } from "./clicks";
import { accelFunctions } from "./accel-functions";
import { toTitleCase } from "../utils";

export default class AccelerandoBlock extends Block {
  static readonly type = "accelerando";

  private kind;

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, {
      title: "Accelerando",
      col_1: (() => {
        let col = `
          <div class="container">
            <div class="row-col input-group">
              <select class="form-select" id="${this.id}-accel-kind">`;
        for (const k in accelFunctions) {
          col += `<option value="${k}">${toTitleCase(k)}</option>`;
        }
        col += `
              </select>
            </div>
          </div>`;
        return col;
      })(),
    });
    const kindSelect = document.getElementById(`${this.id}-accel-kind`) as HTMLSelectElement;
    kindSelect.value = opts.kind in accelFunctions ? opts.kind : "linear";
    this.kind = () => kindSelect.value;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.accel.start(this.kind());
  }

  queryString(): string {
    return `kind:${this.kind()}`;
  }
}
