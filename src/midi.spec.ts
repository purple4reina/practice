import { expect, describe, test } from "vitest";
import {
  parseLilypond,
  MidiSequencer,
  transposeFrequency,
  TRANSPOSE_KEYS,
} from "./midi";

function freq(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

describe("parseLilypond", () => {
  test("returns an empty array for empty/whitespace input", () => {
    expect(parseLilypond("", 4)).toEqual([]);
    expect(parseLilypond("   ", 4)).toEqual([]);
  });

  test("parses a plain quarter note in 4/4", () => {
    const [note] = parseLilypond("c4", 4)!;
    expect(note.frequency).toBeCloseTo(freq(60), 6); // middle C
    expect(note.durationBeats).toBeCloseTo(1, 6);
  });

  test("parses sharps (is) and flats (es)", () => {
    const [sharp] = parseLilypond("cis4", 4)!;
    const [flat] = parseLilypond("des4", 4)!;
    expect(sharp.frequency).toBeCloseTo(freq(61), 6);
    expect(flat.frequency).toBeCloseTo(freq(61), 6);
  });

  test("'es' alone means E-flat", () => {
    const [note] = parseLilypond("es4", 4)!;
    expect(note.frequency).toBeCloseTo(freq(63), 6);
  });

  test("octave marks shift by 12 semitones each", () => {
    const [up] = parseLilypond("c'4", 4)!;
    const [down] = parseLilypond("c,4", 4)!;
    expect(up.frequency).toBeCloseTo(freq(72), 6);
    expect(down.frequency).toBeCloseTo(freq(48), 6);
  });

  test("a note with no duration reuses the previous note's duration", () => {
    const notes = parseLilypond("c4 d e", 4)!;
    expect(notes.map(n => n.durationBeats)).toEqual([1, 1, 1]);
  });

  test("dotted notes: one dot is 1.5x, two dots is 1.75x", () => {
    const [one] = parseLilypond("c4.", 4)!;
    const [two] = parseLilypond("c4..", 4)!;
    expect(one.durationBeats).toBeCloseTo(1.5, 6);
    expect(two.durationBeats).toBeCloseTo(1.75, 6);
  });

  test("duration is relative to the time signature's bottom number", () => {
    const [inFour] = parseLilypond("c4", 4)!;
    const [inEight] = parseLilypond("c4", 8)!;
    expect(inFour.durationBeats).toBeCloseTo(1, 6);
    expect(inEight.durationBeats).toBeCloseTo(2, 6);
  });

  test("rests have a null frequency", () => {
    const [rest] = parseLilypond("r4", 4)!;
    expect(rest.frequency).toBeNull();
    expect(rest.durationBeats).toBeCloseTo(1, 6);
  });

  test("parses a full sequence of notes and rests", () => {
    const notes = parseLilypond("c4 d8 r8 e4.", 4)!;
    expect(notes).toHaveLength(4);
    expect(notes[0].frequency).toBeCloseTo(freq(60), 6);
    expect(notes[1].durationBeats).toBeCloseTo(0.5, 6);
    expect(notes[2].frequency).toBeNull();
    expect(notes[3].durationBeats).toBeCloseTo(1.5, 6);
  });

  test("returns null for an unparseable token", () => {
    expect(parseLilypond("nonsense", 4)).toBeNull();
  });

  test("returns null when the first note has no explicit duration", () => {
    expect(parseLilypond("c", 4)).toBeNull();
  });

  test("returns null for a duration that isn't a power of two", () => {
    expect(parseLilypond("c3", 4)).toBeNull();
  });

  test("returns null for a zero or negative duration", () => {
    expect(parseLilypond("c0", 4)).toBeNull();
  });

  test("returns null for an unknown note letter", () => {
    expect(parseLilypond("h4", 4)).toBeNull();
  });
});

describe("transposeFrequency", () => {
  test("returns the same frequency for 0 semitones", () => {
    expect(transposeFrequency(440, 0)).toBeCloseTo(440, 10);
  });

  test("an octave (12 semitones) doubles frequency", () => {
    expect(transposeFrequency(440, 12)).toBeCloseTo(880, 6);
  });

  test("negative semitones transpose down", () => {
    expect(transposeFrequency(440, -12)).toBeCloseTo(220, 6);
  });

  test("Bb transposition matches its documented -2 semitones", () => {
    const bb = TRANSPOSE_KEYS.find(k => k.value === "Bb")!;
    expect(bb.semitones).toBe(-2);
    expect(transposeFrequency(440, bb.semitones)).toBeCloseTo(440 * Math.pow(2, -2 / 12), 6);
  });
});

describe("MidiSequencer", () => {
  test("getNotesForBeat emits a note only on the beat it starts", () => {
    // Two quarter notes in 4/4: each is a full beat-unit long.
    const notes = parseLilypond("c4 d4", 4)!;
    const seq = new MidiSequencer(notes);

    const beat1 = seq.getNotesForBeat(500); // 500ms per beat
    expect(beat1).toHaveLength(1);
    expect(beat1[0].frequency).toBeCloseTo(freq(60), 6);
    expect(beat1[0].offsetMs).toBe(0);
    expect(beat1[0].durationMs).toBeCloseTo(500, 6);

    const beat2 = seq.getNotesForBeat(500);
    expect(beat2).toHaveLength(1);
    expect(beat2[0].frequency).toBeCloseTo(freq(62), 6);

    expect(seq.done).toBe(true);
  });

  test("getNotesForBeat returns nothing once the sequence is exhausted", () => {
    const seq = new MidiSequencer(parseLilypond("c4", 4)!);
    seq.getNotesForBeat(500);
    expect(seq.getNotesForBeat(500)).toEqual([]);
  });

  test("a rest advances position but emits nothing", () => {
    const seq = new MidiSequencer(parseLilypond("r4 c4", 4)!);
    expect(seq.getNotesForBeat(500)).toEqual([]);
    const beat2 = seq.getNotesForBeat(500);
    expect(beat2).toHaveLength(1);
    expect(beat2[0].frequency).toBeCloseTo(freq(60), 6);
  });

  test("two eighth notes fit within a single beat-unit portion", () => {
    const seq = new MidiSequencer(parseLilypond("c8 d8", 4)!);
    const notes = seq.getNotesForPortion(1.0, 500);
    expect(notes).toHaveLength(2);
    expect(notes[0].offsetMs).toBeCloseTo(0, 6);
    expect(notes[0].durationMs).toBeCloseTo(250, 6);
    expect(notes[1].offsetMs).toBeCloseTo(250, 6);
    expect(notes[1].durationMs).toBeCloseTo(250, 6);
    expect(seq.done).toBe(true);
  });

  test("a note spanning multiple portions is only emitted once, at its start", () => {
    // A half note spans two quarter-beat portions.
    const seq = new MidiSequencer(parseLilypond("c2", 4)!);
    const first = seq.getNotesForPortion(1.0, 500);
    const second = seq.getNotesForPortion(1.0, 500);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(seq.done).toBe(true);
  });

  test("getNotesForPortionWithAccelFn times notes from a wall-clock function", () => {
    const seq = new MidiSequencer(parseLilypond("c4 d4", 4)!);
    // Simple linear tempo: 1 beat = 1000ms, starting at beat 0 = 0ms.
    const timeFnAtBeat = (beat: number) => beat * 1000;

    const notes = seq.getNotesForPortionWithAccelFn(1.0, 0, timeFnAtBeat);
    expect(notes).toHaveLength(1);
    expect(notes[0].offsetMs).toBeCloseTo(0, 6);
    expect(notes[0].durationMs).toBeCloseTo(1000, 6);

    const notes2 = seq.getNotesForPortionWithAccelFn(1.0, 1, timeFnAtBeat);
    expect(notes2).toHaveLength(1);
    expect(notes2[0].frequency).toBeCloseTo(freq(62), 6);
  });

  test("done is false until every note has been consumed", () => {
    const seq = new MidiSequencer(parseLilypond("c4 d4", 4)!);
    expect(seq.done).toBe(false);
    seq.getNotesForBeat(500);
    expect(seq.done).toBe(false);
    seq.getNotesForBeat(500);
    expect(seq.done).toBe(true);
  });
});
