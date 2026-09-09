import audioBufferToWav from 'audiobuffer-to-wav';
import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];

  public recordSpeed: number;
  // Dead air held at each end of the clip: `recordingPrelay` ms of lead-in
  // before the first recorded click, and the same fixed amount of tail after the
  // last one. Kept in real time (not divided by recordSpeed) so the tail stays
  // constant no matter how far the record speed is slowed down.
  public recordingPrelay = 100;
  public startRecordingDelay: number;
  public stopRecordingDelay: number;
  public stopDelay: number;
  public latency: number;
  public videoEnabled: boolean;
  public videoLatencyMs: number;

  constructor(
    recordClicks: Click[],
    playClicks: Click[],
    recordSpeed: number,
    latency: number,
    videoEnabled: boolean = false,
    videoLatencyMs: number = 0,
  ) {
    this.recordClicks = recordClicks;
    this.playClicks = playClicks;
    this.recordSpeed = recordSpeed;

    const { firstClickMs, lastClickMs, coolDownEndMs } = this.getRecordSpan();

    // recorder.start() runs this long after the record button; the metronome's
    // first click lands `recordingPrelay` later (see RecordingMetronome.start),
    // so the clip opens with exactly `recordingPrelay` of lead-in.
    this.startRecordingDelay = firstClickMs / this.recordSpeed;

    // Stop the recorder `recordingPrelay` after the last recorded click, so the
    // tail mirrors the lead-in instead of running on for whatever delay the
    // final block happened to carry (÷ record speed) plus the synthetic marker.
    this.stopRecordingDelay =
      lastClickMs / this.recordSpeed + this.recordingPrelay * 2;

    // Finalize (draw + optional autoplay) just after the recorder stops, but not
    // before any un-recorded cool-down clicks have finished playing.
    this.stopDelay = Math.max(
      this.stopRecordingDelay + this.recordingPrelay,
      coolDownEndMs / this.recordSpeed + this.recordingPrelay * 2,
    );

    this.latency = latency;
    this.videoEnabled = videoEnabled;
    this.videoLatencyMs = videoLatencyMs;
  }

  // Timeline landmarks the record window is built from, in unscaled ms measured
  // from the start of the click track:
  //  - firstClickMs / lastClickMs: the first and last clicks that are actually
  //    recorded (the synthetic tail marker from BlockManager is ignored).
  //  - coolDownEndMs: the last un-recorded click that still plays after recording
  //    stops (a "Stop Recording" block followed by more beats); falls back to
  //    lastClickMs when there is no cool-down.
  private getRecordSpan() {
    let firstClickMs = 0;
    let lastClickMs = 0;
    let coolDownEndMs = 0;
    let elapsed = 0;
    let sawRecording = false;
    for (const click of this.recordClicks) {
      if (click.tail) continue;
      if (click.recording) {
        if (!sawRecording) firstClickMs = elapsed;
        sawRecording = true;
        lastClickMs = elapsed;
        coolDownEndMs = elapsed;
      } else if (sawRecording) {
        coolDownEndMs = elapsed;
      }
      elapsed += click.delay;
    }
    return { firstClickMs, lastClickMs, coolDownEndMs };
  }
}

export class Clip {
  public audioBuffer: AudioBuffer;
  public playClicks: Click[];
  public recordSpeed: number;
  public latency: number = 0;
  public videoBlob: Blob | null = null;
  public videoOffsetMs: number = 0;
  public videoLatencyMs: number = 0;
  public videoFileExtension: string = "webm";
  public silenceOffsetMs: number = 0;
  public scheduledDurationMs: number;

  constructor(settings: ClipSettings, audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    this.playClicks = settings.playClicks;
    this.recordSpeed = settings.recordSpeed;
    this.latency = settings.latency;
    this.videoLatencyMs = settings.videoLatencyMs;
    this.scheduledDurationMs = settings.stopRecordingDelay - settings.startRecordingDelay;
  }

  public download() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    const wavArray = audioBufferToWav(this.audioBuffer, { float32: true });
    const wavBlob = new Blob([wavArray], { type: 'audio/wav' });
    this.triggerDownload(wavBlob, `recording-${timestamp}.wav`);

    if (this.videoBlob) {
      this.triggerDownload(this.videoBlob, `recording-${timestamp}.${this.videoFileExtension}`);
    }
  }

  private async triggerDownload(blob: Blob, filename: string) {
    if (import.meta.env.MODE === 'ios') {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url) }, 1000);
  }
}
