import { expect, describe, test, beforeEach } from "vitest";
import StartRecordingBlock from "./start-recording-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("StartRecordingBlock", () => {
  test("is not removable and has type 'record'", () => {
    const block = new StartRecordingBlock(parent, { index: 0 });
    expect(block.removable).toBe(false);
    expect(StartRecordingBlock.type).toBe("record");
  });

  test("marks the click state as started and recording", () => {
    const block = new StartRecordingBlock(parent, { index: 0 });
    const state = new ClickState("record");
    state.started = false;
    state.recording = false;

    [...block.clickIntervalGen("record", state)];
    expect(state.started).toBe(true);
    expect(state.recording).toBe(true);
  });
});
