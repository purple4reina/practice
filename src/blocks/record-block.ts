import { Block, ClickState } from "./block";

export default class RecordBlock extends Block {
  constructor(parent: HTMLElement) {
    super();
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="row block-element" id="${this.id}">
        <div class="row">
          <div class="col-3 text-left">
            <strong>Start Recording</strong>
          </div>
        </div>
      </div>
    `;
    parent.appendChild(div);
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    // noop
  }
}
