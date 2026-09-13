import audioBufferToWav from 'audiobuffer-to-wav';
import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];

  public recordSpeed: number;
  public recordingPrelay = 100;  // ms kept before the first click
  public recordPostlay = 350;    // ms kept after the last click
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

    const { firstClickMs, lastClickMs, trailingClicksMs } = this.getRecordDelays();

    // recorder.start() fires this long after the record button; the metronome's
    // first click follows `recordingPrelay` after that.
    this.startRecordingDelay = firstClickMs / this.recordSpeed;

    // Stop the recorder a fixed `recordPostlay` after the last click, measured
    // from the same origin as the metronome (T0 + recordingPrelay). Previously
    // the tail was the final beat's own delay plus the synthetic end-marker,
    // all divided by recordSpeed, so it ballooned at slow record speeds.
    this.stopRecordingDelay =
      this.recordingPrelay + lastClickMs / this.recordSpeed + this.recordPostlay;

    // The recording metronome keeps clicking through any blocks placed after
    // "stop" (they just aren't captured into the audio) - give them their
    // full duration before the whole sequence is torn down, instead of
    // hard-cutting them ~immediately after the recorded material ends.
    this.stopDelay =
      this.stopRecordingDelay + this.recordingPrelay + trailingClicksMs / this.recordSpeed;

    this.latency = latency;
    this.videoEnabled = videoEnabled;
    this.videoLatencyMs = videoLatencyMs;
  }

  // Onset times (unscaled ms, from the start of the click track) of the first
  // and last *recorded* clicks, plus how much click-track time follows the
  // last recorded click (e.g. blocks placed after "stop" but before "done").
  // BlockManager appends a synthetic end-marker as the final click, so it's
  // dropped here.
  private getRecordDelays() {
    const clicks = this.recordClicks.slice(0, -1);

    let firstClickMs = 0;
    let lastClickMs = 0;
    let recordingEndMs = 0; // elapsed time right after the last recorded click
    let elapsed = 0;
    let started = false;
    for (const click of clicks) {
      if (click.recording) {
        if (!started) firstClickMs = elapsed;
        started = true;
        lastClickMs = elapsed;
      }
      elapsed += click.delay;
      if (click.recording) recordingEndMs = elapsed;
    }
    return { firstClickMs, lastClickMs, trailingClicksMs: elapsed - recordingEndMs };
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
