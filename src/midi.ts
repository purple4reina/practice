export interface MidiNote {
  frequency: number;
  offsetMs: number;
  durationMs: number;
}

interface ParsedNote {
  frequency: number | null;  // null = rest
  durationBeats: number;     // in beat-units (relative to time sig bottom)
}

// Base MIDI note numbers for C4 octave (middle C = 60)
const BASE_NOTES: { [key: string]: number } = {
  c: 60, d: 62, e: 64, f: 65, g: 67, a: 69, b: 71,
};

// Regex: note-or-rest, octave modifiers, optional duration number, optional dots
const NOTE_REGEX = /^(r|es|[a-g](?:es|is)?)([',]*)(\d+)?(\.*)$/;

export function parseLilypond(text: string, timeSigBottom: number): ParsedNote[] | null {
  const trimmed = text.trim();
  if (trimmed === '') return [];

  const tokens = trimmed.split(/\s+/);
  const notes: ParsedNote[] = [];
  let prevDuration: number | null = null;

  for (const token of tokens) {
    const match = token.match(NOTE_REGEX);
    if (!match) return null;

    const [, notePart, octavePart, durationStr, dotsStr] = match;

    // Parse duration — first note must have an explicit number
    let duration: number;
    if (durationStr !== undefined) {
      duration = parseInt(durationStr, 10);
      if (duration <= 0) return null;
      if ((duration & (duration - 1)) !== 0) return null;  // not power of 2
      prevDuration = duration;
    } else if (prevDuration !== null) {
      duration = prevDuration;
    } else {
      return null;  // first note has no duration: validation error
    }

    // Each dot adds half the value of the previous addition: 1 dot = ×1.5, 2 = ×1.75, …
    const numDots = dotsStr ? dotsStr.length : 0;
    let dotMultiplier = 1;
    for (let i = 0; i < numDots; i++) {
      dotMultiplier += Math.pow(0.5, i + 1);
    }

    const durationBeats = (timeSigBottom / duration) * dotMultiplier;

    // Rest
    if (notePart === 'r') {
      notes.push({ frequency: null, durationBeats });
      continue;
    }

    // Determine note letter and accidental
    let letter: string;
    let accidental = 0;

    if (notePart === 'es') {
      // Special case: 'es' alone = E-flat
      letter = 'e';
      accidental = -1;
    } else if (notePart.endsWith('es')) {
      letter = notePart[0];
      accidental = -1;
    } else if (notePart.endsWith('is')) {
      letter = notePart[0];
      accidental = 1;
    } else {
      letter = notePart;
    }

    if (!(letter in BASE_NOTES)) return null;

    // Compute octave offset
    let octaveOffset = 0;
    for (const c of octavePart) {
      if (c === "'") octaveOffset += 12;
      else if (c === ',') octaveOffset -= 12;
    }

    const midiNote = BASE_NOTES[letter] + accidental + octaveOffset;
    const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

    notes.push({ frequency, durationBeats });
  }

  return notes.length === 0 ? null : notes;
}

export class MidiSequencer {
  private notes: ParsedNote[];
  private noteIndex: number = 0;
  private beatsIntoCurrentNote: number = 0;

  constructor(notes: ParsedNote[]) {
    this.notes = notes;
  }

  // Returns MidiNote events that start during the next one beat-unit.
  // beatDurationMs is the actual wall-clock duration of this beat (ms).
  // Advances internal position by exactly one beat-unit.
  getNotesForBeat(beatDurationMs: number): MidiNote[] {
    const result: MidiNote[] = [];
    let beatPos = 0;  // position within this beat, in beat-units [0, 1)

    while (beatPos < 1 && this.noteIndex < this.notes.length) {
      const currentNote = this.notes[this.noteIndex];
      const beatsRemainingInNote = currentNote.durationBeats - this.beatsIntoCurrentNote;
      const beatsRemainingInBeat = 1 - beatPos;

      // Emit the note only when it starts (beatsIntoCurrentNote === 0)
      if (this.beatsIntoCurrentNote === 0 && currentNote.frequency !== null) {
        result.push({
          frequency: currentNote.frequency,
          offsetMs: beatPos * beatDurationMs,
          durationMs: currentNote.durationBeats * beatDurationMs,
        });
      }

      if (beatsRemainingInNote <= beatsRemainingInBeat) {
        beatPos += beatsRemainingInNote;
        this.beatsIntoCurrentNote = 0;
        this.noteIndex++;
      } else {
        this.beatsIntoCurrentNote += beatsRemainingInBeat;
        beatPos = 1;
      }
    }

    return result;
  }

  get done(): boolean {
    return this.noteIndex >= this.notes.length;
  }
}
