import { describe, it, expect } from "vitest";
import {
  INTERVAL_TYPES, WRITTEN_MIN, WRITTEN_MAX, centsBetween, foldedCents, justRatio,
  midiToFreq, pickExercise, tuningExercise, randomWrittenNote, scoreFrames, staffNote,
} from "./theory";

describe("just intonation", () => {
  it("makes a just fifth ~2 cents sharp of equal temperament", () => {
    expect(centsBetween(midiToFreq(67), midiToFreq(60) * justRatio(7))).toBeCloseTo(-1.955, 2);
  });
  it("makes a just major third ~13.7 cents flat", () => {
    expect(centsBetween(midiToFreq(60) * justRatio(4), midiToFreq(64))).toBeCloseTo(-13.686, 2);
  });
  it("treats octaves as powers of two", () => {
    expect(justRatio(24)).toBe(4);
    expect(justRatio(19)).toBeCloseTo(3, 10);
  });
});

describe("pickExercise", () => {
  it("tunes the player's note to the reference by the just ratio, in both directions", () => {
    for (const type of INTERVAL_TYPES) {
      for (let i = 0; i < 300; i++) {
        const e = pickExercise(type);
        const ratio = e.refAbove ? e.refFreq / e.targetFreq : e.targetFreq / e.refFreq;
        expect(ratio).toBeCloseTo(justRatio(e.semitones), 8);
        expect(e.writtenMidi - e.soundingMidi).toBe(2);
        expect(e.writtenMidi).toBeGreaterThanOrEqual(WRITTEN_MIN);
        expect(e.writtenMidi).toBeLessThanOrEqual(WRITTEN_MAX);
      }
    }
  });
  it("never repeats a played pitch class, so 12 rounds cover all twelve", () => {
    for (let run = 0; run < 50; run++) {
      const used = new Set<number>();
      for (let i = 0; i < 12; i++) {
        const e = pickExercise(INTERVAL_TYPES[run % INTERVAL_TYPES.length], Math.random, used);
        expect(used.has(e.writtenMidi % 12)).toBe(false);
        used.add(e.writtenMidi % 12);
      }
      expect(used.size).toBe(12);
    }
  });
  it("puts the reference above about half the time", () => {
    let above = 0;
    for (let i = 0; i < 2000; i++) if (pickExercise(INTERVAL_TYPES[1]).refAbove) above++;
    expect(above / 2000).toBeGreaterThan(0.45);
    expect(above / 2000).toBeLessThan(0.55);
  });
  it("uses multiple octaves for unison/octave", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(pickExercise(INTERVAL_TYPES[0]).semitones);
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 12, 24, 36]);
  });
});

describe("randomWrittenNote", () => {
  it("favours the middle of the range and stays inside it", () => {
    let middle = 0, edge = 0;
    for (let i = 0; i < 5000; i++) {
      const n = randomWrittenNote();
      expect(n).toBeGreaterThanOrEqual(WRITTEN_MIN);
      expect(n).toBeLessThanOrEqual(WRITTEN_MAX);
      if (Math.abs(n - 72.5) <= 5) middle++;
      if (Math.abs(n - 72.5) >= 15) edge++;
    }
    expect(middle).toBeGreaterThan(edge * 3);
  });
});

describe("scoring", () => {
  it("averages signed cents", () => {
    const f = (c: number) => 440 * Math.pow(2, c / 1200);
    expect(scoreFrames([f(10), f(20), f(10), f(20), f(15)], 440)).toBeCloseTo(15, 6);
  });
  it("ignores glitch frames, e.g. the mic hearing the reference tone", () => {
    const f = (c: number) => 440 * Math.pow(2, c / 1200);
    const frames = [...Array(85).fill(f(-10)), ...Array(15).fill(f(498))];
    expect(scoreFrames(frames, 440)).toBeCloseTo(-10, 6);
  });
  it("returns null when no pitch dominates", () => {
    const f = (c: number) => 440 * Math.pow(2, c / 1200);
    const frames = [...Array(10).fill(f(-200)), ...Array(10).fill(f(200)), ...Array(10).fill(f(400))];
    expect(scoreFrames(frames, 440)).toBeNull();
  });
  it("returns null with too few frames", () => {
    expect(scoreFrames([440, 440], 440)).toBeNull();
  });
  it("folds octave slips", () => {
    expect(foldedCents(880 * Math.pow(2, 5 / 1200), 440)).toBeCloseTo(5, 6);
  });
});

describe("staffNote", () => {
  it("places E4 on the bottom line and F5 on the top line", () => {
    expect(staffNote(64).step).toBe(30);
    expect(staffNote(77).step).toBe(38);
  });
  it("spells the range ends", () => {
    expect(staffNote(WRITTEN_MIN)).toMatchObject({ letter: "E", octave: 3 });
    expect(staffNote(WRITTEN_MAX)).toMatchObject({ letter: "A", octave: 6 });
  });
});

describe("tuningExercise", () => {
  it("is a unison on concert A, written B4", () => {
    const e = tuningExercise();
    expect(e.refFreq).toBe(440);
    expect(e.targetFreq).toBe(440);
    expect(e.writtenMidi).toBe(71);
    expect(staffNote(e.writtenMidi)).toMatchObject({ letter: "B", octave: 4 });
  });
});
