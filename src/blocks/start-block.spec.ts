import { expect, describe, test, beforeEach } from "vitest";
import StartBlock from "./start-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("StartBlock", () => {
  test("is not removable and has type 'start'", () => {
    const block = new StartBlock(parent, { index: 0 });
    expect(block.removable).toBe(false);
    expect(StartBlock.type).toBe("start");
  });

  test("marks the click state as started", () => {
    const block = new StartBlock(parent, { index: 0 });
    const state = new ClickState("record");
    state.started = false;

    [...block.clickIntervalGen("record", state)];
    expect(state.started).toBe(true);
  });

  test("emits no clicks itself", () => {
    const block = new StartBlock(parent, { index: 0 });
    const state = new ClickState("record");
    expect([...block.clickIntervalGen("record", state)]).toEqual([]);
  });
});
