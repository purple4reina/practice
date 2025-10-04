export interface LoudnessData {
  timestamp: number;
  loudness: number; // RMS value 0-1
}

export default class AudioAnalyzer {
  // Calculate loudness from existing audio buffer for playback visualization
  static calculateLoudnessFromBuffer(audioBuffer: AudioBuffer, windowSize = 1024): LoudnessData[] {
    const channelData = audioBuffer.getChannelData(0);
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
}
