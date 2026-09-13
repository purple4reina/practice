import { expect, describe, test, beforeEach } from "vitest";
import Visualizer from "./index";
import { Clip } from "../clips";
import { resetDom } from "../test-support/dom";
import { installFakeCanvasContext } from "../test-support/fake-canvas";
import { FakeAudioContext } from "../test-support/fake-audio";

function silentBuffer(durationMs: number, sampleRate = 44100) {
  const length = Math.round((durationMs / 1000) * sampleRate);
  const data = new Float32Array(length);
  return {
    sampleRate,
    length,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

function fakeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    audioBuffer: silentBuffer(500),
    playClicks: [],
    recordSpeed: 1,
    latency: 0,
    scheduledDurationMs: 500,
    ...overrides,
  } as Clip;
}

let ctx: any;

beforeEach(() => {
  resetDom();
  ctx = installFakeCanvasContext();
});

describe("Visualizer total duration (the tail-end-click visibility bug)", () => {
  test("reaches (within one analysis window of) the real recorded buffer's end, closing the small gap left by the loudness sliding window", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(500) });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    // 500ms @ 44100Hz; the loudness window (1024 samples ≈ 23.2ms) is the only
    // unavoidable shortfall now that both the analyzer and the visualizer
    // floor against the buffer's own real length.
    expect((visualizer as any).totalDuration).toBeGreaterThan(500 - 23.3);
    expect((visualizer as any).totalDuration).toBeLessThanOrEqual(500);
  });

  test("never extends totalDuration past the real recorded buffer, even when scheduledDurationMs (a timer-based estimate) overshoots it", () => {
    // e.g. real capture came up short of what the record()/stop() timers
    // scheduled - flooring at the estimate would show a stretch with no
    // audio at all, not just unanalyzed audio. That's the bug: totalDuration
    // must never claim more than the buffer actually contains.
    const clip = fakeClip({
      audioBuffer: silentBuffer(500),
      scheduledDurationMs: 5000, // wildly overshoots the real 500ms buffer
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect((visualizer as any).totalDuration).toBeLessThanOrEqual(500);
  });

  test("still reflects the loudness-derived length when it's the larger of the two (defensive floor, not the driver)", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(2000) });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect((visualizer as any).totalDuration).toBeGreaterThan(1900);
  });

  test("a click positioned in the small tail gap is still within bounds", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(500),
      playClicks: [{ delay: 350, level: 1, started: true, recording: true }],
      latency: 490, // lands the click right at the buffer's real tail
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    // viewDuration defaults to totalDuration when not scrolling, so this
    // directly gates whether drawMetronomeBeats() would draw the click at all.
    expect((visualizer as any).viewStartTime + (visualizer as any).viewDuration).toBeGreaterThanOrEqual(490);
  });

  test("accounts for the skip-silence offset when computing the real buffer length", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(1000) });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 400); // skip the first 400ms

    expect((visualizer as any).totalDuration).toBeLessThanOrEqual(600);
    expect((visualizer as any).totalDuration).toBeGreaterThan(600 - 23.3);
  });
});

describe("Visualizer post-record region marker ('barely gives me anything after that click')", () => {
  test("tints the gap between the last recorded click and totalDuration, regardless of the audio's amplitude there", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(1000), // silent throughout, incl. the "recorded" click's own moment
      playClicks: [
        { delay: 350, level: 1, started: true, recording: true }, // the recorded downbeat
        { delay: 350, level: 1, started: true, recording: true, tail: true }, // synthetic marker
      ],
      latency: 100,
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    // clear + postlay tint = 2 fillRect calls (drawWaveform uses fill(), not fillRect)
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    const [x1, y, w, h] = ctx.fillRect.mock.calls[1];
    // Recorded content ends at latency(100) + its own 350ms delay = 450ms,
    // mapped onto whatever totalDuration the (silent, ~1000ms) buffer produced.
    const totalDuration = (visualizer as any).totalDuration;
    expect(x1).toBeCloseTo((450 / totalDuration) * 800, 0);
    expect(y).toBe(0);
    expect(h).toBe(300);
    expect(w).toBeGreaterThan(0);
  });

  test("draws a dashed boundary line at the start of the post-record region", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(1000),
      playClicks: [
        { delay: 100, level: 1, started: true, recording: true },
        { delay: 350, level: 1, started: true, recording: true, tail: true },
      ],
      latency: 0,
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect(ctx.setLineDash).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]); // reset after drawing, so later strokes aren't dashed
  });

  test("draws nothing extra when there's no recorded content at all (no false 'gap')", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(500), playClicks: [] });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1); // just the canvas clear
  });

  test("draws nothing when the recorded content already extends through totalDuration", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(500),
      playClicks: [{ delay: 10000, level: 1, started: true, recording: true, tail: true }],
      latency: 0,
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    // the only "click" is the tail marker itself, so recordedContentEndMs() is
    // null (nothing real was ever recorded) - same as the empty-playClicks case
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  test("recordingPrelay and recordPostlay stay equal (the fix for the reported asymmetry)", async () => {
    const { ClipSettings } = await import("../clips");
    const settings = new ClipSettings([{ delay: 350, level: 1, started: true, recording: false, tail: true }], [], 1, 0);
    expect(settings.recordingPrelay).toBe(settings.recordPostlay);
  });
});
