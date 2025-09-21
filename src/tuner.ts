import * as pitchfinder from "pitchfinder";

interface IntonationPoint {
  frequency: number;  // frequency of the actual pitch
  note: number;       // frequency of equal temperament pitch
  name: string;       // note name of equal temperament pitch
  cents: number;      // cents from equal temperament
}

export interface IntonationData {
  sampleRate: number;
  points: (IntonationPoint | null)[];
}

export default class Tuner {
  private detectors;
  private maxFrequencyTolerance = 3520;  // 3 octaves above A440
  private sampleRate = 60 * 100;  // every 10ms in bpm

  constructor(audioContext: AudioContext) {
    this.detectors = [
      pitchfinder.YIN({ sampleRate: audioContext.sampleRate }),
    ]; // and/or pitchfinder.AMDF()
  }

  analyze(audioBuffer: AudioBuffer): IntonationData {
    const float32Array = audioBuffer.getChannelData(0);
    const pitches = pitchfinder.frequencies(
      this.detectors, float32Array, { tempo: this.sampleRate, quantization: 1 }
    )
    return {
      sampleRate: this.sampleRate,
      points: pitches.map(f => this.frequencyToIntonationPoint(f)),
    }
  }

  private frequencyToIntonationPoint(frequency: number | null): IntonationPoint | null {
    // algorithm was unable to detect the pitch
    if (!frequency) {
      return null;
    }

    // if above a certain threshold, assume the algorithm was wrong
    if (frequency > this.maxFrequencyTolerance) {
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
    }
  }
}
