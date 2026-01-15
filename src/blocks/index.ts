import AccelerandoBlock from "./accelerando-block";
import BeatsBlock from "./beats-block";
import DurationBlock from "./duration-block";
import MeasuresBlock from "./measures-block";
import MetronomeBlock from "./metronome-block";
import PatternBlock from "./pattern-block";
import QueryParams from "../query-params";
import StartBlock from "./start-block";
import StartRecordingBlock from "./start-recording-block";
import StopBlock from "./stop-block";
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
    StartBlock.type,
    StartRecordingBlock.type,
    StopBlock.type,
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

    if (QueryParams.has("record")) {
      const blockConfigs: [string, { [key: string]: string }][] = [];
      for (const [key, value] of QueryParams.getAll()) {
        if (!this.blockTypes.includes(key)) continue;
        const opts: { [key: string]: string } = {};
        for (let val of decodeURIComponent(value).split(' ')) {
          const [k, v] = val.split(':');
          if (v !== undefined) {
            opts[k] = v;
          }
        }
        blockConfigs.push([key, opts]);
      }
      if (!blockConfigs.some(([key, _]) => key == "start")) {
        this.newBlock("start");
      }
      if (!blockConfigs.some(([key, _]) => key == "record")) {
        this.newBlock("record");
      }
      for (const [key, opts] of blockConfigs) {
        this.newBlock(key, opts);
      }
      if (!blockConfigs.some(([key, _]) => key == "stop")) {
        this.newBlock("stop");
      }
      if (!blockConfigs.some(([key, _]) => key == "done")) {
        this.newBlock("done");
      }
    } else {
      this.newBlock("start");
      this.newBlock("metronome");
      this.newBlock("pattern");
      this.newBlock("beats", { count: 4 });
      this.newBlock("record");
      this.newBlock("beats", { count: 16 });
      this.newBlock("stop");
      this.newBlock("done");
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
      case StartBlock.type:
        block = new StartBlock(this.blockDiv);
        break;
      case StartRecordingBlock.type:
        block = new StartRecordingBlock(this.blockDiv);
        break;
      case StopBlock.type:
        block = new StopBlock(this.blockDiv);
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

  public recordClicks(): Click[] {
    return this.clickIntervalGen("record");
  }

  public playClicks(): Click[] {
    return this.clickIntervalGen("play");
  }

  private clickIntervalGen(phase: "record" | "play"): Click[] {
    const clicks: Click[] = [];
    const state = new ClickState(phase);
    let lastRecording = false;
    for (const block of this.blocks) {
      for (const click of block.clickIntervalGen(phase, state)) {
        if (!click.started) continue;
        if (phase == "record" || click.recording) {
          clicks.push(click);
          lastRecording = click.recording;
        }
      }
    }
    clicks.push({ delay: 350, level: state.getLevel(), started: true, recording: lastRecording });
    return clicks;
  }

  private updateQueryParams() {
    const params = new URLSearchParams();
    [...this.blocks].forEach(block => {
      const type = (<typeof Block> block.constructor).type;
      const param = encodeURIComponent(block.queryString());
      params.append(type, param);
    });
    for (const [key, value] of QueryParams.getAll()) {
      if (!this.blockTypes.includes(key)) {
        params.append(key, value);
      }
    }
    QueryParams.replace(params);
  }
}
