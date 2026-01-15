import { Block } from "./block";
import { ClickState } from "./clicks";

export default class StartRecordingBlock extends Block {
  readonly removable: boolean = false;
  static readonly type = "start";

  constructor(parent: HTMLElement) {
    super();
    this.newBlockDiv(parent, {
      title: "Start",
    });
  }

  *clickIntervalGen(phase: "record" | "play", state: ClickState) {
    state.started = true;
  }
}
