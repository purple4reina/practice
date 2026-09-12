import { expect, describe, test, beforeEach, vi } from "vitest";
import { Block, IBlock } from "./block";
import { ClickState } from "./clicks";

class TestBlock extends Block {
  static readonly type = "test";

  constructor(parent: HTMLElement, opts: any = {}) {
    super();
    this.newBlockDiv(parent, opts.index ?? 0, {
      title: "Test",
      col_2: "middle content",
      gearMenu: opts.gearMenu,
    });
  }

  *clickIntervalGen(_phase: "record" | "play", _state: ClickState) {}
}

class NonRemovableBlock extends Block {
  static readonly type = "fixed";
  readonly removable = false;

  constructor(parent: HTMLElement, opts: any = {}) {
    super();
    this.newBlockDiv(parent, opts.index ?? 0, { title: "Fixed" });
  }

  *clickIntervalGen(_phase: "record" | "play", _state: ClickState) {}
}

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("Block DOM structure", () => {
  test("renders an envelope with type class, title, and column content", () => {
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;

    expect(envelope).not.toBeNull();
    expect(envelope.classList.contains("block-element")).toBe(true);
    expect(envelope.classList.contains("block-test")).toBe(true);
    expect(envelope.querySelector(".block-title")?.textContent).toBe("Test");
    expect(envelope.textContent).toContain("middle content");
  });

  test("inserts new blocks at the given index rather than always appending", () => {
    const first = new TestBlock(parent, { index: 0 });
    const second = new TestBlock(parent, { index: 0 }); // inserted before `first`

    expect(parent.children[0].id).toBe(second.id);
    expect(parent.children[1].id).toBe(first.id);
  });

  test("each block gets a distinct id", () => {
    const a = new TestBlock(parent);
    const b = new TestBlock(parent);
    expect(a.id).not.toBe(b.id);
  });

  test("removable blocks render move/trash controls; non-removable blocks don't", () => {
    const removable = new TestBlock(parent);
    const fixed = new NonRemovableBlock(parent);

    const removableEnvelope = document.getElementById(removable.id) as HTMLElement;
    const fixedEnvelope = document.getElementById(fixed.id) as HTMLElement;

    expect(removableEnvelope.querySelector(".bi-trash")).not.toBeNull();
    expect(removableEnvelope.querySelector(".bi-chevron-up")).not.toBeNull();
    expect(removableEnvelope.querySelector(".bi-chevron-down")).not.toBeNull();

    expect(fixedEnvelope.querySelector(".bi-trash")).toBeNull();
    expect(fixedEnvelope.querySelector(".bi-chevron-up")).toBeNull();
  });
});

describe("Block default getOpts/queryString", () => {
  test("default getOpts returns an empty object", () => {
    const block = new TestBlock(parent);
    expect(block.getOpts()).toEqual({});
  });

  test("default queryString returns an empty string", () => {
    const block = new TestBlock(parent);
    expect(block.queryString()).toBe("");
  });
});

describe("Block trash/move wiring", () => {
  test("clicking trash calls the injected remove() and detaches the envelope", () => {
    const block = new TestBlock(parent) as IBlock;
    const removeSpy = vi.fn();
    block.remove = removeSpy;

    const envelope = document.getElementById(block.id) as HTMLElement;
    (envelope.querySelector(".bi-trash") as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(removeSpy).toHaveBeenCalledWith(block);
    expect(document.getElementById(block.id)).toBeNull();
  });

  test("clicking moveUp calls the injected moveUp() and swaps the envelope earlier", async () => {
    const first = new TestBlock(parent) as IBlock;
    const second = new TestBlock(parent) as IBlock;
    const moveUpSpy = vi.fn().mockResolvedValue(undefined);
    second.moveUp = moveUpSpy;

    const secondEnvelope = document.getElementById(second.id) as HTMLElement;
    (secondEnvelope.querySelector(".bi-chevron-up") as HTMLElement)
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(moveUpSpy).toHaveBeenCalledWith(second);
    expect(parent.children[0].id).toBe(second.id);
    expect(parent.children[1].id).toBe(first.id);
  });
});

describe("Block.highlight", () => {
  test("adds a border-primary class and removes it after ~1s", () => {
    vi.useFakeTimers();
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;

    block.highlight();
    expect(envelope.classList.contains("border-primary")).toBe(true);

    vi.advanceTimersByTime(999);
    expect(envelope.classList.contains("border-primary")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(envelope.classList.contains("border-primary")).toBe(false);

    vi.useRealTimers();
  });

  test("calling highlight() again resets the removal timer", () => {
    vi.useFakeTimers();
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;

    block.highlight();
    vi.advanceTimersByTime(900);
    block.highlight(); // restart the 1s countdown
    vi.advanceTimersByTime(900);
    expect(envelope.classList.contains("border-primary")).toBe(true);

    vi.advanceTimersByTime(100);
    expect(envelope.classList.contains("border-primary")).toBe(false);

    vi.useRealTimers();
  });
});

describe("Block gear menu", () => {
  test("clicking the gear opens the modal via render() and toggles it closed on second click", () => {
    const render = vi.fn((body: HTMLElement) => { body.textContent = "menu contents"; });
    const block = new TestBlock(parent, { gearMenu: { title: "Options", render } });
    const envelope = document.getElementById(block.id) as HTMLElement;
    const gear = envelope.querySelector(".bi-gear") as HTMLElement;
    const modal = envelope.querySelector(".block-modal") as HTMLElement;

    expect(modal.hidden).toBe(true);

    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(render).toHaveBeenCalledTimes(1);
    expect(modal.hidden).toBe(false);
    expect(modal.textContent).toContain("menu contents");

    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(true);
  });

  test("clicking outside the modal closes it and calls onClose", () => {
    const render = vi.fn();
    const onClose = vi.fn();
    const block = new TestBlock(parent, { gearMenu: { title: "Options", render, onClose } });
    const envelope = document.getElementById(block.id) as HTMLElement;
    const gear = envelope.querySelector(".bi-gear") as HTMLElement;
    const modal = envelope.querySelector(".block-modal") as HTMLElement;

    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(false);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("pressing Escape closes an open modal", () => {
    const block = new TestBlock(parent, { gearMenu: { title: "Options", render: vi.fn() } });
    const envelope = document.getElementById(block.id) as HTMLElement;
    const gear = envelope.querySelector(".bi-gear") as HTMLElement;
    const modal = envelope.querySelector(".block-modal") as HTMLElement;

    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(modal.hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(modal.hidden).toBe(true);
  });

  test("blocks without a gearMenu option render no gear icon", () => {
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;
    expect(envelope.querySelector(".bi-gear")).toBeNull();
  });
});

describe("Block hover behavior and touch-mode", () => {
  test("in normal (non-touch) mode, hovering sets control colors from hover-color", () => {
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;
    const trash = envelope.querySelector(".bi-trash") as HTMLElement;

    envelope.dispatchEvent(new MouseEvent("mouseenter"));
    expect(trash.style.color).toBe(trash.getAttribute("hover-color"));

    envelope.dispatchEvent(new MouseEvent("mouseleave"));
    expect(trash.style.color).toBe("white");
  });

  test("in touch-mode, no mouseenter/mouseleave listeners are attached", () => {
    document.body.classList.add("touch-mode");
    const block = new TestBlock(parent);
    const envelope = document.getElementById(block.id) as HTMLElement;
    const trash = envelope.querySelector(".bi-trash") as HTMLElement;

    envelope.dispatchEvent(new MouseEvent("mouseenter"));
    expect(trash.style.color).toBe("");
  });
});
