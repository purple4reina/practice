import { expect, describe, test, beforeEach, afterEach, vi } from "vitest";
import { RecordingMetronome, PlaybackMetronome } from "./metronome";
import { Click } from "./blocks/clicks";
import { Clip } from "./clips";
import { FakeAudioContext } from "./test-support/fake-audio";
import { resetDom } from "./test-support/dom";
import QueryParams from "./query-params";

let ctx: FakeAudioContext;

function click(delay: number, opts: Partial<Click> = {}): Click {
  return { delay, level: 1, started: true, recording: false, ...opts };
}

// Lets every remaining click clear the scheduler's 25ms lookahead in one
// shot: jump the fake audio clock far ahead, then flush the metronome's
// pending self-rescheduled setTimeout.
function runToCompletion() {
  ctx.advance(1e6);
  vi.advanceTimersByTime(25);
}

beforeEach(() => {
  resetDom();
  QueryParams.replace(new URLSearchParams());
  ctx = new FakeAudioContext();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RecordingMetronome click scheduling", () => {
  test("schedules a click sound (one oscillator) for each click when enabled (default on)", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      recordClicks: [click(500), click(500)],
    } as any);

    runToCompletion();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  test("schedules nothing when the recording metronome is toggled off", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    (document.getElementById("rec-metronome-enabled") as HTMLInputElement).click(); // off

    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      recordClicks: [click(500)],
    } as any);
    runToCompletion();

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  test("MIDI notes on a click are scheduled even when the metronome click sound is disabled", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    (document.getElementById("rec-metronome-enabled") as HTMLInputElement).click(); // off

    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      recordClicks: [click(500, { midiNotes: [{ frequency: 440, offsetMs: 0, durationMs: 100 }] })],
    } as any);
    runToCompletion();

    // one createOscillator call per overtone for the MIDI note, none for the click itself
    expect(ctx.createOscillator).toHaveBeenCalledTimes(8);
  });

  test("offsets the first click by recordingPrelay", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    metronome.start(2, {
      recordingPrelay: 100,
      recordSpeed: 1,
      recordClicks: [click(500)],
    } as any);

    // not yet due: start(2s) + 100ms prelay = 2.1s, still beyond the 25ms lookahead from currentTime=0
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    ctx.currentTime = 2.1;
    vi.advanceTimersByTime(25);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  test("random click silencing drops recording clicks (but not count-in clicks) probabilistically", () => {
    // SlideControls seeds its value from the query param at construction time
    // (it never reads the DOM element's pre-existing value), so this is the
    // realistic way to have it already at 100% when the metronome is built.
    QueryParams.set("rec-silencing", "100");

    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      recordClicks: [click(500, { recording: false }), click(500, { recording: true })],
    } as any);
    runToCompletion();

    // the count-in click always sounds; the recording click is 100% silenced
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  test("schedules the click-flash show/hide relative to the click's time, converted to milliseconds", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    (document.getElementById("rec-click-flash") as HTMLInputElement).click(); // enable flash

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    ctx.currentTime = 0;
    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      // two 10ms-apart clicks land in the same initial scheduler pass (both
      // within the 25ms lookahead), so the second is scheduled while
      // audioContext.currentTime is still 0 - i.e. 10ms in the future.
      recordClicks: [click(10), click(10)],
    } as any);

    const flashCalls = setTimeoutSpy.mock.calls.filter(([, delay]) => typeof delay === "number");
    // [show@0, hide@50, show@~10, hide@~60]
    expect(flashCalls).toHaveLength(4);
    expect(flashCalls[0][1]).toBe(0);
    expect(flashCalls[1][1]).toBe(50);
    expect(flashCalls[2][1]).toBeCloseTo(10, 5);
    expect(flashCalls[3][1]).toBeCloseTo(60, 5);
  });
});

describe("Metronome.stop", () => {
  test("cancels and stops any still-scheduled MIDI notes", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    (document.getElementById("rec-metronome-enabled") as HTMLInputElement).click(); // off, isolates the midi masterGain

    metronome.start(0, {
      recordingPrelay: 0,
      recordSpeed: 1,
      recordClicks: [click(10000, { midiNotes: [{ frequency: 440, offsetMs: 0, durationMs: 500 }] })],
    } as any);

    const masterGain = ctx.createGain.mock.results
      .map(r => r.value as any)
      .find(g => g.connections.includes(ctx.destination));
    expect(masterGain).toBeTruthy();

    metronome.stop();

    expect(masterGain.gain.cancelScheduledValues).toHaveBeenCalled();
    expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, ctx.currentTime);
  });

  test("starting again while already playing stops the previous run first", () => {
    const metronome = new RecordingMetronome(ctx as unknown as AudioContext);
    const settings = { recordingPrelay: 0, recordSpeed: 1, recordClicks: [click(10000)] } as any;
    expect(() => {
      metronome.start(0, settings);
      metronome.start(0, settings);
    }).not.toThrow();
  });
});

describe("PlaybackMetronome", () => {
  function fakeClip(overrides: Partial<Clip> = {}): Clip {
    return {
      latency: 0,
      recordSpeed: 1,
      playClicks: [click(500, { recording: true })],
      ...overrides,
    } as Clip;
  }

  test("only plays back clicks marked as recording", () => {
    const metronome = new PlaybackMetronome(ctx as unknown as AudioContext);
    metronome.start(0, fakeClip({
      playClicks: [click(500, { recording: false }), click(500, { recording: true })],
    }), 1.0);
    runToCompletion();

    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  test("accounts for clip latency and playback offset when computing the start time", () => {
    const metronome = new PlaybackMetronome(ctx as unknown as AudioContext);
    ctx.currentTime = 0;
    metronome.start(10, fakeClip({ latency: 200 }), 1.0, 50);
    // startTime = audioStartTime + (latency - offsetMs) / playbackRate / 1000
    //           = 10 + (200 - 50) / 1 / 1000 = 10.15
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    ctx.currentTime = 10.15;
    vi.advanceTimersByTime(25);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });
});
