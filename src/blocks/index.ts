import AccelerandoBlock from "./accelerando-block";
import BeatsBlock from "./beats-block";
import DurationBlock from "./duration-block";
import MeasuresBlock from "./measures-block";
import MetronomeBlock from "./metronome-block";
import PatternBlock from "./pattern-block";
import StartRecordingBlock from "./start-recording-block";
import StopRecordingBlock from "./stop-recording-block";
import { Block, IBlock } from "./block";
import { ClickState, Click } from "./clicks";
import { sleep } from "../utils";

export default class BlockManager {
  private blocks: IBlock[] = [];
  private initialized = false;

  private addButton = document.getElementById("add-block") as HTMLElement;
  private blockDiv = document.getElementById("blocks") as HTMLElement;

  private blockTypes = [
    AccelerandoBlock.type,
    BeatsBlock.type,
    DurationBlock.type,
    MeasuresBlock.type,
    MetronomeBlock.type,
    PatternBlock.type,
    StartRecordingBlock.type,
    StopRecordingBlock.type,
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

    const params = new URLSearchParams(window.location.search);
    if (params.has("record")) {
      for (const [key, value] of params) {
        const opts: { [key: string]: string } = {};
        for (let val of decodeURIComponent(value).split(' ')) {
          const [k, v] = val.split(':');
          if (v !== undefined) {
            opts[k] = v;
          }
        }
        if (this.blockTypes.includes(key)) {
          this.newBlock(key, opts);
        }
      }
    } else {
      this.newBlock("metronome");
      this.newBlock("beats", { count: 4 });
      this.newBlock("record");
      this.newBlock("metronome");
      this.newBlock("beats", { count: 16 });
      this.newBlock("stop");
    }

    // add button
    this.addButton.addEventListener("click", (e: Event) => {
      const value = (e.target as HTMLButtonElement).value;
      this.newBlock(value);
    });

    this.initialized = true;
  }

  newBlock(type: string, opts={}) {
    opts = Object.keys(opts).length ? opts : this.getLastBlockOpts(type);
    let block: IBlock;
    switch (type) {
      case AccelerandoBlock.type:
        block = new AccelerandoBlock(this.blockDiv, opts);
        break;
      case BeatsBlock.type:
        block = new BeatsBlock(this.blockDiv, opts);
        break;
      case DurationBlock.type:
        block = new DurationBlock(this.blockDiv, opts);
        break;
      case MeasuresBlock.type:
        block = new MeasuresBlock(this.blockDiv, opts);
        break;
      case MetronomeBlock.type:
        block = new MetronomeBlock(this.blockDiv, opts);
        break;
      case PatternBlock.type:
        block = new PatternBlock(this.blockDiv, opts);
        break;
      case StartRecordingBlock.type:
        block = new StartRecordingBlock(this.blockDiv);
        break;
      case StopRecordingBlock.type:
        block = new StopRecordingBlock(this.blockDiv);
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

  private getLastBlockOpts(type: string): any {
    return this.blocks.reduceRight((opts, block) => {
      if (opts) return opts;
      const btype = (<typeof Block> block.constructor).type;
      if (type == btype) return block.getOpts();
    }, null) || {};
  }

  removeBlock(block: IBlock) {
    if (block.removable) {
      const index = this.blocks.indexOf(block);
      if (index > -1) {
        this.blocks.splice(index, 1);
      }
    }
  }

  async moveBlockUp(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > 0) {
      block.highlight();
      await sleep(100);
      this.blocks.splice(index, 1);
      this.blocks.splice(index - 1, 0, block);
    }
  }

  async moveBlockDown(block: IBlock) {
    const index = this.blocks.indexOf(block);
    if (index > -1) {
      block.highlight();
      await sleep(100);
      this.blocks.splice(index, 1);
      this.blocks.splice(index + 1, 0, block);
    }
  }

  public recordClickGen(): Click[] {
    return Array.from(this.clickIntervalGen("record"));
  }

  public playClickGen(): Click[] {
    return Array.from(this.clickIntervalGen("play"));
  }

  private *clickIntervalGen(phase: "record" | "play") {
    const state = new ClickState(phase);
    for (const block of this.blocks) {
      for (const click of block.clickIntervalGen(phase, state)) {
        if (phase == "record" || state.recording) {
          yield click;
        }
      }
    }
    // yield one final click
    yield { delay: 350, level: state.getLevel(), recording: state.recording };
  }

  getRecordDelays() {
    let startRecordingDelay = 0;
    let stopDelay = 0;
    let started = false;
    for (const click of this.clickIntervalGen("record")) {
      started = started || click.recording;
      stopDelay += click.delay;
      if (!click.recording && !started) {
        startRecordingDelay += click.delay;
      }
    }
    return { startRecordingDelay, stopDelay };
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
