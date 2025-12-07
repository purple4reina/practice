import { Block, ClickState } from "./block";

export default class StopRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "stop";

  constructor(parent: HTMLElement) {
    super();
    const div = this.newBlockDiv(parent);
    div.innerHTML = `
      <div class="row g-0 p-0">
        <div class="col text-left">
          <strong>Stop Recording</strong>
        </div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
        <div class="col"><!-- empty column --></div>
      </div>
    `;
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = false;
  }
}
