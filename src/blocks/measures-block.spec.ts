import { expect, describe, test, beforeEach } from "vitest";
import MeasuresBlock from "./measures-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

function baseState(overrides: Partial<ClickState> = {}): ClickState {
  const state = new ClickState("record");
  state.bpm = 60;
  state.subdivisions = 1;
  state.beatsPerMeasure = 3;
  state.beatPattern = [1, 2, 2];
  state.beatIndex = 0;
  state.started = true;
  state.recording = true;
  return Object.assign(state, overrides);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("MeasuresBlock", () => {
  test("defaults to 0 measures", () => {
    const block = new MeasuresBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ count: 0 });
  });

  test("honors an initial count option, clamped to [0, 256]", () => {
    const clamped = new MeasuresBlock(parent, { index: 0, count: 9999 });
    expect(clamped.getOpts()).toEqual({ count: 256 });
  });

  test("emits nothing when bpm is 0", () => {
    const block = new MeasuresBlock(parent, { index: 0, count: 2 });
    expect([...block.clickIntervalGen("record", baseState({ bpm: 0 }))]).toEqual([]);
  });

  test("emits beatsPerMeasure clicks per measure, following the beat pattern", () => {
    const block = new MeasuresBlock(parent, { index: 0, count: 2 });
    const state = baseState();

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toHaveLength(6); // 2 measures * 3 beats
    expect(clicks.map(c => c.level)).toEqual([1, 2, 2, 1, 2, 2]);
    expect(clicks.every(c => c.isBeat)).toBe(true);
    expect(state.beatIndex).toBe(6);
  });

  test("subdivisions add non-beat clicks within each beat of the measure", () => {
    const block = new MeasuresBlock(parent, { index: 0, count: 1 });
    const state = baseState({ subdivisions: 2 });

    const clicks = [...block.clickIntervalGen("record", state)];
    // 1 measure * 3 beats * (1 beat click + 1 subdivision click) = 6
    expect(clicks).toHaveLength(6);
    expect(clicks.filter(c => c.isBeat)).toHaveLength(3);
    expect(clicks.filter(c => !c.isBeat)).toHaveLength(3);
  });

  test("buffers clicks on state.accel instead of yielding when accelerando is enabled", () => {
    const block = new MeasuresBlock(parent, { index: 0, count: 1 });
    const state = baseState();
    state.accel.start("linear");

    expect([...block.clickIntervalGen("record", state)]).toEqual([]);
    expect(state.accel.clicks).toHaveLength(3);
  });

  test("queryString reports the current count", () => {
    const block = new MeasuresBlock(parent, { index: 0, count: 5 });
    expect(block.queryString()).toBe("count:5");
  });
});
