import audioBufferToWav from 'audiobuffer-to-wav';
import { Click } from "./blocks/clicks";

export class ClipSettings {
  public recordClicks: Click[];
  public playClicks: Click[];

  public recordSpeed: number;
  public recordingPrelay = 100;  // ms before first click
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

    const { startRecordingDelay, stopRecordingDelay, stopDelay } = this.getRecordDelays();
    this.startRecordingDelay = startRecordingDelay / this.recordSpeed;
    this.stopRecordingDelay = (stopRecordingDelay / this.recordSpeed) + (this.recordingPrelay * 4);
    this.stopDelay = (stopDelay / this.recordSpeed) + (this.recordingPrelay * 2);

    this.latency = latency;
    this.videoEnabled = videoEnabled;
    this.videoLatencyMs = videoLatencyMs;
  }

  private getRecordDelays() {
    let startRecordingDelay = 0;
    let stopRecordingDelay = 0;
    let stopDelay = 0;
    let started = false;
    let stopped = false;
    for (const click of this.recordClicks) {
      started = started || click.recording;
      stopped = started && !click.recording;
      stopDelay += click.delay;
      if (!stopped) {
        stopRecordingDelay += click.delay;
      }
      if (!click.recording && !started) {
        startRecordingDelay += click.delay;
      }
    }
    return { startRecordingDelay, stopRecordingDelay, stopDelay };
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

  constructor(settings: ClipSettings, audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    this.playClicks = settings.playClicks;
    this.recordSpeed = settings.recordSpeed;
    this.latency = settings.latency;
    this.videoLatencyMs = settings.videoLatencyMs;
  }

  public download() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    const wavArray = audioBufferToWav(this.audioBuffer);
    const wavBlob = new Blob([wavArray], { type: 'audio/wav' });
    this.triggerDownload(wavBlob, `recording-${timestamp}.wav`);

    if (this.videoBlob) {
      this.triggerDownload(this.videoBlob, `recording-${timestamp}.${this.videoFileExtension}`);
    }
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url) }, 1000);
  }
}
