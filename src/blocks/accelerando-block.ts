import { Block, ClickState } from "./block";

export default class AccelerandoBlock extends Block {
  static readonly type = "accelerando";

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Accelerando</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
  }
}
