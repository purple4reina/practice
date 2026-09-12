import { expect, describe, test, beforeEach } from "vitest";
import BeatsBlock from "./beats-block";
import { ClickState } from "./clicks";
import { MidiSequencer } from "../midi";

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

describe("BeatsBlock", () => {
  test("defaults to 0 beats", () => {
    const block = new BeatsBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ count: 0 });
  });

  test("honors an initial count option, clamped to [0, 256]", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 8 });
    expect(block.getOpts()).toEqual({ count: 8 });

    const clamped = new BeatsBlock(parent, { index: 0, count: 9999 });
    expect(clamped.getOpts()).toEqual({ count: 256 });
  });

  test("emits nothing when bpm is 0 (metronome not yet set)", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 4 });
    const state = baseState({ bpm: 0 });
    expect([...block.clickIntervalGen("record", state)]).toEqual([]);
  });

  test("emits nothing when subdivisions is 0", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 4 });
    const state = baseState({ subdivisions: 0 });
    expect([...block.clickIntervalGen("record", state)]).toEqual([]);
  });

  test("emits one click per beat at 60bpm/1 subdivision (1000ms delay each)", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 3 });
    const state = baseState();

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toHaveLength(3);
    for (const click of clicks) {
      expect(click.delay).toBeCloseTo(1000, 6);
      expect(click.level).toBe(1);
      expect(click.isBeat).toBe(true);
      expect(click.started).toBe(true);
      expect(click.recording).toBe(true);
    }
    expect(state.beatIndex).toBe(3);
  });

  test("subdivisions insert extra non-beat clicks at level 4 between beats", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 2 });
    const state = baseState({ subdivisions: 2 });

    const clicks = [...block.clickIntervalGen("record", state)];
    // 2 beats * (1 beat click + 1 subdivision click) = 4 clicks
    expect(clicks).toHaveLength(4);
    expect(clicks[0].isBeat).toBe(true);
    expect(clicks[1].isBeat).toBeUndefined();
    expect(clicks[1].level).toBe(4);
    expect(clicks[2].isBeat).toBe(true);
    expect(clicks[3].level).toBe(4);
    // delay is split evenly across the subdivisions of each beat
    expect(clicks[0].delay).toBeCloseTo(500, 6);
    expect(clicks[1].delay).toBeCloseTo(500, 6);
  });

  test("when accelerando is enabled, clicks are buffered on state.accel instead of yielded", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 3 });
    const state = baseState();
    state.accel.start("linear");

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks).toEqual([]);
    expect(state.accel.clicks).toHaveLength(3);
  });

  test("attaches MIDI notes from any registered sequencer to each beat click", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 2 });
    const state = baseState();
    state.midiSequencers = [new MidiSequencer([{ frequency: 440, durationBeats: 1 }])];

    const clicks = [...block.clickIntervalGen("record", state)];
    expect(clicks[0].midiNotes).toEqual([{ frequency: 440, offsetMs: 0, durationMs: 1000 }]);
    expect(clicks[1].midiNotes).toEqual([]);
  });

  test("does not attach MIDI notes while accelerando is enabled (handled later by the metronome block)", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 1 });
    const state = baseState();
    state.midiSequencers = [new MidiSequencer([{ frequency: 440, durationBeats: 1 }])];
    state.accel.start("linear");

    [...block.clickIntervalGen("record", state)];
    expect(state.accel.clicks[0].midiNotes).toBeUndefined();
  });

  test("queryString reports the current count", () => {
    const block = new BeatsBlock(parent, { index: 0, count: 7 });
    expect(block.queryString()).toBe("count:7");
  });
});
