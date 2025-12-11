import { Block, ClickState } from "./block";

export default class AccelerandoBlock extends Block {
  static readonly type = "accelerando";
  private kind;

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Accelerando</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col">
          <div class="container">
            <div class="row-col input-group">
              <select class="form-select" id="${this.id}-accel-kind">
                <option value="linear">Linear</option>
                <option value="percentage" disabled>Percentage</option>
              </select>
            </div>
          </div>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
    const kindSelect = document.getElementById(`${this.id}-accel-kind`) as HTMLSelectElement;
    this.kind = () => kindSelect.value;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.accel.start(this.kind());
  }
}
