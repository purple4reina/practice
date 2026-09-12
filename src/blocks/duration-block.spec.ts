import { expect, describe, test, beforeEach } from "vitest";
import DurationBlock from "./duration-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

function baseState(overrides: Partial<ClickState> = {}): ClickState {
  const state = new ClickState("record");
  state.bpm = 60;
  state.subdivisions = 1;
  state.beatsPerMeasure = 1;
  state.beatPattern = [1];
  state.beatIndex = 0;
  state.started = true;
  state.recording = true;
  return Object.assign(state, overrides);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("DurationBlock", () => {
  test("defaults to 0 seconds", () => {
    const block = new DurationBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ seconds: 0 });
  });

  test("honors an initial seconds option, clamped to [0, 600]", () => {
    const clamped = new DurationBlock(parent, { index: 0, seconds: 999999 });
    expect(clamped.getOpts()).toEqual({ seconds: 600 });
  });

  test("with no metronome set (bpm=0), yields a single silent click of the exact duration", () => {
    const block = new DurationBlock(parent, { index: 0, seconds: 2 });
    const state = baseState({ bpm: 0 });

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toEqual([{ delay: 2000, level: 0, started: true, recording: true }]);
  });

  test("with a metronome set, expands the duration into individual beat clicks", () => {
    // At 60bpm, 2 seconds = 2 beats.
    const block = new DurationBlock(parent, { index: 0, seconds: 2 });
    const state = baseState({ bpm: 60 });

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toHaveLength(2);
    expect(clicks.every(c => c.isBeat)).toBe(true);
    expect(clicks.every(c => c.delay === 1000)).toBe(true);
    expect(state.beatIndex).toBe(2);
  });

  test("subdivisions add non-beat clicks within each beat", () => {
    const block = new DurationBlock(parent, { index: 0, seconds: 1 });
    const state = baseState({ bpm: 60, subdivisions: 2 });

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toHaveLength(2); // 1 beat click + 1 subdivision click
    expect(clicks[0].isBeat).toBe(true);
    expect(clicks[1].isBeat).toBeUndefined();
  });

  test("buffers clicks on state.accel instead of yielding when accelerando is enabled", () => {
    const block = new DurationBlock(parent, { index: 0, seconds: 2 });
    const state = baseState({ bpm: 60 });
    state.accel.start("linear");

    expect([...block.clickIntervalGen("record", state)]).toEqual([]);
    expect(state.accel.clicks).toHaveLength(2);
  });

  test("queryString reports the current seconds value", () => {
    const block = new DurationBlock(parent, { index: 0, seconds: 9 });
    expect(block.queryString()).toBe("seconds:9");
  });
});
