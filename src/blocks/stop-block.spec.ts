import { expect, describe, test, beforeEach } from "vitest";
import StopBlock from "./stop-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("StopBlock", () => {
  test("is not removable and has type 'done'", () => {
    const block = new StopBlock(parent, { index: 0 });
    expect(block.removable).toBe(false);
    expect(StopBlock.type).toBe("done");
  });

  test("marks the click state as no longer started", () => {
    const block = new StopBlock(parent, { index: 0 });
    const state = new ClickState("record");
    state.started = true;

    [...block.clickIntervalGen("record", state)];
    expect(state.started).toBe(false);
  });
});
