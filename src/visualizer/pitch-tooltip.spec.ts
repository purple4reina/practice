import { expect, describe, test, beforeEach, vi } from "vitest";
import Visualizer from "./index";
import { IntonationPoint } from "./pitch-track";
import { IntonationData } from "./tuner";
import QueryParams from "../query-params";
import { resetDom } from "../test-support/dom";
import { installFakeCanvasContext } from "../test-support/fake-canvas";

class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
}

// Time (ms) -> intonation-track index, matching Visualizer's own
// `(60 / intonationData.sampleRate) * 1000` hop-interval math. 600 "points per
// minute" is a round 100ms hop, so index = round(timeMs / 100).
const HOP_MS = 100;
const POINTS_PER_MINUTE = 60000 / HOP_MS;

// Default viewDuration (10000ms) / options.width (800px) from a freshly
// constructed, never-drawn Visualizer: xToTime(x) = x * 12.5, so this is its
// inverse.
const PX_PER_MS = 800 / 10000;
function xFor(timeMs: number): number {
  return timeMs * PX_PER_MS;
}

function fakePoint(name: string): IntonationPoint {
  return { frequency: 440, note: 440, name, cents: 0 };
}

function fakeIntonationData(points: (IntonationPoint | null)[]): IntonationData {
  return { sampleRate: POINTS_PER_MINUTE, points };
}

function mouseEvent(type: string, offsetX: number, offsetY = 0): MouseEvent {
  const evt = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(evt, "offsetX", { value: offsetX, configurable: true });
  Object.defineProperty(evt, "offsetY", { value: offsetY, configurable: true });
  return evt;
}

function enablePitchDetection(): void {
  (document.getElementById("pitch-detection-enabled") as HTMLInputElement).click();
}

let canvas: HTMLCanvasElement;
let tooltip: HTMLElement;

beforeEach(() => {
  resetDom();
  // QueryParams is a module-level singleton resetDom() doesn't touch - without
  // this, a `detectionEnabled` toggle left on by an earlier test (in this file
  // or another) leaks into the next Visualizer's initial checkbox state. Same
  // fix src/test-support/scenario.ts uses.
  QueryParams.replace(new URLSearchParams());
  installFakeCanvasContext();
  canvas = document.getElementById("waveform-canvas") as HTMLCanvasElement;
  tooltip = document.getElementById("pitch-tooltip") as HTMLElement;
});

describe("pitch hover tooltip", () => {
  test("stays hidden until the hover delay elapses, then names the note under the cursor", () => {
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      enablePitchDetection();
      (visualizer as any).intonationData = fakeIntonationData([
        null,
        fakePoint("D#4"), // index 1 -> 100ms -> x = xFor(100)
      ]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(100)));
      expect(tooltip.hidden).toBe(true);

      vi.advanceTimersByTime(999);
      expect(tooltip.hidden).toBe(true);

      vi.advanceTimersByTime(1);
      expect(tooltip.hidden).toBe(false);
      expect(tooltip.textContent).toBe("D#4/Eb4");
    } finally {
      vi.useRealTimers();
    }
  });

  test("tracks the cursor and updates immediately once armed, without re-arming the delay", () => {
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      enablePitchDetection();
      (visualizer as any).intonationData = fakeIntonationData([
        fakePoint("D#4"), // index 0 -> 0ms
        fakePoint("F4"),  // index 1 -> 100ms
      ]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(0)));
      vi.advanceTimersByTime(1000);
      expect(tooltip.textContent).toBe("D#4/Eb4");

      // Moving updates content right away - no further timer advance.
      canvas.dispatchEvent(mouseEvent("mousemove", xFor(100)));
      expect(tooltip.hidden).toBe(false);
      expect(tooltip.textContent).toBe("F4");
    } finally {
      vi.useRealTimers();
    }
  });

  test("mouseleave hides the tooltip and cancels a pending delay", () => {
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      enablePitchDetection();
      (visualizer as any).intonationData = fakeIntonationData([fakePoint("D#4")]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(0)));
      vi.advanceTimersByTime(500);
      canvas.dispatchEvent(new MouseEvent("mouseleave"));

      vi.advanceTimersByTime(1000);
      expect(tooltip.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("stays hidden when pitch detection is off, even after the delay elapses", () => {
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      // detection left off
      (visualizer as any).intonationData = fakeIntonationData([fakePoint("D#4")]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(0)));
      vi.advanceTimersByTime(1000);

      expect(tooltip.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("hides over a gap with no detected pitch, but stays armed for the next position", () => {
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      enablePitchDetection();
      (visualizer as any).intonationData = fakeIntonationData([
        null,             // index 0 -> 0ms: gap
        fakePoint("B2"),  // index 1 -> 100ms
      ]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(0)));
      vi.advanceTimersByTime(1000);
      expect(tooltip.hidden).toBe(true); // armed, but nothing detected here

      // Move into a pitched region - shows immediately, no further delay.
      canvas.dispatchEvent(mouseEvent("mousemove", xFor(100)));
      expect(tooltip.hidden).toBe(false);
      expect(tooltip.textContent).toBe("B2");
    } finally {
      vi.useRealTimers();
    }
  });

  test("does not attach hover listeners in touch mode", () => {
    document.body.classList.add("touch-mode");
    vi.useFakeTimers();
    try {
      const visualizer = new Visualizer(new FakeAudioContext() as unknown as AudioContext);
      enablePitchDetection();
      (visualizer as any).intonationData = fakeIntonationData([fakePoint("D#4")]);

      canvas.dispatchEvent(mouseEvent("mouseenter", xFor(0)));
      vi.advanceTimersByTime(1000);
      canvas.dispatchEvent(mouseEvent("mousemove", xFor(0)));

      expect(tooltip.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
