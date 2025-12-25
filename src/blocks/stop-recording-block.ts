import { Block, ClickState } from "./block";

export default class StopRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "stop";

  constructor(parent: HTMLElement) {
    super();
    this.newBlockDiv(parent, {
      title: "Stop Recording",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = false;
  }
}
