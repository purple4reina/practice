// Regression coverage for the MIDI block "skipping its last note".
//
// BlockManager closes every click list with one synthetic final downbeat (the
// "end marker"): audible, and always END_MARKER_MS (350ms) long whatever the
// tempo. A MIDI block only emits notes when a beat-producing block asks its
// sequencer for them, and nothing asked on the end marker's behalf - so a
// notation with one more note than the blocks gave it beats lost that note, in
// the live recording pass and on playback alike.
//
// The note on the marker sounds for the marker's fixed length, not for its
// written value, and is allowed to finish when a take ends on its own (but is
// still cut off by the user pressing stop).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Click } from "../blocks/clicks";
import { PlaybackMetronome } from "../metronome";
import { parseLilypond } from "../midi";
import { resetDom } from "../test-support/dom";
import {
  buildScenario,
  START,
  RECORD,
  STOP,
  DONE,
  metronomeParam,
  subdivisionParam,
  beatsParam,
  midiParam,
  accelerandoParam,
} from "../test-support/scenario";

const END_MARKER_MS = 350;

type Params = Parameters<typeof buildScenario>[0];

// Blocks run in order, so the MIDI block sits right before the beats it plays over.
function withMidi(
  notation: string,
  { bpm = 60, beats = 4, subdivisions = 1, rec = true, play = true, recordSpeed = 1 } = {},
) {
  const params: Params = [
    START,
    metronomeParam(bpm),
    subdivisionParam(subdivisions, subdivisions),
    RECORD,
    midiParam(notation, { recEnable: rec, playEnable: play }),
    beatsParam(beats),
    STOP,
    DONE,
  ];
  return buildScenario(params, recordSpeed, 0);
}

const lastClick = (clicks: Click[]) => clicks[clicks.length - 1];
const allNotes = (clicks: Click[]) => clicks.flatMap(c => c.midiNotes ?? []);
const frequencyOf = (notation: string, index: number) => parseLilypond(notation.replace(/\+/g, " "), 4)![index].frequency!;

describe("the closing downbeat takes the notation's one extra note", () => {
  const notation = "c4+d+e+f+g";

  test("4 beats + 5 notes: the 5th note lands on the end marker, in both phases", () => {
    const { recordClicks, playClicks } = withMidi(notation);

    for (const clicks of [recordClicks, playClicks]) {
      expect(allNotes(clicks)).toHaveLength(5);
      expect(lastClick(clicks).midiNotes).toEqual([
        { frequency: frequencyOf(notation, 4), offsetMs: 0, durationMs: END_MARKER_MS },
      ]);
    }
  });

  test("the first four notes still land on the four beats, in order", () => {
    const { playClicks } = withMidi(notation);

    const beatNotes = playClicks.filter(c => c.isBeat).map(c => c.midiNotes?.[0]?.frequency);
    expect(beatNotes).toEqual([0, 1, 2, 3].map(i => frequencyOf(notation, i)));
  });

  test("the marker is still the recorded final click, so playback keeps it", () => {
    const { playClicks } = withMidi(notation);
    expect(lastClick(playClicks).recording).toBe(true);
  });

  for (const subdivisions of [1, 2, 4]) {
    test(`unaffected by subdivisions (${subdivisions})`, () => {
      const { recordClicks } = withMidi(notation, { subdivisions });
      expect(allNotes(recordClicks)).toHaveLength(5);
      expect(lastClick(recordClicks).midiNotes?.[0].frequency).toBe(frequencyOf(notation, 4));
    });
  }
});

describe("the note on the closing downbeat has the downbeat's fixed duration", () => {
  for (const bpm of [40, 60, 120, 240]) {
    for (const last of ["g4", "g1", "g2.", "g16"]) {
      test(`${last} at ${bpm}bpm sounds for ${END_MARKER_MS}ms from the start of the marker`, () => {
        const { recordClicks, playClicks } = withMidi(`c4+d+e+f+${last}`, { bpm });
        for (const clicks of [recordClicks, playClicks]) {
          const [note] = lastClick(clicks).midiNotes!;
          expect(note.offsetMs).toBe(0);
          expect(note.durationMs).toBe(END_MARKER_MS);
        }
      });
    }
  }

  test("record speed does not change the stored duration (the metronome scales it like the marker's click)", () => {
    const { recordClicks } = withMidi("c4+d+e+f+g", { recordSpeed: 0.5 });
    expect(lastClick(recordClicks).midiNotes?.[0].durationMs).toBe(END_MARKER_MS);
  });
});

describe("the closing downbeat adds exactly one note and only when there is one to add", () => {
  test("notes == beats: the marker carries nothing new", () => {
    const { recordClicks, playClicks } = withMidi("c4+d+e+f");
    for (const clicks of [recordClicks, playClicks]) {
      expect(allNotes(clicks)).toHaveLength(4);
      expect(lastClick(clicks).midiNotes).toBeUndefined();
    }
  });

  test("notes > beats + 1: only one extra note is played, the rest stay dropped", () => {
    const { recordClicks, playClicks } = withMidi("c4+d+e+f+g+a+b");
    for (const clicks of [recordClicks, playClicks]) {
      expect(allNotes(clicks)).toHaveLength(5);
      expect(lastClick(clicks).midiNotes?.[0].frequency).toBe(frequencyOf("c4+d+e+f+g+a+b", 4));
    }
  });

  test("a rest on the closing downbeat stays silent", () => {
    const { recordClicks } = withMidi("c4+d+e+f+r");
    expect(lastClick(recordClicks).midiNotes).toBeUndefined();
  });

  test("a note still sounding from the last beat does not get re-struck on the marker", () => {
    const { recordClicks } = withMidi("c4+d+e+f2");
    expect(allNotes(recordClicks)).toHaveLength(4);
    expect(lastClick(recordClicks).midiNotes).toBeUndefined();
  });

  test("no MIDI block: the marker is untouched", () => {
    const { recordClicks, playClicks } = buildScenario(
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), STOP, DONE],
      1,
      0,
    );
    expect(lastClick(recordClicks).midiNotes).toBeUndefined();
    expect(lastClick(playClicks).midiNotes).toBeUndefined();
  });
});

describe("the Recording / Playback switches decide which phase gets the closing note", () => {
  test("recording only", () => {
    const { recordClicks, playClicks } = withMidi("c4+d+e+f+g", { rec: true, play: false });
    expect(lastClick(recordClicks).midiNotes).toHaveLength(1);
    expect(allNotes(playClicks)).toHaveLength(0);
  });

  test("playback only", () => {
    const { recordClicks, playClicks } = withMidi("c4+d+e+f+g", { rec: false, play: true });
    expect(allNotes(recordClicks)).toHaveLength(0);
    expect(lastClick(playClicks).midiNotes).toHaveLength(1);
  });
});

describe("accelerando", () => {
  // Notes are attached per click on this path (metronome-block.ts), a different
  // route from the plain beat blocks; the marker must still get the next note.
  test("the closing downbeat still takes the extra note after an accelerando", () => {
    const notation = "c4+d+e+f+g+a+b+c+d";
    const { recordClicks, playClicks } = buildScenario(
      [
        START,
        metronomeParam(120),
        subdivisionParam(1, 1),
        RECORD,
        accelerandoParam("linear"),
        midiParam(notation, { recEnable: true, playEnable: true }),
        beatsParam(8),
        metronomeParam(60),
        STOP,
        DONE,
      ],
      1,
      0,
    );

    for (const clicks of [recordClicks, playClicks]) {
      expect(allNotes(clicks)).toHaveLength(9);
      expect(lastClick(clicks).midiNotes).toEqual([
        { frequency: frequencyOf(notation, 8), offsetMs: 0, durationMs: END_MARKER_MS },
      ]);
    }
  });
});

// A take that ends on its own must let the closing note sound out; the user's
// own stop must still silence everything at once.
describe("Metronome.finish() vs stop()", () => {
  function fakeAudioContext() {
    const gains: { gain: { cancelScheduledValues: ReturnType<typeof vi.fn> } }[] = [];
    const oscillators: { stop: ReturnType<typeof vi.fn> }[] = [];
    const param = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    });
    const ctx = {
      currentTime: 0,
      destination: {},
      createGain: () => {
        const node = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
        gains.push(node);
        return node;
      },
      createOscillator: () => {
        const node = {
          type: "sine",
          frequency: param(),
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        oscillators.push(node);
        return node;
      },
    };
    return { ctx: ctx as unknown as AudioContext, gains, oscillators };
  }

  const closingNote: Click[] = [
    {
      delay: 1000,
      level: 1,
      started: true,
      recording: true,
      midiNotes: [{ frequency: 440, offsetMs: 0, durationMs: END_MARKER_MS }],
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    resetDom();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function startWithNote() {
    const { ctx, gains, oscillators } = fakeAudioContext();
    const metronome = new PlaybackMetronome(ctx);
    metronome._start(0, closingNote, 1);
    // The note is scheduled: nothing has been cancelled yet.
    expect(oscillators.length).toBeGreaterThan(0);
    const cancelled = () => gains.reduce((n, g) => n + g.gain.cancelScheduledValues.mock.calls.length, 0);
    expect(cancelled()).toBe(0);
    return { metronome, cancelled };
  }

  test("finish() leaves a scheduled note alone", () => {
    const { metronome, cancelled } = startWithNote();
    metronome.finish();
    expect(cancelled()).toBe(0);
  });

  test("stop() silences a scheduled note immediately", () => {
    const { metronome, cancelled } = startWithNote();
    metronome.stop();
    expect(cancelled()).toBeGreaterThan(0);
  });

  test("finish() still stops further click scheduling", () => {
    const { ctx } = fakeAudioContext();
    const metronome = new PlaybackMetronome(ctx);
    const clicks: Click[] = Array.from({ length: 5 }, () => ({ delay: 500, level: 1, started: true, recording: true }));
    metronome._start(0, clicks, 1);
    const pending = vi.getTimerCount();
    metronome.finish();
    vi.advanceTimersByTime(60_000);
    // Scheduler wakes once, sees isPlaying=false and does not reschedule itself.
    expect(vi.getTimerCount()).toBeLessThanOrEqual(pending);
  });
});
