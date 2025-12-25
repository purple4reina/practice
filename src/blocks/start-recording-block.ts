import { Block, ClickState } from "./block";

export default class StartRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "record";

  constructor(parent: HTMLElement) {
    super();
    this.newBlockDiv(parent, {
      title: "Start Recording",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = true;
  }
}
