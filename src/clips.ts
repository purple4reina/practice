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

    const { firstClickMs, lastClickEndMs } = this.getRecordDelays();

    // recorder.start() fires this long after the record button; the metronome's
    // first click follows `recordingPrelay` after that.
    this.startRecordingDelay = firstClickMs / this.recordSpeed;

    // Stop the recorder a fixed `recordPostlay` after the *end* of the last
    // recorded click's own interval (its onset plus its own delay), measured
    // from the same origin as the metronome (T0 + recordingPrelay). A click's
    // `delay` is the gap before the *next* pulse - for every click except the
    // last one that gap belongs to the next click's lead-in, but for the very
    // last recorded click it's still time that beat/subdivision is meant to be
    // playing. Measuring the postlay from the onset alone (as a previous
    // version of this did) chops off up to a full subdivision's worth of the
    // final recorded beat whenever subdivisions > 1 - e.g. 4 subdivisions with
    // only 1 beat recorded stops 3/4 of a beat early, well before the note
    // even finishes its nominal duration, let alone decays.
    this.stopRecordingDelay =
      this.recordingPrelay + lastClickEndMs / this.recordSpeed + this.recordPostlay;
    this.stopDelay = this.stopRecordingDelay + this.recordingPrelay;

    this.latency = latency;
    this.videoEnabled = videoEnabled;
    this.videoLatencyMs = videoLatencyMs;
  }

  // Onset (unscaled ms, from the start of the click track) of the first
  // *recorded* click, and the point where the last recorded click's own
  // interval ends (its onset + its own delay). BlockManager appends a
  // synthetic end-marker as the final click, so it's dropped here.
  private getRecordDelays() {
    const clicks = this.recordClicks.slice(0, -1);

    let firstClickMs = 0;
    let lastClickEndMs = 0;
    let elapsed = 0;
    let started = false;
    for (const click of clicks) {
      if (click.recording) {
        if (!started) firstClickMs = elapsed;
        started = true;
        lastClickEndMs = elapsed + click.delay;
      }
      elapsed += click.delay;
    }
    return { firstClickMs, lastClickEndMs };
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
