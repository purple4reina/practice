import { expect, describe, test, beforeEach } from "vitest";
import StopRecordingBlock from "./stop-recording-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("StopRecordingBlock", () => {
  test("is not removable and has type 'stop'", () => {
    const block = new StopRecordingBlock(parent, { index: 0 });
    expect(block.removable).toBe(false);
    expect(StopRecordingBlock.type).toBe("stop");
  });

  test("marks the click state as no longer recording, without affecting started", () => {
    const block = new StopRecordingBlock(parent, { index: 0 });
    const state = new ClickState("record");
    state.started = true;
    state.recording = true;

    [...block.clickIntervalGen("record", state)];
    expect(state.recording).toBe(false);
    expect(state.started).toBe(true);
  });
});
