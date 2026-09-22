// Combinatorial coverage for ClipSettings.recordingPrelay / recordPostlay
// (src/clips.ts), run through the *real* BlockManager -> ClipSettings pipeline
// against many distinct block configurations and settings, not just hand-built
// Click[] arrays (see clips.spec.ts for the pure-math version of these same
// invariants).
//
// The two invariants that must hold for every recording, no matter how the
// blocks are arranged or what bpm/recordSpeed/subdivisions/latency are set:
//
//   1. The first recorded click always lands exactly `recordingPrelay` ms
//      into the buffer.
//   2. The buffer always ends exactly `recordPostlay` ms after the *end* of
//      the last recorded click's own interval (its onset plus its own delay
//      - the rest of that beat/subdivision is still time the recording is
//      meant to cover, not just the click's onset instant).
//
// Both pads are fixed real-time values - never scaled by recordSpeed, never
// affected by what's recorded in between, and never affected by content
// placed after "stop" or by the user's hardware-latency-compensation setting.
import { expect, describe, test } from "vitest";
import Visualizer from "../visualizer";
import type BlockManager from "../blocks";
import type { ClipSettings } from "../clips";
import { installFakeCanvasContext } from "../test-support/fake-canvas";
import {
  FakeAudioContext,
  buildScenario,
  groundTruthBufferPositions,
  groundTruthLastRecordedClickEndMs,
  START,
  RECORD,
  STOP,
  DONE,
  metronomeParam,
  subdivisionParam,
  beatsParam,
  pauseParam,
  patternParam,
  midiParam,
  accelerandoParam,
} from "../test-support/scenario";

type Params = [string, string][];

// --- Block-config templates -------------------------------------------------
// Each returns a full block sequence (start...done) for the given musical
// settings, exercising a distinct real-world arrangement of blocks around
// "record"/"stop".

function simple(bpm: number, recSub: number, playSub: number, preCount: number, recordedCount: number): Params {
  return [
    START,
    metronomeParam(bpm),
    subdivisionParam(recSub, playSub),
    beatsParam(preCount),
    RECORD,
    beatsParam(recordedCount),
    STOP,
    DONE,
  ];
}

// Content placed after "stop" but before "done" - the exact shape of the
// user's first bug report. Must not change stopRecordingDelay at all.
function trailingAfterStop(bpm: number, recSub: number, playSub: number, recordedCount: number, trailingCount: number): Params {
  return [
    START,
    metronomeParam(bpm),
    subdivisionParam(recSub, playSub),
    RECORD,
    beatsParam(recordedCount),
    STOP,
    beatsParam(trailingCount),
    DONE,
  ];
}

// Recording paused and resumed: two separate recorded segments separated by
// an explicit non-recorded gap (stop ... pause ... record again).
function pausedAndResumed(bpm: number, recSub: number, playSub: number, seg1Count: number, gapMs: number, seg2Count: number): Params {
  return [
    START,
    metronomeParam(bpm),
    subdivisionParam(recSub, playSub),
    RECORD,
    beatsParam(seg1Count),
    STOP,
    pauseParam(gapMs),
    RECORD,
    beatsParam(seg2Count),
    STOP,
    DONE,
  ];
}

// Record immediately followed by stop - zero recorded beats at all.
function zeroRecordedBeats(bpm: number, recSub: number, playSub: number): Params {
  return [START, metronomeParam(bpm), subdivisionParam(recSub, playSub), RECORD, STOP, DONE];
}

// Mirrors the user's second real-world report: a beat pattern plus two
// mid-recording subdivision changes and two (disabled) MIDI blocks between
// the recorded beats blocks.
function withPatternAndMidi(bpm: number, recSub: number, playSub: number): Params {
  return [
    START,
    metronomeParam(bpm),
    patternParam(2, 1, [1, 2]),
    subdivisionParam(recSub, playSub),
    beatsParam(2),
    RECORD,
    beatsParam(2),
    subdivisionParam(recSub, playSub + 2),
    midiParam("d8.+c8."),
    midiParam("e8.+d8."),
    beatsParam(1),
    STOP,
    DONE,
  ];
}

// An accelerando run while recording: click delays are non-uniform and
// computed dynamically, rather than a constant `60/bpm/subdivisions*1000`.
function withAccelerando(startBpm: number, endBpm: number, recSub: number, playSub: number, recordedCount: number): Params {
  return [
    START,
    metronomeParam(startBpm),
    subdivisionParam(recSub, playSub),
    RECORD,
    accelerandoParam("linear"),
    beatsParam(recordedCount),
    metronomeParam(endBpm),
    STOP,
    DONE,
  ];
}

// --- Invariant assertions ----------------------------------------------------
// These pin the actual literal contract values (100ms prelay, 350ms postlay),
// not just "whatever ClipSettings.recordingPrelay/recordPostlay currently
// say" - comparing truth against settings' own fields would only prove the
// *formula* is internally self-consistent, and would pass even if someone
// changed the constants to something wrong, since both sides of the
// comparison move together. Asserting the constants directly, alongside the
// formula, is what actually verifies "the pre/postlay are correct."
const EXPECTED_PRELAY_MS = 100;
const EXPECTED_POSTLAY_MS = 350;

function expectPrelayInvariant(truth: number[], settings: { recordingPrelay: number }) {
  expect(settings.recordingPrelay).toBe(EXPECTED_PRELAY_MS);
  expect(truth[0]).toBeCloseTo(EXPECTED_PRELAY_MS, 6);
}

function expectPostlayInvariant(
  recordClicks: ReturnType<BlockManager["recordClicks"]>,
  settings: ClipSettings,
) {
  expect(settings.recordPostlay).toBe(EXPECTED_POSTLAY_MS);
  const bufferDurationMs = settings.stopRecordingDelay - settings.startRecordingDelay;
  const lastClickEnd = groundTruthLastRecordedClickEndMs(recordClicks, settings);
  expect(lastClickEnd).not.toBeNull();
  expect(bufferDurationMs - (lastClickEnd as number)).toBeCloseTo(EXPECTED_POSTLAY_MS, 6);
}

// --- The settings sweep ------------------------------------------------------
// Deliberately includes the exact recordSpeed/latency values from the user's
// real bug reports (0.55/165, 0.6/165) alongside boundary-ish values (very
// slow, very fast, latency values seen during the earlier regression: the
// original 145 default, the user's true baseline 165, and the 410 emergency
// workaround), so a reintroduction of the old "shift by one click" bug would
// be caught here too.
const SETTINGS_SWEEP: { bpm: number; recSub: number; playSub: number; recordSpeed: number; latency: number }[] = [
  { bpm: 60, recSub: 1, playSub: 1, recordSpeed: 1, latency: 145 },
  { bpm: 100, recSub: 2, playSub: 4, recordSpeed: 0.55, latency: 165 },
  { bpm: 180, recSub: 4, playSub: 8, recordSpeed: 0.3, latency: 410 },
  { bpm: 100, recSub: 1, playSub: 1, recordSpeed: 1.5, latency: 100 },
];

describe("prelay/postlay invariants across block-config templates and settings", () => {
  describe.each(SETTINGS_SWEEP)(
    "settings: bpm=$bpm recSub=$recSub playSub=$playSub recordSpeed=$recordSpeed latency=$latency",
    ({ bpm, recSub, playSub, recordSpeed, latency }) => {
      test("simple record/stop, no count-in, single beat", () => {
        const { recordClicks, settings } = buildScenario(simple(bpm, recSub, playSub, 0, 1), recordSpeed, latency);
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("simple record/stop, with count-in, several beats", () => {
        const { recordClicks, settings } = buildScenario(simple(bpm, recSub, playSub, 3, 5), recordSpeed, latency);
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("content placed after stop", () => {
        const { recordClicks, settings } = buildScenario(
          trailingAfterStop(bpm, recSub, playSub, 4, 6),
          recordSpeed,
          latency,
        );
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("recording paused and resumed with a gap", () => {
        const { recordClicks, settings } = buildScenario(
          pausedAndResumed(bpm, recSub, playSub, 2, 750, 3),
          recordSpeed,
          latency,
        );
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("pattern + subdivision changes + disabled midi blocks interleaved", () => {
        const { recordClicks, settings } = buildScenario(withPatternAndMidi(bpm, recSub, playSub), recordSpeed, latency);
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("accelerando during the recorded segment", () => {
        const { recordClicks, settings } = buildScenario(
          withAccelerando(bpm, bpm * 1.5, recSub, playSub, 8),
          recordSpeed,
          latency,
        );
        const truth = groundTruthBufferPositions(recordClicks, settings);
        expectPrelayInvariant(truth, settings);
        expectPostlayInvariant(recordClicks, settings);
      });

      test("zero recorded beats falls back to prelay+postlay only, and clip.latency passes straight through", () => {
        const { recordClicks, settings, clip } = buildScenario(zeroRecordedBeats(bpm, recSub, playSub), recordSpeed, latency);
        const truth = groundTruthBufferPositions(recordClicks, settings);

        expect(truth).toHaveLength(0);
        expect(settings.startRecordingDelay).toBe(0);
        expect(settings.stopRecordingDelay).toBeCloseTo(EXPECTED_PRELAY_MS + EXPECTED_POSTLAY_MS, 6);
        expect(clip.latency).toBe(latency);
      });
    },
  );
});

describe("content after stop never changes the postlay", () => {
  // Same recorded content, only the amount of trailing (non-recorded) content
  // after "stop" varies. stopRecordingDelay - and therefore the buffer length
  // and the postlay gap - must be identical every time. Compare against the
  // real settings at trailingCount=0 rather than a hand-typed formula (a
  // formula here would just re-derive - and risk re-diverging from - the same
  // beats-per-click*subdivisions arithmetic the source already owns).
  const baseline = buildScenario(trailingAfterStop(100, 2, 4, 4, 0), 0.6, 165).settings.stopRecordingDelay;

  test.each([0, 1, 5, 20])("trailingCount=%i", (trailingCount) => {
    const { recordClicks, settings } = buildScenario(
      trailingAfterStop(100, 2, 4, 4, trailingCount),
      0.6,
      165,
    );
    const truth = groundTruthBufferPositions(recordClicks, settings);

    expectPrelayInvariant(truth, settings);
    expectPostlayInvariant(recordClicks, settings);
    expect(settings.stopRecordingDelay).toBeCloseTo(baseline, 6);
  });
});

describe("hardware latency compensation never affects prelay/postlay math", () => {
  // clip.latency is a straight passthrough; recordingPrelay/recordPostlay are
  // fixed constants. Neither should move by even a millisecond as the user's
  // latency-compensation setting changes - that combination is exactly what
  // caused the "shifted right by one click" regression this suite guards
  // against (see the NOTE in last-beat-visibility.spec.ts). Compare the
  // buffer geometry against the settings at latency=0 rather than a
  // hand-typed formula, for the same reason as above.
  const baselineSettings = buildScenario(simple(100, 2, 4, 2, 4), 0.55, 0).settings;
  const baselineStart = baselineSettings.startRecordingDelay;
  const baselineDuration = baselineSettings.stopRecordingDelay - baselineSettings.startRecordingDelay;

  test.each([0, 100, 145, 165, 410])("latency=%i", (latency) => {
    const { recordClicks, settings, clip } = buildScenario(simple(100, 2, 4, 2, 4), 0.55, latency);
    const truth = groundTruthBufferPositions(recordClicks, settings);

    expectPrelayInvariant(truth, settings);
    expectPostlayInvariant(recordClicks, settings);
    expect(clip.latency).toBe(latency);
    // and the buffer geometry itself must be identical regardless of latency
    expect(settings.startRecordingDelay).toBeCloseTo(baselineStart, 6);
    expect(settings.stopRecordingDelay - settings.startRecordingDelay).toBeCloseTo(baselineDuration, 6);
  });
});

describe("end-to-end: first and last recorded clicks always render within the drawable viewport", () => {
  // Extends last-beat-visibility.spec.ts's two hand-picked repro URLs into a
  // small matrix, running the full BlockManager -> ClipSettings -> Clip ->
  // Visualizer pipeline and checking both ends of the recording, not just the
  // last click.
  const cases: { name: string; params: Params; recordSpeed: number; latency: number }[] = [
    { name: "simple, normal speed", params: simple(100, 1, 1, 2, 4), recordSpeed: 1, latency: 145 },
    { name: "simple, slow speed (0.55)", params: simple(100, 4, 8, 2, 1), recordSpeed: 0.55, latency: 165 },
    { name: "trailing content after stop", params: trailingAfterStop(120, 2, 4, 3, 8), recordSpeed: 0.6, latency: 165 },
    { name: "paused and resumed recording", params: pausedAndResumed(90, 2, 2, 2, 500, 3), recordSpeed: 0.75, latency: 145 },
    { name: "pattern + subdivisions + midi", params: withPatternAndMidi(100, 2, 6), recordSpeed: 0.6, latency: 165 },
    { name: "accelerando", params: withAccelerando(60, 160, 1, 2, 8), recordSpeed: 0.5, latency: 100 },
    { name: "very slow record speed", params: simple(140, 2, 4, 1, 3), recordSpeed: 0.2, latency: 410 },
    { name: "fast record speed", params: simple(100, 1, 2, 1, 6), recordSpeed: 1.5, latency: 145 },
  ];

  test.each(cases)("$name", ({ params, recordSpeed, latency }) => {
    const { recordClicks, settings, clip } = buildScenario(params, recordSpeed, latency);
    const truth = groundTruthBufferPositions(recordClicks, settings);
    const [firstReal] = truth;
    const lastReal = truth[truth.length - 1];

    installFakeCanvasContext();
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
    visualizer.drawVisualization(clip, 0);
    const v = visualizer as any;

    expect(firstReal).toBeGreaterThanOrEqual(0);
    expect(firstReal).toBeLessThanOrEqual(v.totalDuration);
    expect(lastReal).toBeLessThanOrEqual(v.totalDuration);
    expect(lastReal).toBeLessThanOrEqual(v.viewStartTime + v.viewDuration);
  });
});
