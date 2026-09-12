import { expect, describe, test, beforeEach } from "vitest";
import PauseBlock from "./pause-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("PauseBlock", () => {
  test("defaults to a 0ms pause and is removable", () => {
    const block = new PauseBlock(parent, { index: 0 });
    expect(block.removable).toBe(true);
    expect(block.getOpts()).toEqual({ pause: 0 });
  });

  test("honors an initial pause option, clamped to [0, 60000]", () => {
    const block = new PauseBlock(parent, { index: 0, pause: 500 });
    expect(block.getOpts()).toEqual({ pause: 500 });

    const clamped = new PauseBlock(parent, { index: 0, pause: 999999 });
    expect(clamped.getOpts()).toEqual({ pause: 60000 });
  });

  test("yields a single silent click carrying the pause delay and current state", () => {
    const block = new PauseBlock(parent, { index: 0, pause: 250 });
    const state = new ClickState("record");
    state.started = true;
    state.recording = true;

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toEqual([{ delay: 250, level: 0, started: true, recording: true }]);
  });

  test("queryString reports the current pause value", () => {
    const block = new PauseBlock(parent, { index: 0, pause: 42 });
    expect(block.queryString()).toBe("pause:42");
  });
});
