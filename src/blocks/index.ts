import ClicksBlock from "./clicks-block";
import MetronomeBlock from "./metronome-block";
import RecordBlock from "./record-block";
import { IBlock, ClickState } from "./block";

export default class BlockManager {
  private blocks: IBlock[] = [];

  private addButton = document.getElementById("add-block") as HTMLElement;
  private blockDiv = document.getElementById("blocks") as HTMLElement;

  private recordingPrelay = 100; // ms

  constructor() {
    this.newBlock("metronome");
    this.newBlock("record");
    this.newBlock("clicks", { initial: 16 });

    this.addButton.addEventListener("click", (e: Event) => {
      const value = (e.target as HTMLButtonElement).value;
      this.newBlock(value);
    });
  }

  newBlock(type: string, opts={}): IBlock {
    let block: IBlock;
    switch (type) {
      case "metronome":
        block = new MetronomeBlock(this.blockDiv);
        break;
      case "clicks":
        block = new ClicksBlock(this.blockDiv, opts);
        break;
      case "record":
        block = new RecordBlock(this.blockDiv);
        break;
      default:
        throw new Error(`Unknown type "${type}"`);
    }
    this.blocks.push(block);
    return block;
  }

  removeBlock(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      this.blocks.splice(index, 1);
    }
  }

  *clickIntervalGen(phase: "record" | "play") {
    const state = new ClickState();
    for (const block of this.blocks) {
      yield* block.clickIntervalGen(phase, state);
    }
  }

  recordingDelay(): number {
    let delay = this.recordingPrelay;  // TODO: fix recording delay calculations
    const state = new ClickState();
    for (const block of this.blocks) {
      if (block instanceof RecordBlock) break;
      let clickGen = block.clickIntervalGen("record", state);
      let done = false;
      while (!done) {
        const { value, done } = clickGen.next();
        delay += value.delay;
      }
    }
    return delay;
  }
}
