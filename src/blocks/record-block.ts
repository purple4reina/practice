import { Block, ClickState } from "./block";

export default class RecordBlock extends Block {
  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv();
    div.innerHTML = `
      <div class="row">
        <div class="col-3 text-left">
          <strong>Start Recording</strong>
        </div>
      </div>
    `;
    parent.appendChild(div);
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = true;
  }
}
