export class ClickState {
  bpm: number = 0;
  subdivisions: number = 0;
  recording: boolean = false;
}

export interface Click {
  delay: number,
  strong: boolean,
  recording: boolean,
}

export interface IBlock {
  readonly id: string;
  clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;
}

export abstract class Block implements IBlock {
  readonly id: string;
  static readonly type: string = "";
  abstract clickIntervalGen(phase: "record" | "play", state: ClickState): Generator<Click>;

  protected constructor() {
    this.id = Math.random().toString(36).substr(2, 6);
  }

  protected newBlockDiv(parent: HTMLElement): HTMLElement {
    const type = (<typeof Block> this.constructor).type;

    const envelope = document.createElement("div");
    parent.appendChild(envelope);
    envelope.classList.add("container");
    envelope.classList.add("row");
    envelope.classList.add("block-element");

    // left controls
    const leftControls = document.createElement("div");
    envelope.appendChild(leftControls);
    leftControls.classList.add("col-1");
    leftControls.classList.add("left-controls");

    // block
    const block = document.createElement("div");
    envelope.appendChild(block);
    block.classList.add("col");

    const blockBody = document.createElement("div");
    block.appendChild(blockBody);
    blockBody.classList.add("row");
    blockBody.classList.add("block-body");
    blockBody.classList.add(type);
    blockBody.setAttribute("id", this.id);

    // right controls
    const rightControls = document.createElement("div");
    envelope.appendChild(rightControls);
    rightControls.classList.add("col-1");
    rightControls.classList.add("right-controls");

    const trash = document.createElement("i");
    rightControls.appendChild(trash);
    trash.classList.add("bi");
    trash.classList.add("bi-trash");
    trash.classList.add("bi-tiny");
    trash.classList.add("block-control");
    trash.style.display = "inline-block";

    // hovers
    const overables = envelope.getElementsByClassName("block-control");
    envelope.addEventListener("mouseenter", () => {
      [...overables].forEach(e => (e as HTMLElement).style.color = "red");
    });
    envelope.addEventListener("mouseleave", () => {
      [...overables].forEach(e => (e as HTMLElement).style.color = "white");
    });

    return block;
  }
}
