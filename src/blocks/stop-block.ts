import { Block } from "./block";
import { ClickState } from "./clicks";

export default class StopRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "done";

  constructor(parent: HTMLElement, opts: any) {
    super();
    this.newBlockDiv(parent, opts.index, {
      title: "Stop",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.started = false;
  }
}
