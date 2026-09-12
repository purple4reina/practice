import { expect, describe, test, beforeEach } from "vitest";
import MetronomeBlock from "./metronome-block";
import { ClickState } from "./clicks";
import { MidiSequencer } from "../midi";

let parent: HTMLElement;

beforeEach(() => {
  // MetronomeBlock reads the page-level #rec-speed slider directly.
  document.body.innerHTML = '<div id="blocks"></div><input id="rec-speed" value="100">';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("MetronomeBlock basics", () => {
  test("defaults to 60bpm", () => {
    const block = new MetronomeBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ bpm: 60 });
  });

  test("honors an initial bpm option, clamped to [5, 512]", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 120 });
    expect(block.getOpts()).toEqual({ bpm: 120 });

    const clamped = new MetronomeBlock(parent, { index: 0, bpm: 9999 });
    expect(clamped.getOpts()).toEqual({ bpm: 512 });
  });

  test("queryString reports the current bpm", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 90 });
    expect(block.queryString()).toBe("bpm:90");
  });

  test("sets state.bpm from its own bpm value when accelerando is not active", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 90 });
    const state = new ClickState("record");
    state.bpm = 60;

    [...block.clickIntervalGen("record", state)];
    expect(state.bpm).toBe(90);
    expect(state.accel.enabled).toBe(false);
  });

  test("shows the effective recording bpm in the label when rec-speed != 100%", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 80 });
    const label = document.getElementById(`${block.id}-bpm-label`) as HTMLElement;
    const recSpeed = document.getElementById("rec-speed") as HTMLInputElement;

    recSpeed.value = "50";
    recSpeed.dispatchEvent(new Event("input"));
    expect(label.innerText).toBe("BPM (40):");

    recSpeed.value = "100";
    recSpeed.dispatchEvent(new Event("input"));
    expect(label.innerText).toBe("BPM:");
  });
});

describe("MetronomeBlock accelerando resolution", () => {
  function accelState(kind: string, initialBpm: number): ClickState {
    const state = new ClickState("record");
    state.bpm = initialBpm;
    state.subdivisions = 1;
    state.accel.start(kind);
    return state;
  }

  test("resolves buffered accel.clicks into a ramped tempo, ending at this block's bpm", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 120 });
    const state = accelState("linear", 60);
    // 4 quarter-note clicks at the initial 60bpm (1000ms each) waiting to be re-timed.
    for (let i = 0; i < 4; i++) {
      state.accel.clicks.push({ delay: 1000, level: 1, started: true, recording: true });
    }

    const resolved = [...block.clickIntervalGen("record", state)];

    expect(resolved).toHaveLength(4);
    expect(resolved.every(c => c.delay > 0)).toBe(true);
    // Tempo increases over the ramp, so successive delays shrink toward the target bpm.
    expect(resolved[0].delay).toBeGreaterThan(resolved[3].delay);
    expect(state.bpm).toBe(120);
    expect(state.accel.enabled).toBe(false);
  });

  test("throws when the buffered accel kind isn't a real accel function", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 120 });
    const state = accelState("not-a-kind", 60);
    state.accel.clicks.push({ delay: 1000, level: 1, started: true, recording: true });

    expect(() => [...block.clickIntervalGen("record", state)]).toThrow(/accelerando kind not found/);
  });

  test("attaches re-timed MIDI notes to each resolved click when sequencers are present", () => {
    const block = new MetronomeBlock(parent, { index: 0, bpm: 120 });
    const state = accelState("linear", 60);
    state.midiSequencers = [new MidiSequencer([{ frequency: 440, durationBeats: 4 }])];
    for (let i = 0; i < 4; i++) {
      state.accel.clicks.push({ delay: 1000, level: 1, started: true, recording: true });
    }

    const resolved = [...block.clickIntervalGen("record", state)];
    const withNotes = resolved.filter(c => (c.midiNotes?.length ?? 0) > 0);
    expect(withNotes).toHaveLength(1);
    expect(withNotes[0].midiNotes![0].frequency).toBe(440);
  });
});
