import { Block, ClickState } from "./block";

export default class StartRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "record";

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0 align-items-center">
        <div class="col text-left">
          <strong>Start Recording</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = true;
  }
}
