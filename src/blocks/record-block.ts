import { Block, ClickState } from "./block";

export default class RecordBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "record";

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row">
        <div class="col-3 text-left">
          <strong>Start Recording</strong>
        </div>
      </div>
    `;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = true;
  }
}
