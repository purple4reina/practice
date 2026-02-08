import { Click, ClickState } from "./clicks";
import { randomId } from "../utils";

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

  protected newBlockDiv(parent: HTMLElement, index: number, opts: any): HTMLElement {
    const type = (<typeof Block> this.constructor).type;

    const envelope = document.createElement("div");
    if (index >= parent.children.length) {
      parent.appendChild(envelope);
    } else {
      parent.insertBefore(envelope, parent.children[index]);
    }

    envelope.classList.add("container");
    envelope.classList.add("row");
    envelope.classList.add("block-element");
    envelope.classList.add(`block-${type}`);
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

    const blockDiv = document.createElement("div");
    block.appendChild(blockDiv);
    blockDiv.classList.add("row");
    blockDiv.classList.add("g-0");
    blockDiv.classList.add("p-0");
    blockDiv.classList.add("align-items-center");

    const title = document.createElement("div");
    blockDiv.appendChild(title);
    title.classList.add("col-1");
    title.classList.add("block-title");
    title.innerHTML = `<strong>${opts.title}</strong>`;

    for (let i = 1; i <=4; i++) {
      const col = document.createElement("div");
      blockDiv.appendChild(col);
      if (i === 2) {
        col.classList.add("col");
      } else {
        col.classList.add("col-2");
      }
      col.innerHTML = opts[`col_${i}` as keyof typeof opts] || "";
    }

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
