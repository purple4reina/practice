import { Block } from "./block";
import { ClickState } from "./clicks";

export default class StartRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "record";

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, opts.index, {
      title: "Start Recording",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.started = true;
    state.recording = true;
  }
}
