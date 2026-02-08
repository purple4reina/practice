import { Block } from "./block";
import { ClickState } from "./clicks";

export default class StopRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "stop";

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, opts.index, {
      title: "Stop Recording",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.recording = false;
  }
}
