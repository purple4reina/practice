import { expect, describe, test } from "vitest";
import { ClickState } from "./clicks";
import { MidiSequencer } from "../midi";

describe("ClickState.getLevel", () => {
  test("cycles through the beat pattern by beatIndex modulo beatsPerMeasure", () => {
    const state = new ClickState("record");
    state.beatPattern = [1, 2, 3];
    state.beatsPerMeasure = 3;

    state.beatIndex = 0;
    expect(state.getLevel()).toBe(1);
    state.beatIndex = 1;
    expect(state.getLevel()).toBe(2);
    state.beatIndex = 2;
    expect(state.getLevel()).toBe(3);
    state.beatIndex = 3;
    expect(state.getLevel()).toBe(1); // wraps
  });

  test("during recording, a pattern level of 0 (silent beat) stays 0", () => {
    const state = new ClickState("record");
    state.beatPattern = [0];
    state.beatsPerMeasure = 1;
    expect(state.getLevel()).toBe(0);
  });

  test("during playback, a silent pattern beat (0) is audible: 1 on downbeat, 2 elsewhere", () => {
    const state = new ClickState("play");
    state.beatPattern = [0, 0];
    state.beatsPerMeasure = 2;

    state.beatIndex = 0;
    expect(state.getLevel()).toBe(1); // downbeat
    state.beatIndex = 1;
    expect(state.getLevel()).toBe(2); // offbeat
  });

  test("during playback, a non-zero pattern level passes through unchanged", () => {
    const state = new ClickState("play");
    state.beatPattern = [3];
    state.beatsPerMeasure = 1;
    expect(state.getLevel()).toBe(3);
  });
});

describe("ClickState MIDI delegation", () => {
  test("getMidiNotesForBeat aggregates notes from every attached sequencer", () => {
    const state = new ClickState("play");
    const seqA = new MidiSequencer([{ frequency: 440, durationBeats: 1 }]);
    const seqB = new MidiSequencer([{ frequency: 220, durationBeats: 1 }]);
    state.midiSequencers = [seqA, seqB];

    const notes = state.getMidiNotesForBeat(500);
    expect(notes).toHaveLength(2);
    expect(notes.map(n => n.frequency).sort()).toEqual([220, 440]);
  });

  test("getMidiNotesForBeat returns [] when there are no sequencers", () => {
    const state = new ClickState("play");
    expect(state.getMidiNotesForBeat(500)).toEqual([]);
  });

  test("getMidiNotesForPortion delegates to each sequencer's portion method", () => {
    const state = new ClickState("play");
    const seq = new MidiSequencer([{ frequency: 440, durationBeats: 1 }]);
    state.midiSequencers = [seq];

    expect(state.getMidiNotesForPortion(1.0, 500)).toHaveLength(1);
  });

  test("getMidiNotesForPortionWithAccelFn delegates to each sequencer", () => {
    const state = new ClickState("play");
    const seq = new MidiSequencer([{ frequency: 440, durationBeats: 1 }]);
    state.midiSequencers = [seq];

    const notes = state.getMidiNotesForPortionWithAccelFn(1.0, 0, (beat) => beat * 1000);
    expect(notes).toHaveLength(1);
    expect(notes[0].offsetMs).toBe(0);
  });
});

describe("ClickStateAccel (via ClickState.accel)", () => {
  test("starts disabled with no kind and no buffered clicks", () => {
    const state = new ClickState("record");
    expect(state.accel.enabled).toBe(false);
    expect(state.accel.kind).toBeUndefined();
    expect(state.accel.clicks).toEqual([]);
  });

  test("start() enables accel, sets kind, and clears any prior clicks", () => {
    const state = new ClickState("record");
    state.accel.clicks.push({ delay: 1, level: 1, started: true, recording: true });
    state.accel.start("linear");

    expect(state.accel.enabled).toBe(true);
    expect(state.accel.kind).toBe("linear");
    expect(state.accel.clicks).toEqual([]);
  });

  test("reset() disables accel and clears kind/clicks", () => {
    const state = new ClickState("record");
    state.accel.start("cosine");
    state.accel.clicks.push({ delay: 1, level: 1, started: true, recording: true });
    state.accel.reset();

    expect(state.accel.enabled).toBe(false);
    expect(state.accel.kind).toBeUndefined();
    expect(state.accel.clicks).toEqual([]);
  });
});
