import { expect, describe, test, beforeEach, vi } from "vitest";

const { createPitchDetectors, detectPitchTrack } = vi.hoisted(() => ({
  createPitchDetectors: vi.fn(() => ({ detectPitch: vi.fn(), detectPitchLow: vi.fn() })),
  detectPitchTrack: vi.fn((_data: Float32Array, _opts?: unknown) => [{ frequency: 440, cents: 0, name: "A4" }]),
}));

vi.mock("./pitch-track", () => ({
  HOP_SIZE: 512,
  createPitchDetectors,
  detectPitchTrack,
}));

import { Tuner } from "./tuner";

function fakeAudioBuffer(samples: number[]): AudioBuffer {
  const data = new Float32Array(samples);
  return { getChannelData: () => data } as unknown as AudioBuffer;
}

beforeEach(() => {
  document.body.innerHTML = `
    <input id="tuner-enabled" type="checkbox">
    <input id="pitch-detection-enabled" type="checkbox">
  `;
  createPitchDetectors.mockClear();
  detectPitchTrack.mockClear();
});

describe("Tuner", () => {
  test("initializes pitch detectors from the audio context's sample rate", () => {
    new Tuner({ sampleRate: 48000 } as AudioContext);
    expect(createPitchDetectors).toHaveBeenCalledWith(48000);
  });

  test("analyze() skips pitch detection entirely when both toggles are off", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    const result = tuner.analyze(fakeAudioBuffer([0, 0, 0]));

    expect(detectPitchTrack).not.toHaveBeenCalled();
    expect(result.points).toEqual([]);
  });

  test("analyze() runs detection when the tuner toggle is on", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    (document.getElementById("tuner-enabled") as HTMLInputElement).click();

    const result = tuner.analyze(fakeAudioBuffer([1, 2, 3]));

    expect(detectPitchTrack).toHaveBeenCalledTimes(1);
    expect(result.points).toEqual([{ frequency: 440, cents: 0, name: "A4" }]);
  });

  test("analyze() runs detection when only the pitch-detection toggle is on", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    (document.getElementById("pitch-detection-enabled") as HTMLInputElement).click();

    tuner.analyze(fakeAudioBuffer([1, 2, 3]));

    expect(detectPitchTrack).toHaveBeenCalledTimes(1);
  });

  test("passes a channel-data subarray starting at startSample", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    (document.getElementById("tuner-enabled") as HTMLInputElement).click();

    tuner.analyze(fakeAudioBuffer([10, 20, 30, 40]), 2);

    const [channelDataArg] = detectPitchTrack.mock.calls[0];
    expect([...channelDataArg]).toEqual([30, 40]);
  });

  test("reports sampleRate as points-per-minute derived from HOP_SIZE", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    const result = tuner.analyze(fakeAudioBuffer([0]));
    expect(result.sampleRate).toBeCloseTo((60 * 44100) / 512, 6);
  });

  test("warns when pitch analysis takes unusually long", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    (document.getElementById("tuner-enabled") as HTMLInputElement).click();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const nowSpy = vi.spyOn(performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2500); // 2.5s elapsed - over the 2000ms warn threshold

    tuner.analyze(fakeAudioBuffer([1, 2, 3]));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Pitch analysis took 2500ms"));
    warnSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test("does not warn for a fast analysis", () => {
    const tuner = new Tuner({ sampleRate: 44100 } as AudioContext);
    (document.getElementById("tuner-enabled") as HTMLInputElement).click();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    tuner.analyze(fakeAudioBuffer([1, 2, 3]));

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
