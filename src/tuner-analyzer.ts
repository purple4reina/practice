import * as Tone from "tone";

interface PitchData {
  time: number; // Time in seconds
  frequency: number; // Detected frequency in Hz
  cents: number; // Deviation from equal temperament in cents
  note: string; // Nearest note (e.g., "A4", "C#3")
}

export default class TunerAnalyzer {
  private audioContext: AudioContext;

  private noteNames = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async analyzePitch(audioBuffer: AudioBuffer): Promise<PitchData[]> {
    const results: PitchData[] = [];
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0);

    // Analyze in chunks of ~100ms to get temporal data
    const chunkSize = Math.floor(sampleRate * 0.1); // 100ms chunks
    const hopSize = Math.floor(chunkSize / 4); // 75% overlap

    for (let i = 0; i < channelData.length - chunkSize; i += hopSize) {
      const chunk = channelData.slice(i, i + chunkSize);
      const frequency = this.detectPitchYin(chunk, sampleRate);

      if (frequency > 0) { // Only include valid pitch detections
        const time = i / sampleRate;
        const { note, cents } = this.frequencyToNote(frequency);

        results.push({
          time,
          frequency,
          cents,
          note
        });
      }
    }

    return results;
  }

  // YIN pitch detection algorithm - simplified implementation
  private detectPitchYin(buffer: Float32Array, sampleRate: number): number {
    const threshold = 0.1;
    const yinBuffer = new Float32Array(buffer.length / 2);

    // Step 1: Difference function
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      let sum = 0;
      for (let j = 0; j < yinBuffer.length; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    // Step 2: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] *= tau / runningSum;
    }

    // Step 3: Absolute threshold
    for (let tau = 1; tau < yinBuffer.length; tau++) {
      if (yinBuffer[tau] < threshold) {
        // Parabolic interpolation for better accuracy
        const betterTau = this.parabolicInterpolation(yinBuffer, tau);
        return sampleRate / betterTau;
      }
    }

    return -1; // No pitch found
  }

  private parabolicInterpolation(array: Float32Array, peakIndex: number): number {
    if (peakIndex < 1 || peakIndex >= array.length - 1) {
      return peakIndex;
    }

    const y1 = array[peakIndex - 1];
    const y2 = array[peakIndex];
    const y3 = array[peakIndex + 1];

    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;

    if (a === 0) return peakIndex;

    const xPeak = -b / (2 * a);
    return peakIndex + xPeak;
  }

  private frequencyToNote(frequency: number): { note: string, cents: number } {
    // A4 = 440 Hz is our reference
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75); // C0 frequency

    if (frequency <= 0) return { note: "N/A", cents: 0 };

    // Calculate how many semitones above C0
    const semitonesFromC0 = 12 * Math.log2(frequency / C0);
    const nearestSemitone = Math.round(semitonesFromC0);

    // Calculate cents deviation (100 cents = 1 semitone)
    const cents = Math.round((semitonesFromC0 - nearestSemitone) * 100);

    // Convert semitone to note name
    const octave = Math.floor(nearestSemitone / 12);
    const noteIndex = nearestSemitone % 12;
    const noteName = this.noteNames[noteIndex < 0 ? noteIndex + 12 : noteIndex];

    return {
      note: `${noteName}${octave}`,
      cents
    };
  }

  createVisualizationData(pitchData: PitchData[]): { time: number[], cents: number[], note: string[] } {
    return {
      time: pitchData.map(d => d.time),
      cents: pitchData.map(d => d.cents),
      note: pitchData.map(d => d.note),
    };
  }
}
