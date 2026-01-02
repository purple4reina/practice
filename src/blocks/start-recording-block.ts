import { Block } from "./block";
import { ClickState } from "./clicks";

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
