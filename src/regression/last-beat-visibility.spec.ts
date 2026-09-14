// Permanent regression coverage for a bug reported directly against real
// URLs the user was practicing with: "I'm still not seeing the last beat!"
// The loudness analysis and the visualizer's totalDuration both fell short
// of the buffer's real length (loudness-analyzer.ts, visualizer/index.ts).
//
// These run the *actual* BlockManager -> ClipSettings -> Clip -> Visualizer
// pipeline against the exact block sequences from the user's reports, rather
// than isolated unit assertions, because the bug only showed up in the
// interaction between subsystems (record-phase vs. play-phase click
// generation, recordSpeed scaling, the loudness window's own tail gap).
//
// NOTE on latency: an earlier pass at this also "fixed" Clip.latency to add
// ClipSettings.recordingPrelay on top of the user's hardware-latency-
// compensation setting. That was reverted - it required every already-tuned
// user (including one whose working value, 165, predates this whole episode)
// to manually lower their setting to keep working, and the actual "shifted
// right by one click" symptom that prompted it traced back to a *different*
// in-session change (recordingPrelay bumped from 100 to 350) that has since
// been dropped entirely. clip.latency is a straight passthrough again (see
// clips.spec.ts) - don't reintroduce combining it with recordingPrelay
// without a reproduction on this exact baseline.
import { expect, describe, test } from "vitest";
import Visualizer from "../visualizer";
import { installFakeCanvasContext } from "../test-support/fake-canvas";
import { FakeAudioContext, buildScenario, groundTruthBufferPositions } from "../test-support/scenario";

describe("scenario 1: start/metronome/subdivision(4,8)/beats(2)/record/beats(1)/stop/beats(1)/done", () => {
  const params: [string, string][] = [
    ["start", ""],
    ["metronome", encodeURIComponent("bpm:100")],
    ["subdivision", encodeURIComponent("recordSubdivisions:4 playbackSubdivisions:8")],
    ["beats", encodeURIComponent("count:2")],
    ["record", ""],
    ["beats", encodeURIComponent("count:1")],
    ["stop", ""],
    ["beats", encodeURIComponent("count:1")],
    ["done", ""],
  ];

  test("the last recorded click renders within the drawable viewport, using the user's own reported latency setting (165)", () => {
    const { recordClicks, settings, clip } = buildScenario(params, 0.55, 165);
    const truth = groundTruthBufferPositions(recordClicks, settings);
    const lastReal = truth[truth.length - 1];

    installFakeCanvasContext();
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
    visualizer.drawVisualization(clip, 0);
    const v = visualizer as any;

    expect(lastReal).toBeLessThanOrEqual(v.totalDuration);
    expect(lastReal).toBeLessThanOrEqual(v.viewStartTime + v.viewDuration);
  });
});

describe("scenario 2: pattern + two subdivision blocks + two midi blocks", () => {
  const params: [string, string][] = [
    ["start", ""],
    ["metronome", encodeURIComponent("bpm:100")],
    ["pattern", encodeURIComponent("beats:2 start:1 pattern:1,2")],
    ["subdivision", encodeURIComponent("recordSubdivisions:2 playbackSubdivisions:6")],
    ["beats", encodeURIComponent("count:2")],
    ["record", ""],
    ["beats", encodeURIComponent("count:2")],
    ["subdivision", encodeURIComponent("recordSubdivisions:2 playbackSubdivisions:4")],
    ["midi", encodeURIComponent("timeSig:4 notation:d8.+c8. recEnable:false playEnable:false transpose:C")],
    ["midi", encodeURIComponent("timeSig:4 notation:e8.+d8. recEnable:false playEnable:false transpose:C")],
    ["beats", encodeURIComponent("count:1")],
    ["stop", ""],
    ["done", ""],
  ];

  test("the last recorded click still renders within the drawable viewport", () => {
    const { recordClicks, settings, clip } = buildScenario(params, 0.6, 165);
    const truth = groundTruthBufferPositions(recordClicks, settings);
    const lastReal = truth[truth.length - 1];

    installFakeCanvasContext();
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
    visualizer.drawVisualization(clip, 0);
    const v = visualizer as any;

    expect(lastReal).toBeLessThanOrEqual(v.totalDuration);
    expect(lastReal).toBeLessThanOrEqual(v.viewStartTime + v.viewDuration);
  });
});
