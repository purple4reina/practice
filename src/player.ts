export default class PlayerDevice {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;

  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private onEndedCallback: (() => void) | null = null;
  private startTime: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
  }

  play(buffer: AudioBuffer, playbackRate: number = 1.0, onEnded?: () => void): number {
    this.stop(); // Stop any current playback

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.playbackRate.value = playbackRate;
    this.sourceNode.connect(this.gainNode);

    this.playbackRate = playbackRate;
    this.onEndedCallback = onEnded || null;

    this.sourceNode.onended = () => {
      this.isPlaying = false;
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    };

    const startTime = this.audioContext.currentTime;
    this.startTime = startTime;
    this.sourceNode.start(startTime);
    this.isPlaying = true;

    return startTime;
  }

  stop(): void {
    if (this.sourceNode && this.isPlaying) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
      this.isPlaying = false;
    }
  }
}
