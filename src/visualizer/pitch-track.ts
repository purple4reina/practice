import * as pitchfinder from "pitchfinder";

export interface IntonationPoint {
  frequency: number;  // frequency of the actual pitch
  note: number;       // frequency of the nearest equal-temperament pitch
  name: string;       // note name of that equal-temperament pitch (e.g. "A1")
  cents: number;      // cents from equal temperament
}

// --- Primary sliding-window grid ---------------------------------------------
// These MUST stay fixed. IntonationData.sampleRate and the renderers' time
// mapping (visualizer/index.ts) are derived from HOP_SIZE, and this grid is
// aligned index-for-index with the loudness data (loudness-analyzer.ts also
// hops by 512).
export const WINDOW_SIZE = 2048;
export const HOP_SIZE = 512;

// --- Filter band -----------------------------------------------------------
// Detected frequencies outside this band are dropped. This was 140 Hz (from a
// hardcoded "clarinet" preset); bass clarinet's low register sounds concert
// ~52-150 Hz, so 140 discarded most of it. The primary YIN pass physically
// cannot report below ~86 Hz (see below), so lowering this to 45 only re-admits
// real detections that were previously thrown away.
export const MIN_FREQUENCY = 45;
export const MAX_FREQUENCY = 1800;

// --- Adaptive low-range pass ---------------------------------------------------
// pitchfinder's YIN uses the largest power of two <= the input length, then
// halves it, and only reads the front half of that. So a 2048-sample slice is
// analysed as ~1024 samples with a 512-long lag buffer - it cannot resolve
// anything below ~sampleRate/512 (~86 Hz @ 44.1k, ~94 Hz @ 48k). To reach the
// bottom octave of a low-C bass clarinet (concert ~52 Hz) we re-analyse the gaps
// the primary pass left with a large window.
//
// The slice-length boundaries are exact: an input in [4097, 8192] gives a
// 2048-long lag buffer (resolves down to ~21 Hz); 8193+ jumps to 4096 (wasteful
// and reads further into the buffer). Only the front ~4096 samples are read, so
// the slice must START ~2048 samples before the point of interest to centre the
// analysed frame on it.
export const BIG_WINDOW_SIZE = 8192;      // slice length handed to the low detector; never exceed 8192
export const BIG_ANALYZED_FRAME = 4096;   // YIN only reads this many samples from the front
export const BIG_MIN_INPUT = BIG_ANALYZED_FRAME + 1; // 4097 - guarantees the 2048-long lag buffer

// Only write a big-window result back into a gap when it lands in this band -
// the range the primary 2048-sample pass handles poorly or not at all (concert
// pitch from the bottom of a low-C bass clarinet up through its low-mid
// register). The ceiling stays well below where a 3rd-harmonic mistake could
// land (3x the lowest notes), though in practice the big window doesn't make
// octave errors on odd-harmonic (clarinet-family) timbre anyway.
export const LOW_ACCEPT_MIN_HZ = 45;
export const LOW_ACCEPT_MAX_HZ = 150;

// Below this RMS the adaptive pass doesn't bother running the (O(n^2)) large
// window - the frame is silence or noise floor with no pitch to find. This keeps
// the refinement cost proportional to how much low playing there actually is
// rather than to the recording length, and stops room rumble in the rests from
// producing spurious low-note detections. Well under a quiet pianissimo.
export const PITCH_MIN_RMS = 0.005;

export const PRIMARY_YIN_PARAMS = { threshold: 0.15, probabilityThreshold: 0.05 };
// Slightly more permissive: mic-recorded low fundamentals sit in a lot of breath
// and room noise, which gives a shallower dip in YIN's difference function.
export const LOW_YIN_PARAMS = { threshold: 0.2, probabilityThreshold: 0.05 };

export type PitchDetector = (buffer: Float32Array) => number | null;

export function createPitchDetectors(sampleRate: number): {
  detectPitch: PitchDetector;
  detectPitchLow: PitchDetector;
} {
  return {
    detectPitch: pitchfinder.YIN({ sampleRate, ...PRIMARY_YIN_PARAMS }),
    detectPitchLow: pitchfinder.YIN({ sampleRate, ...LOW_YIN_PARAMS }),
  };
}

/**
 * Convert a detected frequency (Hz) to a note name and cents deviation from
 * equal temperament. Returns null when there was no detection or the frequency
 * falls outside [minFrequency, maxFrequency].
 */
export function frequencyToIntonationPoint(
  frequency: number | null,
  minFrequency = MIN_FREQUENCY,
  maxFrequency = MAX_FREQUENCY,
): IntonationPoint | null {
  // algorithm was unable to detect the pitch
  if (!frequency) {
    return null;
  }

  // filter out frequencies outside the expected instrument range
  if (frequency < minFrequency || frequency > maxFrequency) {
    return null;
  }

  // reference pitches
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);

  // determine name
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const stepsFromC0 = Math.round(12 * Math.log2(frequency / C0));
  const noteIndex = stepsFromC0 % 12;
  const octave = Math.floor(stepsFromC0 / 12);
  const name = noteNames[noteIndex < 0 ? noteIndex + 12 : noteIndex];

  // determine note
  const note = C0 * Math.pow(2, stepsFromC0 / 12);

  // determine cents
  const cents = 1200 * Math.log2(frequency / note);

  return {
    frequency: frequency,
    note: note,
    name: `${name}${octave}`,
    cents: cents,
  };
}

export interface DetectPitchTrackOptions {
  sampleRate: number;
  // Detectors are injectable so the Tuner can build them once and reuse them,
  // and so tests can supply their own. If either is omitted both are built here.
  detectPitch?: PitchDetector;
  detectPitchLow?: PitchDetector;
  windowSize?: number;         // default WINDOW_SIZE
  hopSize?: number;            // default HOP_SIZE
  minFrequency?: number;       // default MIN_FREQUENCY
  maxFrequency?: number;       // default MAX_FREQUENCY
  adaptiveLowRange?: boolean;  // default true; false = primary pass only (tests / kill switch)
}

/**
 * Analyse `channelData` and return one intonation point per sliding-window
 * position (spacing = hopSize). The primary pass uses a small, fast window; a
 * second adaptive pass re-analyses only the gaps it left with a large window
 * that can resolve the low fundamentals of bass instruments.
 */
export function detectPitchTrack(
  channelData: Float32Array,
  opts: DetectPitchTrackOptions,
): (IntonationPoint | null)[] {
  const windowSize = opts.windowSize ?? WINDOW_SIZE;
  const hopSize = opts.hopSize ?? HOP_SIZE;
  const minFrequency = opts.minFrequency ?? MIN_FREQUENCY;
  const maxFrequency = opts.maxFrequency ?? MAX_FREQUENCY;
  const { detectPitch, detectPitchLow } = resolveDetectors(opts);

  // Primary pass - defines the grid; unchanged from the original implementation.
  const primary = slidingWindow(channelData, windowSize, hopSize, detectPitch);

  // Adaptive low-range refinement - mutates a copy; run boundaries come from `primary`.
  const freqs = primary.slice();
  if (opts.adaptiveLowRange !== false) {
    refineLowRuns(channelData, freqs, primary, hopSize, detectPitchLow);
  }

  return freqs.map((f) => frequencyToIntonationPoint(f, minFrequency, maxFrequency));
}

function resolveDetectors(opts: DetectPitchTrackOptions): {
  detectPitch: PitchDetector;
  detectPitchLow: PitchDetector;
} {
  if (opts.detectPitch && opts.detectPitchLow) {
    return { detectPitch: opts.detectPitch, detectPitchLow: opts.detectPitchLow };
  }
  const built = createPitchDetectors(opts.sampleRate);
  return {
    detectPitch: opts.detectPitch ?? built.detectPitch,
    detectPitchLow: opts.detectPitchLow ?? built.detectPitchLow,
  };
}

function slidingWindow(
  data: Float32Array,
  windowSize: number,
  hopSize: number,
  detect: PitchDetector,
): (number | null)[] {
  // can't analyse a buffer smaller than one window
  if (data.length < windowSize) {
    return [null];
  }

  const pitches: (number | null)[] = [];
  for (let i = 0; i + windowSize <= data.length; i += hopSize) {
    // subarray is a view, not a copy; YIN never mutates its input
    pitches.push(detect(data.subarray(i, i + windowSize)));
  }
  return pitches;
}

// RMS over the portion of a big-window slice that YIN actually reads.
function frameRms(slice: Float32Array): number {
  const len = Math.min(slice.length, BIG_ANALYZED_FRAME);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += slice[i] * slice[i];
  }
  return len > 0 ? Math.sqrt(sum / len) : 0;
}

// A primary-pass reading is a "gap" that the adaptive pass should try to fill
// when it is null, or when it falls outside the plausible instrument band. The
// latter matters because the fast 2048-sample YIN does not return null on a
// strong sub-86Hz tone - it locks onto a tiny lag and reports garbage in the
// 15-20kHz range - so those positions need refining just as much as true nulls.
function isGap(f: number | null): boolean {
  return f === null || f < MIN_FREQUENCY || f > MAX_FREQUENCY;
}

/**
 * For every run of positions the fast pass couldn't usefully resolve (see
 * isGap), re-analyse with a large window and write any genuinely-low result back
 * into `freqs`. Positions the big window can't place are set to null; everything
 * outside a gap is left untouched.
 */
function refineLowRuns(
  channelData: Float32Array,
  freqs: (number | null)[],
  primary: ReadonlyArray<number | null>,
  hopSize: number,
  detectLow: PitchDetector,
): void {
  const n = primary.length;
  const halfFrame = Math.floor(BIG_ANALYZED_FRAME / 2); // 2048
  // Advance ~halfFrame samples between big-window evaluations. A low-frequency
  // estimate barely moves over that span, so evaluating every grid index would
  // just repeat work. 4 grid indices @ hop 512.
  const stepIndices = Math.max(1, Math.round(halfFrame / hopSize));
  const maxStart = Math.max(0, channelData.length - BIG_WINDOW_SIZE);

  let i = 0;
  while (i < n) {
    if (!isGap(primary[i])) {
      i++;
      continue;
    }

    // maximal run of consecutive gap positions: [runStart, runEnd]
    const runStart = i;
    let runEnd = i;
    while (runEnd + 1 < n && isGap(primary[runEnd + 1])) {
      runEnd++;
    }

    // A gap holds either null or an out-of-band garbage reading; clear the whole
    // run up front, then fill back only what the big window can actually place.
    for (let j = runStart; j <= runEnd; j++) {
      freqs[j] = null;
    }

    let lastStart = -1;
    let lastFreq: number | null = null;

    for (let g = runStart; g <= runEnd; g += stepIndices) {
      // Centre the analysed front frame on sample g*hopSize, clamped to the buffer.
      const evalSample = g * hopSize;
      const start = Math.max(0, Math.min(evalSample - halfFrame, maxStart));

      let f: number | null;
      if (start === lastStart) {
        f = lastFreq; // identical slice (clamped at a buffer edge) - reuse
      } else {
        const slice = channelData.subarray(start, start + BIG_WINDOW_SIZE);
        f =
          slice.length >= BIG_MIN_INPUT && frameRms(slice) >= PITCH_MIN_RMS
            ? detectLow(slice)
            : null;
        lastStart = start;
        lastFreq = f;
      }

      if (f !== null && f >= LOW_ACCEPT_MIN_HZ && f <= LOW_ACCEPT_MAX_HZ) {
        // forward-fill only the indices this evaluation covers, never past runEnd
        const fillEnd = Math.min(runEnd, g + stepIndices - 1);
        for (let j = g; j <= fillEnd; j++) {
          freqs[j] = f;
        }
      }
    }

    i = runEnd + 1;
  }
}
