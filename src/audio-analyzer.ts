export interface LoudnessData {
  timestamp: number;
  loudness: number; // RMS value 0-1
}

export default class AudioAnalyzer {
  private analyzerNode: AnalyserNode;
  private dataArray: Uint8Array;
  private isAnalyzing = false;
  private loudnessHistory: LoudnessData[] = [];
  private startTime = 0;
  private animationFrameId: number | null = null;

  constructor(audioContext: AudioContext, bufferSize = 2048) {
    this.analyzerNode = audioContext.createAnalyser();
    this.analyzerNode.fftSize = bufferSize;
    this.analyzerNode.smoothingTimeConstant = 0.3;
    this.dataArray = new Uint8Array(this.analyzerNode.frequencyBinCount);
  }

  getAnalyzerNode(): AnalyserNode {
    return this.analyzerNode;
  }

  start(): void {
    this.isAnalyzing = true;
    this.startTime = Date.now();
    this.loudnessHistory = [];
    this.analyze();
  }

  stop(): void {
    this.isAnalyzing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.stop();
    this.loudnessHistory = [];
  }

  private analyze(): void {
    if (!this.isAnalyzing) return;

    // Get frequency data
    this.analyzerNode.getByteFrequencyData(this.dataArray);

    // Calculate RMS (Root Mean Square) for loudness
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = this.dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    // Store loudness data with timestamp
    const timestamp = Date.now() - this.startTime;
    this.loudnessHistory.push({
      timestamp,
      loudness: rms
    });

    // Continue analyzing
    this.animationFrameId = requestAnimationFrame(() => this.analyze());
  }

  getLoudnessHistory(): LoudnessData[] {
    return [...this.loudnessHistory]; // Return copy to prevent external mutation
  }

  getCurrentLoudness(): number {
    if (this.loudnessHistory.length === 0) return 0;
    return this.loudnessHistory[this.loudnessHistory.length - 1].loudness;
  }

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
