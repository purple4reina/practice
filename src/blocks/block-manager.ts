import ClicksBlock from "./clicks-block";
import MetronomeBlock from "./metronome-block";
import RecordBlock from "./record-block";
import { IBlock } from "./block";

export default class BlockManager {
  private blocks: IBlock[] = [];

  private addButton = document.getElementById("add-block") as HTMLElement;
  private blockDiv = document.getElementById("blocks") as HTMLElement;

  constructor() {
    this.newBlock("metronome");
    this.newBlock("clicks");
    this.newBlock("record");
    this.newBlock("clicks");

    this.addButton.addEventListener("click", (e: Event) => {
      const value = (e.target as HTMLButtonElement).value;
      this.newBlock(value);
    });
  }

  newBlock(type: string): IBlock {
    let block: IBlock;
    switch (type) {
      case "metronome":
        block = new MetronomeBlock(this.blockDiv);
        break;
      case "clicks":
        block = new ClicksBlock(this.blockDiv);
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
}
