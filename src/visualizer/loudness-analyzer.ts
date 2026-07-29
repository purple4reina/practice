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

    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      // Calculate RMS for this window
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        const sample = channelData[i + j];
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / windowSize);

      // Convert sample position to timestamp in milliseconds
      const timestamp = (i / sampleRate) * 1000;

      loudnessData.push({
        timestamp,
        loudness: rms
      });
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
