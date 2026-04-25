import { State } from "./state";

const MIME_TYPE = "video/webm;codecs=vp9";
const FILE_EXTENSION = "webm";

export default class VideoRecorderDevice {
  private videoElement: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private state: State = State.UNKNOWN;

  // Filled in when start() is called and the first frame after start is observed.
  private audioStartPerfTime: number = 0;
  private videoFirstFramePerfTime: number = 0;

  constructor() {
    this.videoElement = document.getElementById("video-element") as HTMLVideoElement;
  }

  async initialize(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { frameRate: { ideal: 120 } },
      audio: false,
    });
    this.videoElement.srcObject = this.stream;
    this.videoElement.muted = true;
    await this.videoElement.play().catch(() => {});
    this.state = State.STOPPED;
  }

  isInitialized(): boolean {
    return this.stream !== null;
  }

  getMediaStream(): MediaStream | null {
    return this.stream;
  }

  getMimeType(): string {
    return MIME_TYPE;
  }

  getFileExtension(): string {
    return FILE_EXTENSION;
  }

  /**
   * Start MediaRecorder. `audioStartPerfTime` is performance.now() at the moment
   * the audio recorder began capturing — used to compute the offset between the
   * captured audio start and the first captured video frame. If `audioStream` is
   * provided, its audio tracks are muxed into the recorded webm alongside video.
   */
  start(audioStartPerfTime: number, audioStream: MediaStream | null = null): void {
    if (!this.stream || this.state === State.RECORDING) return;

    this.chunks = [];
    this.audioStartPerfTime = audioStartPerfTime;
    this.videoFirstFramePerfTime = 0;

    const recordStream = new MediaStream();
    this.stream.getVideoTracks().forEach(t => recordStream.addTrack(t));
    if (audioStream) {
      audioStream.getAudioTracks().forEach(t => recordStream.addTrack(t));
    }

    this.mediaRecorder = new MediaRecorder(recordStream, { mimeType: MIME_TYPE });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    this.mediaRecorder.start();
    this.state = State.RECORDING;

    // Capture the timestamp of the first frame after start. requestVideoFrameCallback
    // fires on the next frame the element renders — close enough to the first frame
    // the MediaRecorder will encode.
    const rVFC = (this.videoElement as any).requestVideoFrameCallback?.bind(this.videoElement);
    if (rVFC) {
      rVFC((now: number) => {
        if (this.videoFirstFramePerfTime === 0) {
          this.videoFirstFramePerfTime = now;
        }
      });
    } else {
      this.videoFirstFramePerfTime = performance.now();
    }
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.state !== State.RECORDING) {
        resolve(null);
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = this.chunks.length > 0 ? new Blob(this.chunks, { type: MIME_TYPE }) : null;
        this.state = State.STOPPED;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  /**
   * Offset (ms) between when audio capture began and when the first video frame
   * after MediaRecorder.start() landed. Apply as initial video.currentTime on
   * playback so audio and video align at the moment audio capture started.
   */
  getVideoOffsetMs(): number {
    if (this.videoFirstFramePerfTime === 0 || this.audioStartPerfTime === 0) return 0;
    return this.audioStartPerfTime - this.videoFirstFramePerfTime;
  }

  reset(): void {
    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== "inactive") this.mediaRecorder.stop();
      } catch (_) {}
      this.mediaRecorder = null;
    }
    this.chunks = [];
    if (this.stream) this.state = State.STOPPED;
  }
}
