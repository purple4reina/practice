import AccelerandoBlock from "./accelerando-block";
import BeatsBlock from "./beats-block";
import MetronomeBlock from "./metronome-block";
import RecordBlock from "./record-block";
import { Block, IBlock, ClickState } from "./block";

export default class BlockManager {
  private blocks: IBlock[] = [];
  private initialized = false;

  private addButton = document.getElementById("add-block") as HTMLElement;
  private blockDiv = document.getElementById("blocks") as HTMLElement;

  private blockTypes = [
    AccelerandoBlock.type,
    BeatsBlock.type,
    MetronomeBlock.type,
    RecordBlock.type,
  ];

  constructor() {
    // query param listeners
    const callback = this.updateQueryParams.bind(this);
    new MutationObserver(mutationList => {
      callback();
      for (const mutation of mutationList) {
        mutation.addedNodes.forEach(node => {
          if ((node as HTMLElement).classList?.contains("block-element")) {
            node.addEventListener("input", callback);
          }
        });
      }
    }).observe(this.blockDiv, { childList: true, subtree: true });

    if (window.location.search) {
      for (const [key, value] of new URLSearchParams(window.location.search)) {
        const opts: { [key: string]: string } = {};
        for (let val of decodeURIComponent(value).split(' ')) {
          const [k, v] = val.split(':');
          opts[k] = v;
        }
        this.newBlock(key, opts);
      }
    } else {
      this.newBlock("metronome");
      this.newBlock("beats", { count: 4 });
      this.newBlock("record");
      this.newBlock("metronome");
      this.newBlock("beats", { count: 16 });
    }

    // add button
    this.addButton.addEventListener("click", (e: Event) => {
      const value = (e.target as HTMLButtonElement).value;
      this.newBlock(value);
    });

    this.initialized = true;
  }

  newBlock(type: string, opts={}) {
    let block: IBlock;
    switch (type) {
      case AccelerandoBlock.type:
        block = new AccelerandoBlock(this.blockDiv);
        break;
      case BeatsBlock.type:
        block = new BeatsBlock(this.blockDiv, opts);
        break;
      case MetronomeBlock.type:
        block = new MetronomeBlock(this.blockDiv, opts);
        break;
      case RecordBlock.type:
        block = new RecordBlock(this.blockDiv);
        break;
      default:
        return;
    }
    if (this.initialized) {
      block.highlight();
    }
    block.remove = this.removeBlock.bind(this);
    block.moveUp = this.moveBlockUp.bind(this);
    block.moveDown = this.moveBlockDown.bind(this);
    this.blocks.push(block);
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
      block.highlight();
      this.blocks.splice(index, 1);
      this.blocks.splice(index - 1, 0, block);
    }
  }

  moveBlockDown(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      block.highlight();
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

  getRecordDelays() {
    let recordingDelay = 0;
    let stopDelay = 0;
    for (const click of this.clickIntervalGen("record")) {
      stopDelay += click.delay;
      if (!click.recording) {
        recordingDelay += click.delay;
      }
    }
    return { recordingDelay, stopDelay };
  }

  private updateQueryParams() {
    const url = new URL(window.location.origin + window.location.pathname);
    [...this.blocks].forEach(block => {
      const type = (<typeof Block> block.constructor).type;
      const params = encodeURIComponent(block.queryString());
      url.searchParams.append(type, params);
    });
    for (const [key, value] of new URLSearchParams(window.location.search)) {
      if (!this.blockTypes.includes(key)) {
        url.searchParams.append(key, value);
      }
    }
    window.history.pushState(null, '', url.toString());
  }
}
