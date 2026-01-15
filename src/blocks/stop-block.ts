import { Block } from "./block";
import { ClickState } from "./clicks";

export default class StopRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "done";

  constructor(parent: HTMLElement) {
    super();
    this.newBlockDiv(parent, {
      title: "Stop",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.started = false;
  }
}
