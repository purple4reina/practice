import { expect, describe, test, beforeEach } from "vitest";
import Visualizer from "./index";
import { Clip } from "../clips";
import { resetDom } from "../test-support/dom";
import { installFakeCanvasContext } from "../test-support/fake-canvas";

class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
}

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

beforeEach(() => {
  resetDom();
  installFakeCanvasContext();
});

describe("Visualizer total duration (the tail-end-click visibility bug)", () => {
  test("reaches (within one analysis window of) the real recorded buffer's end", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(500) });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    // 500ms @ 44100Hz; the loudness window (1024 samples ~= 23.2ms) is the only
    // unavoidable shortfall now that both the analyzer and the visualizer
    // floor against the buffer's own real length.
    expect((visualizer as any).totalDuration).toBeGreaterThan(500 - 23.3);
    expect((visualizer as any).totalDuration).toBeLessThanOrEqual(500);
  });

  test("never extends totalDuration past the real recorded buffer, even when scheduledDurationMs (a timer-based estimate) overshoots it", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(500),
      scheduledDurationMs: 5000, // wildly overshoots the real 500ms buffer
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect((visualizer as any).totalDuration).toBeLessThanOrEqual(500);
  });

  test("still reflects the loudness-derived length when it's the larger of the two", () => {
    const clip = fakeClip({ audioBuffer: silentBuffer(2000) });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

    expect((visualizer as any).totalDuration).toBeGreaterThan(1900);
  });

  test("a click positioned in the small tail gap is still within the drawable viewport", () => {
    const clip = fakeClip({
      audioBuffer: silentBuffer(500),
      playClicks: [{ delay: 350, level: 1, started: true, recording: true }],
      latency: 490, // lands the click right at the buffer's real tail
    });
    const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);

    visualizer.drawVisualization(clip, 0);

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
