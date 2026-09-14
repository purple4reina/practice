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

describe("LoudnessAnalyzer.calculateLoudnessFromBuffer tail coverage", () => {
  test("the last data point reaches within one window of the buffer's true end", () => {
    const sampleRate = 44100;
    const windowSize = 1024;
    // A length deliberately NOT a multiple of hopSize (512), so the main hop
    // loop alone would stop well short of the real end.
    const length = 50000;
    const buffer = makeBuffer(new Float32Array(length), sampleRate);

    const data = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer, windowSize);
    const last = data[data.length - 1];

    const trueEndMs = (length / sampleRate) * 1000;
    const windowMs = (windowSize / sampleRate) * 1000;
    expect(last.timestamp).toBeGreaterThan(trueEndMs - windowMs - 1e-6);
    expect(last.timestamp).toBeLessThanOrEqual(trueEndMs - windowMs + 1e-6);
  });

  test("does not duplicate a point when the hop loop already lands exactly on the final window", () => {
    const sampleRate = 44100;
    const windowSize = 1024;
    const hopSize = windowSize / 2;
    const length = windowSize + hopSize * 4; // channelData.length - windowSize is a multiple of hopSize
    const buffer = makeBuffer(new Float32Array(length), sampleRate);

    const data = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer, windowSize);
    const timestamps = data.map(d => d.timestamp);
    expect(new Set(timestamps).size).toBe(timestamps.length);
  });

  test("the appended tail point reflects real audio in that window, not silence", () => {
    const sampleRate = 44100;
    const windowSize = 1024;
    const length = 50000;
    const samples = new Float32Array(length);
    for (let i = length - windowSize; i < length; i++) samples[i] = 0.9 * Math.sin(i);
    const buffer = makeBuffer(samples, sampleRate);

    const data = LoudnessAnalyzer.calculateLoudnessFromBuffer(buffer, windowSize);
    expect(data[data.length - 1].loudness).toBeGreaterThan(LoudnessAnalyzer.SILENCE_THRESHOLD);
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
