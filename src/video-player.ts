const DRIFT_THRESHOLD_SEC = 0.08;

export default class VideoPlayerDevice {
  private videoElement: HTMLVideoElement;
  private liveStream: MediaStream | null = null;
  private blobUrl: string | null = null;
  private isPlaying: boolean = false;

  // Sync references — set on play()
  private audioContext: AudioContext | null = null;
  private audioStartCtxTime: number = 0;
  private playbackRate: number = 1;

  constructor() {
    this.videoElement = document.getElementById("video-element") as HTMLVideoElement;
  }

  setLiveStream(stream: MediaStream | null): void {
    this.liveStream = stream;
  }

  async play(
    blob: Blob,
    playbackRate: number,
    audioContext: AudioContext,
    audioStartCtxTime: number,
    videoOffsetMs: number,
    videoLatencyMs: number,
  ): Promise<void> {
    this.stop();

    this.audioContext = audioContext;
    this.audioStartCtxTime = audioStartCtxTime;
    this.playbackRate = playbackRate;
    this.isPlaying = true;

    this.blobUrl = URL.createObjectURL(blob);
    this.videoElement.srcObject = null;
    this.videoElement.src = this.blobUrl;
    this.videoElement.muted = true;
    this.videoElement.playbackRate = playbackRate;

    const initialOffsetSec = (videoOffsetMs + videoLatencyMs) / 1000;
    if (initialOffsetSec > 0) {
      this.videoElement.currentTime = initialOffsetSec;
    }

    try {
      await this.videoElement.play();
    } catch (err) {
      console.error("Video playback failed:", err);
      this.stop();
      return;
    }

    this.scheduleDriftCorrection();
  }

  private scheduleDriftCorrection(): void {
    const rVFC = (this.videoElement as any).requestVideoFrameCallback?.bind(this.videoElement);
    if (!rVFC) return;

    const callback = (_now: number, metadata: { mediaTime: number }) => {
      if (!this.isPlaying || !this.audioContext) return;

      const expectedMediaTime = (this.audioContext.currentTime - this.audioStartCtxTime) * this.playbackRate;
      const drift = metadata.mediaTime - expectedMediaTime;

      if (Math.abs(drift) > DRIFT_THRESHOLD_SEC) {
        this.videoElement.currentTime = expectedMediaTime;
      }

      if (this.isPlaying) {
        rVFC(callback);
      }
    };

    rVFC(callback);
  }

  stop(): void {
    if (!this.isPlaying && !this.blobUrl) {
      // Already stopped — but still ensure live preview is showing if we have a stream
      this.restoreLivePreview();
      return;
    }

    this.isPlaying = false;
    try {
      this.videoElement.pause();
    } catch (_) {}

    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    this.videoElement.removeAttribute("src");
    this.videoElement.load();

    this.restoreLivePreview();
  }

  private restoreLivePreview(): void {
    if (this.liveStream && this.videoElement.srcObject !== this.liveStream) {
      this.videoElement.srcObject = this.liveStream;
      this.videoElement.muted = true;
      this.videoElement.playbackRate = 1;
      this.videoElement.play().catch(() => {});
    }
  }
}
