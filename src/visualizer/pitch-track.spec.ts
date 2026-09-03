import { expect, describe, test } from "vitest";
import {
  detectPitchTrack,
  frequencyToIntonationPoint,
  IntonationPoint,
} from "./pitch-track";

const SR = 44100;

// Deterministic PRNG so the noisy fixtures below are reproducible run to run.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ToneOptions {
  amp?: number;
  noise?: number; // broadband noise amplitude; a pure math sine is a pathological
  sr?: number;    // input for YIN at low frequencies, real recordings never are
  harmonics?: Array<[number, number]>; // [partial, relativeAmplitude]
}

function tone(freq: number, ms: number, opts: ToneOptions = {}): Float32Array {
  const { amp = 0.5, noise = 0, sr = SR, harmonics = [[1, 1]] } = opts;
  const norm = harmonics.reduce((s, [, a]) => s + a, 0);
  const rand = mulberry32(0x9e3779b9 ^ Math.round(freq));
  const n = Math.floor((ms / 1000) * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const [h, a] of harmonics) {
      s += a * Math.sin((2 * Math.PI * freq * h * i) / sr);
    }
    out[i] = (amp * s) / norm + noise * (rand() * 2 - 1);
  }
  return out;
}

function silence(ms: number, sr = SR): Float32Array {
  return new Float32Array(Math.floor((ms / 1000) * sr));
}

// Clarinet timbre: odd harmonics only, dominant fundamental.
const CLARINET_HARMONICS: Array<[number, number]> = [
  [1, 1.0],
  [3, 0.3],
  [5, 0.15],
  [7, 0.05],
];

function notNull(xs: (IntonationPoint | null)[]): IntonationPoint[] {
  return xs.filter((p): p is IntonationPoint => p !== null);
}

function middle<T>(xs: T[]): T {
  return xs[Math.floor(xs.length / 2)];
}

function centsFrom(freq: number, ref: number): number {
  return Math.abs(1200 * Math.log2(freq / ref));
}

describe("detectPitchTrack", () => {
  test("mid tone (~440 Hz) is detected within a few cents; the adaptive pass is a no-op", () => {
    const data = tone(440, 1500);
    const adaptive = detectPitchTrack(data, { sampleRate: SR });
    const primaryOnly = detectPitchTrack(data, { sampleRate: SR, adaptiveLowRange: false });

    expect(adaptive).toEqual(primaryOnly);

    const pts = notNull(adaptive);
    expect(pts.length).toBeGreaterThan(adaptive.length * 0.8);
    expect(middle(pts).name).toBe("A4");
    expect(Math.abs(middle(pts).cents)).toBeLessThan(10);
  });

  test("staff-range tone (~165 Hz) is detected by the primary pass", () => {
    const primaryOnly = detectPitchTrack(tone(165, 1500), {
      sampleRate: SR,
      adaptiveLowRange: false,
    });
    const pts = notNull(primaryOnly);
    expect(pts.length).toBeGreaterThan(primaryOnly.length * 0.7);
    expect(middle(pts).name).toBe("E3");
  });

  test("low tone (~55 Hz) the primary pass can't place is recovered by the adaptive pass", () => {
    const data = tone(55, 2000, { noise: 0.02, harmonics: CLARINET_HARMONICS });

    // The fast 2048-sample pass cannot resolve this note: it returns null or an
    // out-of-band garbage reading, never a real low frequency.
    const primaryOnly = detectPitchTrack(data, { sampleRate: SR, adaptiveLowRange: false });
    expect(notNull(primaryOnly).some((p) => p.frequency < 130)).toBe(false);

    const adaptive = detectPitchTrack(data, { sampleRate: SR });
    expect(adaptive.length).toBe(primaryOnly.length); // grid unchanged

    const filled = notNull(adaptive).filter((p) => p.frequency >= 45 && p.frequency <= 160);
    expect(filled.length).toBeGreaterThan(adaptive.length * 0.5);
    expect(centsFrom(middle(filled).frequency, 55)).toBeLessThan(15);
    expect(middle(filled).name).toBe("A1");
  });

  test("a real-range low note (Bb1, ~58 Hz) resolves to the right octave", () => {
    const data = tone(58.27, 1800, { noise: 0.015, harmonics: CLARINET_HARMONICS });
    const points = notNull(detectPitchTrack(data, { sampleRate: SR }));
    const low = points.filter((p) => p.frequency >= 45 && p.frequency <= 110);

    expect(low.length).toBeGreaterThan(points.length * 0.5);
    // not an octave (nor a twelfth) off
    expect(low.every((p) => centsFrom(p.frequency, 58.27) < 40)).toBe(true);
    expect(middle(low).name).toBe("A#1");
  });

  test("silence yields no detections", () => {
    const points = detectPitchTrack(silence(1500), { sampleRate: SR });
    expect(points.every((p) => p === null)).toBe(true);
  });

  test("the adaptive pass preserves the grid and never rewrites a primary detection", () => {
    const data = tone(220, 1200, { noise: 0.01 });
    const primaryOnly = detectPitchTrack(data, { sampleRate: SR, adaptiveLowRange: false });
    const adaptive = detectPitchTrack(data, { sampleRate: SR });

    const expectedLength = Math.floor((data.length - 2048) / 512) + 1;
    expect(primaryOnly.length).toBe(expectedLength);
    expect(adaptive.length).toBe(expectedLength);

    const primaryHits = notNull(primaryOnly);
    expect(primaryHits.length).toBeGreaterThan(primaryOnly.length * 0.7);
    primaryOnly.forEach((p, i) => {
      if (p) expect(adaptive[i]).toEqual(p);
    });
  });
});

describe("frequencyToIntonationPoint", () => {
  test("returns null for no detection or out-of-band frequencies", () => {
    expect(frequencyToIntonationPoint(null)).toBeNull();
    expect(frequencyToIntonationPoint(0)).toBeNull();
    expect(frequencyToIntonationPoint(30)).toBeNull();
    expect(frequencyToIntonationPoint(2500)).toBeNull();
  });

  test("names notes across the range, including the bass clarinet's low octave", () => {
    expect(frequencyToIntonationPoint(440)!.name).toBe("A4");
    expect(frequencyToIntonationPoint(55)!.name).toBe("A1");
    expect(frequencyToIntonationPoint(51.9)!.name).toBe("G#1");
  });

  test("reports cents deviation from equal temperament", () => {
    expect(Math.abs(frequencyToIntonationPoint(440)!.cents)).toBeLessThan(0.01);
    const sharp = frequencyToIntonationPoint(452)!; // ~47 cents sharp of A4
    expect(sharp.name).toBe("A4");
    expect(sharp.cents).toBeGreaterThan(40);
  });
});
