import { randomId } from "../utils";

class ClickStateAccel {
  enabled: boolean = false;
  kind: string | undefined;
  clicks: Click[] = [];

  reset() {
    this.enabled = false;
    this.kind = undefined;
    this.clicks = [];
  }

  start(kind: string) {
    this.reset();
    this.enabled = true;
    this.kind = kind;
  }
}

export class ClickState {
  phase: string;
  bpm: number = 0;
  beatsPerMeasure: number = 1;
  subdivisions: number = 1;
  beatIndex: number = 1;
  beatPattern: number[] = [1];
  recording: boolean = false;
  accel = new ClickStateAccel();

  constructor(phase: "record" | "play") {
    this.phase = phase;
  }

  getLevel(): number {
    let level = this.beatPattern[this.beatIndex % this.beatsPerMeasure];
    if (this.phase == "play" && level === 0) {
      level = this.beatIndex === 0 ? 1 : 2;
    }
    return level;
  }
}

export interface Click {
  delay: number,
  level: number,
  recording: boolean,
}

export interface IBlock {
  readonly id: string;
  readonly removable: boolean;
  remove(block: IBlock): void;
  moveUp(block: IBlock): void;
  moveDown(block: IBlock): void;
  clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;
  highlight(): void;
  getOpts(): any;
  queryString(): string;
}

export abstract class Block implements IBlock {
  readonly id: string;
  readonly removable: boolean = true;
  static readonly type: string = "";

  public remove: (block: IBlock) => void;
  public moveUp: (block: IBlock) => void;
  public moveDown: (block: IBlock) => void;
  public highlight = () => {};

  abstract clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;

  protected constructor() {
    this.id = randomId(6);
    this.remove = this.moveUp = this.moveDown = function(block: IBlock): void {};
  }

  protected newBlockDiv(parent: HTMLElement): HTMLElement {
    const type = (<typeof Block> this.constructor).type;

    const envelope = document.createElement("div");
    parent.appendChild(envelope);
    envelope.classList.add("container");
    envelope.classList.add("row");
    envelope.classList.add("block-element");
    envelope.setAttribute("id", this.id);
    let highlightTimeout = 0;
    this.highlight = () => {
      clearTimeout(highlightTimeout);
      const colorCls = "border-primary";
      envelope.classList.add(colorCls);
      highlightTimeout = setTimeout(() => { envelope.classList.remove(colorCls) }, 1000);
    };

    // left controls
    const leftControls = document.createElement("div");
    envelope.appendChild(leftControls);
    leftControls.classList.add("col-1");
    leftControls.classList.add("left-controls");
    leftControls.style.paddingLeft = "5px";

    if (this.removable) {
      const moveUp = document.createElement("i");
      leftControls.appendChild(moveUp);
      moveUp.classList.add("bi");
      moveUp.classList.add("bi-chevron-up");
      moveUp.classList.add("bi-tiny");
      moveUp.classList.add("block-control");
      moveUp.style.display = "inline-block";
      moveUp.setAttribute("hover-color", "cornflowerblue");
      moveUp.addEventListener("click", async () => {
        await this.moveUp(this);
        const prev = envelope.previousSibling;
        if (prev) {
          parent.insertBefore(envelope, prev);
        }
      });

      const moveDown = document.createElement("i");
      leftControls.appendChild(moveDown);
      moveDown.classList.add("bi");
      moveDown.classList.add("bi-chevron-down");
      moveDown.classList.add("bi-tiny");
      moveDown.classList.add("block-control");
      moveDown.style.display = "inline-block";
      moveDown.setAttribute("hover-color", "cornflowerblue");
      moveDown.addEventListener("click", async () => {
        await this.moveDown(this);
        const next = envelope.nextSibling;
        if (next) {
          parent.insertBefore(next, envelope);
        }
      });
    }

    // block
    const block = document.createElement("div");
    envelope.appendChild(block);
    block.classList.add("col");

    const blockBody = document.createElement("div");
    block.appendChild(blockBody);
    blockBody.classList.add("row");
    blockBody.classList.add("block-body");
    blockBody.classList.add(type);

    // right controls
    const rightControls = document.createElement("div");
    envelope.appendChild(rightControls);
    rightControls.classList.add("col-1");
    rightControls.classList.add("right-controls");

    if (this.removable) {
      const trash = document.createElement("i");
      rightControls.appendChild(trash);
      trash.classList.add("bi");
      trash.classList.add("bi-trash");
      trash.classList.add("bi-tiny");
      trash.classList.add("block-control");
      trash.style.display = "inline-block";
      trash.setAttribute("hover-color", "red");
      trash.addEventListener("click", () => {
        if (this.removable) {
          this.remove(this);
          envelope.remove();
        }
      });
    }

    // hovers
    const overables = envelope.getElementsByClassName("block-control");
    envelope.addEventListener("mouseenter", () => {
      [...overables].forEach(e => {
        (e as HTMLElement).style.color = (e as HTMLElement).getAttribute("hover-color") || "";
      });
    });
    envelope.addEventListener("mouseleave", () => {
      [...overables].forEach(e => (e as HTMLElement).style.color = "white");
    });

    return block;
  }

  getOpts(): any {
    return {};
  }

  queryString(): string {
    return '';
  }
}
