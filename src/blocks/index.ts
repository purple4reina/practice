import ClicksBlock from "./clicks-block";
import MetronomeBlock from "./metronome-block";
import RecordBlock from "./record-block";
import { IBlock, ClickState } from "./block";

export default class BlockManager {
  private blocks: IBlock[] = [];

  private addButton = document.getElementById("add-block") as HTMLElement;
  private blockDiv = document.getElementById("blocks") as HTMLElement;

  constructor() {
    this.newBlock("metronome");
    this.newBlock("clicks", { initial: 4 });
    this.newBlock("record");
    this.newBlock("metronome");
    this.newBlock("clicks", { initial: 16 });

    this.addButton.addEventListener("click", (e: Event) => {
      const value = (e.target as HTMLButtonElement).value;
      this.newBlock(value);
    });
  }

  newBlock(type: string, opts={}): IBlock {
    let block: IBlock;
    switch (type) {
      case MetronomeBlock.type:
        block = new MetronomeBlock(this.blockDiv);
        break;
      case ClicksBlock.type:
        block = new ClicksBlock(this.blockDiv, opts);
        break;
      case RecordBlock.type:
        block = new RecordBlock(this.blockDiv);
        break;
      default:
        throw new Error(`Unknown type "${type}"`);
    }
    block.remove = this.removeBlock.bind(this);
    block.moveUp = this.moveBlockUp.bind(this);
    block.moveDown = this.moveBlockDown.bind(this);
    this.blocks.push(block);
    return block;
  }

  removeBlock(block: IBlock) {
    if (block.removable) {
      const index = this.blocks.indexOf(block);
      if (index > -1) {
        this.blocks.splice(index, 1);
      }
    }
  }

  moveBlockUp(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > 0) {
      this.blocks.splice(index, 1);
      this.blocks.splice(index - 1, 0, block);
    }
  }

  moveBlockDown(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > 0) {
      this.blocks.splice(index, 1);
      this.blocks.splice(index + 1, 0, block);
    }
  }

  *clickIntervalGen(phase: "record" | "play") {
    const state = new ClickState();
    for (const block of this.blocks) {
      for (const click of block.clickIntervalGen(phase, state)) {
        if (phase == "record" || state.recording) {
          yield click;
        }
      }
    }
  }

  recordingDelay(): number {
    let delay = 0;
    const state = new ClickState();
    for (const block of this.blocks) {
      if (block instanceof RecordBlock) break;
      let clickGen = block.clickIntervalGen("record", state);
      while (true) {
        const { value, done } = clickGen.next();
        if (done) break;
        delay += value.delay;
      }
    }
    return delay;
  }
}
