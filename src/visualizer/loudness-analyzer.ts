export interface LoudnessData {
  timestamp: number;
  loudness: number; // RMS value 0-1
}

export class LoudnessAnalyzer {
  // RMS threshold above which audio is considered "sound" rather than silence
  static readonly SILENCE_THRESHOLD = 0.02;

  // Pad kept before the detected first sound so playback doesn't start right on the attack
  static readonly LEAD_IN_MS = 100;

  // Calculate loudness from existing audio buffer for playback visualization.
  // startSample lets callers analyze from an offset (e.g. skipping leading silence)
  // without copying the buffer — timestamps come out zero-based from that offset.
  static calculateLoudnessFromBuffer(audioBuffer: AudioBuffer, windowSize = 1024, startSample = 0): LoudnessData[] {
    const channelData = audioBuffer.getChannelData(0).subarray(startSample);
    const sampleRate = audioBuffer.sampleRate;
    const hopSize = windowSize / 2; // 50% overlap
    const loudnessData: LoudnessData[] = [];

    const rmsAt = (start: number): number => {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = channelData[start + j];
        sum += sample * sample;
      }
      return Math.sqrt(sum / windowSize);
    };

    let lastWindowStart = -1;
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      loudnessData.push({ timestamp: (i / sampleRate) * 1000, loudness: rmsAt(i) });
      lastWindowStart = i;
    }

    // The loop above never lands a window on the buffer's final `windowSize`
    // samples (no full window fits past that point), so on its own the curve
    // always falls short of the recording's true end - by design up to a
    // whole hop, and by bad luck up to a whole window. Add one more point for
    // the last full window that *does* fit, so the analyzed range always
    // reaches to within one window of the buffer's actual end, regardless of
    // whether that end lines up on a hop boundary.
    const finalWindowStart = channelData.length - windowSize;
    if (finalWindowStart > lastWindowStart && finalWindowStart >= 0) {
      loudnessData.push({ timestamp: (finalWindowStart / sampleRate) * 1000, loudness: rmsAt(finalWindowStart) });
    }

    return loudnessData;
  }

  // Timestamp (ms) to start playback/visualization at: LEAD_IN_MS before the first
  // window whose loudness crosses threshold, clamped to 0. Returns 0 if the threshold
  // is never crossed (e.g. a silent recording).
  static findFirstSoundMs(audioBuffer: AudioBuffer, threshold = LoudnessAnalyzer.SILENCE_THRESHOLD): number {
    const data = this.calculateLoudnessFromBuffer(audioBuffer);
    const firstLoud = data.find(d => d.loudness >= threshold);
    return firstLoud ? Math.max(0, firstLoud.timestamp - LoudnessAnalyzer.LEAD_IN_MS) : 0;
  }
}
