// Pure music maths for the intonation trainer. No DOM, no audio.

// Bb clarinet: written pitch is a major 2nd above the sounding pitch.
export const TRANSPOSE_SEMITONES = 2;

// Written range, low E (below the staff) to high A (the A an octave above the
// A above the staff). MIDI numbers, C4 = 60.
export const WRITTEN_MIN = 52; // E3
export const WRITTEN_MAX = 93; // A6

// Sounding pitch of the reference tone is kept in a comfortable range.
const REF_MIN = 36; // C2
const REF_MAX = 96; // C7

export interface IntervalType {
  label: string;
  semitones: number[]; // simple intervals this type may use (0 = unison)
  octaves: number;     // reference may also be up to this many extra octaves away
}

export const INTERVAL_TYPES: IntervalType[] = [
  { label: "Unison / Octave", semitones: [0], octaves: 3 },
  { label: "5ths / 4ths", semitones: [7, 5], octaves: 0 },
  { label: "Major 3rds / Minor 6ths", semitones: [4, 8], octaves: 0 },
  { label: "Minor 3rds / Major 6ths", semitones: [3, 9], octaves: 0 },
];

// Just-intonation ratio (upper note / lower note) for each simple interval.
const JUST_RATIO: Record<number, number> = {
  0: 1, 3: 6 / 5, 4: 5 / 4, 5: 4 / 3, 7: 3 / 2, 8: 8 / 5, 9: 5 / 3,
};

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function centsBetween(freq: number, ref: number): number {
  return 1200 * Math.log2(freq / ref);
}

// Ratio for an interval of `semitones` (a simple interval plus whole octaves).
export function justRatio(semitones: number): number {
  return JUST_RATIO[semitones % 12] * Math.pow(2, Math.floor(semitones / 12));
}

export interface Exercise {
  writtenMidi: number;   // note shown on the staff
  soundingMidi: number;  // what the clarinet actually sounds (equal-tempered name)
  refFreq: number;       // the tone we play; anchored to equal temperament, like another instrument
  targetFreq: number;    // the just-intonation pitch the player should hit
  targetCents: number;   // targetFreq relative to the equal-tempered soundingMidi
  semitones: number;     // size of the interval
  refAbove: boolean;     // reference is above the player's note
}

// Bell curve (Box-Muller) over the written range, centred mid-register.
export function randomWrittenNote(rng: () => number = Math.random): number {
  const mean = (WRITTEN_MIN + WRITTEN_MAX) / 2;
  const sd = 8;
  for (;;) {
    const u = 1 - rng();
    const v = rng();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const note = Math.round(mean + sd * z);
    if (note >= WRITTEN_MIN && note <= WRITTEN_MAX) return note;
  }
}

// `usedPitchClasses` are the played (written) pitch classes, 0-11, already taken
// this session; the player's note never repeats one, whatever the octave.
export function pickExercise(
  type: IntervalType,
  rng: () => number = Math.random,
  usedPitchClasses: ReadonlySet<number> = new Set(),
): Exercise {
  for (;;) {
    const writtenMidi = randomWrittenNote(rng);
    if (usedPitchClasses.has(writtenMidi % 12)) continue;
    const soundingMidi = writtenMidi - TRANSPOSE_SEMITONES;
    const base = type.semitones[Math.floor(rng() * type.semitones.length)];
    const semitones = base + 12 * Math.floor(rng() * (type.octaves + 1));
    const refAbove = rng() < 0.5;
    const refMidi = soundingMidi + (refAbove ? semitones : -semitones);
    if (refMidi < REF_MIN || refMidi > REF_MAX) continue;

    const refFreq = midiToFreq(refMidi);
    const ratio = justRatio(semitones);
    const targetFreq = refAbove ? refFreq / ratio : refFreq * ratio;
    return {
      writtenMidi, soundingMidi, refFreq, targetFreq, semitones, refAbove,
      targetCents: centsBetween(targetFreq, midiToFreq(soundingMidi)),
    };
  }
}

// Round 0: always a unison on concert A (440 Hz), i.e. written B4 on Bb clarinet.
export function tuningExercise(): Exercise {
  const soundingMidi = 69;
  return {
    writtenMidi: soundingMidi + TRANSPOSE_SEMITONES, soundingMidi,
    refFreq: 440, targetFreq: 440, targetCents: 0, semitones: 0, refAbove: false,
  };
}

// Cents error folded to the nearest octave, so a pitch detector's octave slip
// doesn't count as a 1200 cent miss.
export function foldedCents(freq: number, target: number): number {
  const c = centsBetween(freq, target);
  return c - 1200 * Math.round(c / 1200);
}

export const MIN_SCORED_FRAMES = 5;

// Frames further than this from the median error are treated as detector
// glitches (e.g. the mic hearing the reference tone) and left out of the average.
const OUTLIER_CENTS = 50;

// Mean signed cents (+ sharp, - flat) over the frames that agree with the
// median, or null if there weren't enough agreeing frames to call it a note.
export function scoreFrames(freqs: number[], target: number): number | null {
  if (freqs.length < MIN_SCORED_FRAMES) return null;
  const cents = freqs.map(f => foldedCents(f, target));
  const sorted = [...cents].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const kept = cents.filter(c => Math.abs(c - median) <= OUTLIER_CENTS);
  if (kept.length < MIN_SCORED_FRAMES || kept.length < cents.length / 2) return null;
  return kept.reduce((s, c) => s + c, 0) / kept.length;
}

// --- Notation -----------------------------------------------------------------

const SPELLING: [string, string][] = [
  ["C", ""], ["D", "b"], ["D", ""], ["E", "b"], ["E", ""], ["F", ""],
  ["F", "#"], ["G", ""], ["A", "b"], ["A", ""], ["B", "b"], ["B", ""],
];
const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

export interface StaffNote {
  letter: string;
  accidental: "" | "#" | "b";
  octave: number;
  step: number; // diatonic steps from C0; E4 (bottom treble line) = 30
}

export function staffNote(midi: number): StaffNote {
  const [letter, accidental] = SPELLING[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return {
    letter, accidental: accidental as "" | "#" | "b", octave,
    step: octave * 7 + LETTER_INDEX[letter],
  };
}

export function noteName(midi: number): string {
  const n = staffNote(midi);
  return `${n.letter}${n.accidental}${n.octave}`;
}
