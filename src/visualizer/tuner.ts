import * as pitchfinder from "pitchfinder";
import boolSwitchControls from "../bool-switch-controls";

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

export class Tuner {
  private detectPitch: (buffer: Float32Array) => number | null;
  private audioContextSampleRate: number;
  private maxFrequencyTolerance: number = 1800;
  private minFrequencyTolerance: number = 150;
  private windowSize: number = 2048;
  private hopSize: number = 512;

  public enabled = boolSwitchControls("tuner-enabled", { initial: true });

  constructor(audioContext: AudioContext) {
    this.audioContextSampleRate = audioContext.sampleRate;

    // Configure YIN for clarinet family instruments
    this.detectPitch = pitchfinder.YIN({
      sampleRate: audioContext.sampleRate,
      threshold: 0.15,           // More permissive for reliable detection
      probabilityThreshold: 0.05  // Lower probability threshold
    });

    this.setInstrument('clarinet');
  }

  analyze(audioBuffer: AudioBuffer): IntonationData {
    // Calculate the actual temporal sample rate in BPM based on hop size
    // Time between data points = hopSize / audioContextSampleRate (seconds)
    // BPM = 60 / (time between data points) = 60 * audioContextSampleRate / hopSize
    const temporalSampleRate = (60 * this.audioContextSampleRate) / this.hopSize;

    const data: IntonationData = {
      sampleRate: temporalSampleRate,
      points: [],
    }

    if (this.enabled()) {
      const float32Array = audioBuffer.getChannelData(0);
      const pitches = this.slidingWindowAnalysis(float32Array);
      data.points = pitches.map(f => this.frequencyToIntonationPoint(f));
    }

    return data;
  }

  private slidingWindowAnalysis(audioBuffer: Float32Array): (number | null)[] {
    const pitches: (number | null)[] = [];

    // Can't analyze if buffer is smaller than window
    if (audioBuffer.length < this.windowSize) {
      return [null];
    }

    // Slide window across the buffer
    for (let i = 0; i <= audioBuffer.length - this.windowSize; i += this.hopSize) {
      const window = audioBuffer.slice(i, i + this.windowSize);
      const pitch = this.detectPitch(window);
      pitches.push(pitch);
    }

    return pitches;
  }

  private frequencyToIntonationPoint(frequency: number | null): IntonationPoint | null {
    // algorithm was unable to detect the pitch
    if (!frequency) {
      return null;
    }

    // Filter out frequencies outside clarinet range
    if (frequency < this.minFrequencyTolerance || frequency > this.maxFrequencyTolerance) {
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

  // Method to adjust window parameters for different precision/performance tradeoffs
  public setWindowParameters(windowSize: number, hopSize?: number): void {
    this.windowSize = windowSize;
    this.hopSize = hopSize || Math.floor(windowSize / 8); // Default to 1/8 overlap
  }

  // Preset configurations for different use cases
  public setPrecisionMode(mode: 'ultra-high' | 'high' | 'balanced' | 'fast'): void {
    switch(mode) {
      case 'ultra-high':
        // Maximum precision: large window, small hop
        this.setWindowParameters(8192, 256);  // ~186ms window, 32x density
        break;
      case 'high':
        // High precision: large window, medium hop
        this.setWindowParameters(4096, 512);  // ~93ms window, 8x density
        break;
      case 'balanced':
        // Good balance: medium window, medium hop
        this.setWindowParameters(2048, 512);  // ~46ms window, 4x density
        break;
      case 'fast':
        // Fast processing: smaller window, larger hop
        this.setWindowParameters(2048, 1024); // ~46ms window, 2x density
        break;
    }
  }

  // Method to optimize for specific instruments
  public setInstrument(instrument: 'clarinet' | 'bass-clarinet' | 'eb-clarinet' | 'general'): void {
    switch(instrument) {
      case 'bass-clarinet':
        // Bb1 to G6: needs larger windows for low notes
        this.minFrequencyTolerance = 50;   // Bb1 ≈ 58Hz with margin
        this.maxFrequencyTolerance = 1600; // G6 ≈ 1568Hz with margin
        this.setPrecisionMode('high');     // Use larger window for low frequencies
        break;
      case 'clarinet':
        // E3 to A6: standard clarinet range
        this.minFrequencyTolerance = 140;  // D3 ≈ 146.83Hz with margin
        this.maxFrequencyTolerance = 1800; // A6 ≈ 1760Hz with margin
        this.setPrecisionMode('balanced'); // Balanced settings
        break;
      case 'eb-clarinet':
        // G3 to C7: higher range, can use smaller windows
        this.minFrequencyTolerance = 180;  // G3 ≈ 196Hz with margin
        this.maxFrequencyTolerance = 2100; // C7 ≈ 2093Hz with margin
        this.setPrecisionMode('balanced'); // Balanced settings
        break;
      default:
        // Full range for all clarinets
        this.minFrequencyTolerance = 50;
        this.maxFrequencyTolerance = 2100;
        this.setPrecisionMode('high');     // High precision for full range
    }
  }
}
