import { expect, describe, test } from "vitest";
import { LoudnessAnalyzer } from "./loudness-analyzer";

function makeBuffer(samples: Float32Array, sampleRate = 44100): AudioBuffer {
  return {
    sampleRate,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
}

function silenceThenTone(silenceMs: number, toneMs: number, sampleRate = 44100): Float32Array {
  const silenceSamples = Math.floor((silenceMs / 1000) * sampleRate);
  const toneSamples = Math.floor((toneMs / 1000) * sampleRate);
  const samples = new Float32Array(silenceSamples + toneSamples);
  for (let i = silenceSamples; i < samples.length; i++) {
    samples[i] = 0.5 * Math.sin(i);
  }
  return samples;
}

describe("LoudnessAnalyzer.findFirstSoundMs", () => {
  test("finds the first sound after leading silence", () => {
    const buffer = makeBuffer(silenceThenTone(500, 200));
    const ms = LoudnessAnalyzer.findFirstSoundMs(buffer);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
  });

  test("returns 0 when the threshold is never crossed", () => {
    const buffer = makeBuffer(new Float32Array(44100)); // 1s of pure silence
    expect(LoudnessAnalyzer.findFirstSoundMs(buffer)).toBe(0);
  });

  test("backs up LEAD_IN_MS before the detected sound", () => {
    const sampleRate = 44100;
    const samples = silenceThenTone(500, 200, sampleRate);
    const buffer = makeBuffer(samples, sampleRate);

    // detect the raw crossing point without the lead-in, by using a threshold
    // just above 0 that still finds the same window, then compare
    const rawData = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer);
    const rawFirstLoud = rawData.find(d => d.loudness >= LoudnessAnalyzer.SILENCE_THRESHOLD)!;

    const ms = LoudnessAnalyzer.findFirstSoundMs(buffer);
    expect(ms).toBe(Math.max(0, rawFirstLoud.timestamp - LoudnessAnalyzer.LEAD_IN_MS));
  });

  test("clamps to 0 when the sound starts within LEAD_IN_MS of the buffer start", () => {
    const buffer = makeBuffer(silenceThenTone(10, 200)); // sound starts ~10ms in
    expect(LoudnessAnalyzer.findFirstSoundMs(buffer)).toBe(0);
  });
});

describe("LoudnessAnalyzer.calculateLoudnessFromBuffer startSample", () => {
  test("produces zero-based timestamps from the given offset", () => {
    const sampleRate = 44100;
    const samples = silenceThenTone(0, 1000, sampleRate); // 1s of tone, no silence
    const buffer = makeBuffer(samples, sampleRate);
    const offsetSamples = Math.floor(sampleRate * 0.3);

    const full = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer);
    const offset = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer, undefined, offsetSamples);

    expect(offset[0].timestamp).toBe(0);
    expect(offset.length).toBeLessThan(full.length);
  });
});
