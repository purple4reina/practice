import { accelFunctions } from "./accel-functions";
import { Block, ClickState } from "./block";

export default class AccelerandoBlock extends Block {
  static readonly type = "accelerando";

  private kind;

  constructor(parent: HTMLElement, opts: any) {
    super();
    const div = this.newBlockDiv(parent);
    let innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Accelerando</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col">
          <div class="container">
            <div class="row-col input-group">
              <select class="form-select" id="${this.id}-accel-kind">
    `;
    for (const k in accelFunctions) {
      const kTitle = k.charAt(0).toUpperCase() + k.substring(1).toLowerCase();
      innerHTML += `<option value="${k}">${kTitle}</option>`;
    }
    innerHTML += `
              </select>
            </div>
          </div>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
    div.innerHTML = innerHTML;
    const kindSelect = document.getElementById(`${this.id}-accel-kind`) as HTMLSelectElement;
    kindSelect.value = opts.kinds in accelFunctions ? opts.kind : "linear";
    this.kind = () => kindSelect.value;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.accel.start(this.kind());
  }

  queryString(): string {
    return `kind:${this.kind()}`;
  }
}
