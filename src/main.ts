import BlockManager from "./blocks";
import Drone from "./drone";
import LatencyCompensator from "./latency";
import PlayerDevice from "./player";
import RecorderDevice from "./recorder";
import Saves from "./saves";
import Tapper from "./tapper";
import VideoPlayerDevice from "./video-player";
import VideoRecorderDevice from "./video-recorder";
import Visualizer from "./visualizer";
import googleLogin from "./login";
import {
  ClipSettings,
  Clip,
} from "./clips";
import {
  PlayRecordControls,
  boolSwitchControls,
  fractionControls,
  slideControls,
} from "./controls";
import {
  RecordingMetronome,
  PlaybackMetronome,
} from "./metronome";
import {
  initializeMonitoring,
  sendPlaybackEvent,
  sendRecordingEvent,
} from "./monitoring";
import {
  sleep,
} from "./utils";

if (window.location.hostname === "purple4reina.github.io") {
  initializeMonitoring();
  googleLogin();
}

class WebAudioRecorderController {
  private audioContext = new AudioContext();
  private recorder = new RecorderDevice(this.audioContext);
  private player = new PlayerDevice(this.audioContext);
  private blockManager = new BlockManager();
  private recordingMetronome = new RecordingMetronome(this.audioContext);
  private playbackMetronome = new PlaybackMetronome(this.audioContext);
  private visualizer = new Visualizer(this.audioContext);
  private audioLatencyCompensator = new LatencyCompensator("audio-latency-compensator", "latency-compensation", 145);
  private videoLatencyCompensator = new LatencyCompensator("video-latency-compensator", "video-latency-compensation", 0);
  private videoRecorder = new VideoRecorderDevice();
  private videoPlayer = new VideoPlayerDevice();

  // tools
  private tapper = new Tapper();
  private drone = new Drone(this.audioContext);

  private startRecordingTimeout: number = 0;
  private stopRecordingTimeout: number = 0;
  private stopTimeout: number = 0;
  private videoStopPromise: Promise<Blob | null> | null = null;

  private clipSettings: ClipSettings;
  private clip: Clip | null = null;

  private recordSpeed = slideControls("rec-speed", {
    initial: 100,
    min: 0,
    max: 100,
    step: 1,
    valueSuffix: "%",
    label: "Recording Speed",
  });
  private playbackSpeed = fractionControls("playback", { initNum: 1, initDen: 4, arrowKeys: true });
  private playRecordControls = new PlayRecordControls();
  private autoPlay = boolSwitchControls("auto-play", { initial: true });
  private videoEnabled = boolSwitchControls("video-enabled", { initial: false });

  constructor() {
    this.playRecordControls.initializeEventListeners({
      record: this.record.bind(this),
      stopRecording: this.stopRecording.bind(this),
      play: this.play.bind(this),
      stopPlaying: this.stopPlaying.bind(this),
    });
    this.recorder.initialize().catch(error => {
      console.error("Failed to initialize recorder:", error);
    });
    this.clipSettings = this.getClipSettings();

    document.getElementById("download")?.addEventListener("click", () => {
      this.clip ? this.clip.download() : console.error("No clip available for download");
    });

    this.setupVideoToggle();
    this.setupVideoExpandButton();
  }

  private setupVideoToggle(): void {
    const videoToggle = document.getElementById("video-enabled") as HTMLInputElement | null;
    if (!videoToggle) return;
    videoToggle.addEventListener("click", () => this.handleVideoToggle());
    if (this.videoEnabled()) {
      this.handleVideoToggle();
    }
  }

  private async handleVideoToggle(): Promise<void> {
    const videoCol = document.getElementById("video-col");
    if (this.videoEnabled()) {
      if (!this.videoRecorder.isInitialized()) {
        try {
          await this.videoRecorder.initialize();
          this.videoPlayer.setLiveStream(this.videoRecorder.getMediaStream());
        } catch (err) {
          console.error("Failed to initialize video recorder:", err);
          const toggle = document.getElementById("video-enabled") as HTMLInputElement;
          toggle.checked = false;
          toggle.dispatchEvent(new Event("click"));
          return;
        }
      }
      if (videoCol) videoCol.hidden = false;
    } else {
      if (videoCol) videoCol.hidden = true;
      this.setVideoExpanded(false);
    }
  }

  private setupVideoExpandButton(): void {
    const btn = document.getElementById("video-expand-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const videoCol = document.getElementById("video-col");
      const isExpanded = videoCol?.classList.contains("expanded") ?? false;
      this.setVideoExpanded(!isExpanded);
    });
  }

  private setVideoExpanded(expanded: boolean): void {
    const videoCol = document.getElementById("video-col");
    const btnIcon = document.querySelector("#video-expand-toggle i");
    if (!videoCol) return;
    videoCol.classList.toggle("expanded", expanded);
    document.body.classList.toggle("video-expanded", expanded);
    if (btnIcon) {
      btnIcon.classList.toggle("bi-fullscreen", !expanded);
      btnIcon.classList.toggle("bi-fullscreen-exit", expanded);
    }
  }

  private getClipSettings(): ClipSettings {
    return new ClipSettings(
      this.blockManager.recordClicks(),
      this.blockManager.playClicks(),
      this.recordSpeed() / 100,
      this.audioLatencyCompensator.getLatency(),
      this.videoEnabled() && this.videoRecorder.isInitialized(),
      this.videoLatencyCompensator.getLatency(),
    );
  }

  async record(): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.videoPlayer.stop();
    await this.recorder.reset();
    this.videoRecorder.reset();
    this.videoStopPromise = null;
    this.stopMetronomes();
    this.visualizer.clear();
    await sleep(100);

    this.clipSettings = this.getClipSettings();

    this.recordingMetronome.start(this.audioContext.currentTime, this.clipSettings);

    this.startRecordingTimeout = setTimeout(() => {
      const audioStartPerfTime = performance.now();
      this.recorder.start();
      if (this.clipSettings.videoEnabled) {
        this.videoRecorder.start(audioStartPerfTime);
      }
    }, this.clipSettings.startRecordingDelay);
    this.stopRecordingTimeout = setTimeout(() => {
      this.recorder.stop();
      if (this.clipSettings.videoEnabled && !this.videoStopPromise) {
        this.videoStopPromise = this.videoRecorder.stop();
      }
    }, this.clipSettings.stopRecordingDelay);
    this.stopTimeout = setTimeout(() => this.stopRecording(), this.clipSettings.stopDelay);
    this.playRecordControls.markRecording();
  }

  async stopRecording() {
    clearTimeout(this.startRecordingTimeout);
    clearTimeout(this.stopRecordingTimeout);
    clearTimeout(this.stopTimeout);
    // ensure recorder is stopped, when space bar hit before stop recorder detay
    this.recorder.stop();
    this.stopMetronomes();
    this.playRecordControls.markStopped();

    if (this.clipSettings.videoEnabled && !this.videoStopPromise) {
      this.videoStopPromise = this.videoRecorder.stop();
    }
    const videoBlob = this.videoStopPromise ? await this.videoStopPromise : null;
    this.videoStopPromise = null;

    const audioBuffer = this.recorder.getAudioBuffer();
    if (audioBuffer) {
      this.clip = new Clip(this.clipSettings, audioBuffer);
      if (videoBlob) {
        this.clip.videoBlob = videoBlob;
        this.clip.videoOffsetMs = this.videoRecorder.getVideoOffsetMs();
        this.clip.videoFileExtension = this.videoRecorder.getFileExtension();
      }
      sendRecordingEvent({ duration: this.clip.audioBuffer.duration });
    }
    if (this.clip) {
      this.visualizer.drawVisualization(this.clip);
    }
    if (audioBuffer && this.autoPlay()) {
      setTimeout(() => this.play(), 500);
    }
  }

  play() {
    if (!this.clip?.audioBuffer) {
      console.error("No audio buffer available for playback");
      this.playRecordControls.reset();
      return;
    }

    this.stopMetronomes();

    const playbackSpeed = this.playbackSpeed();
    const startTime = this.player.play(this.clip.audioBuffer, playbackSpeed, () => {
      this.stopPlaying();
    });

    this.playbackMetronome.start(startTime, this.clip, playbackSpeed);

    if (this.clip.videoBlob) {
      this.videoPlayer.play(
        this.clip.videoBlob,
        playbackSpeed,
        this.audioContext,
        startTime,
        this.clip.videoOffsetMs,
        this.clip.videoLatencyMs,
      ).catch(err => console.error("Video playback error:", err));
    }

    this.visualizer.startPlayback(playbackSpeed);
    sendPlaybackEvent({ duration: this.clip.audioBuffer.duration, playbackSpeed });
    this.playRecordControls.markPlaying();
  }

  stopPlaying(): void {
    this.player.stop();
    this.videoPlayer.stop();
    this.stopMetronomes();
    this.visualizer.stopPlayback();
    this.playRecordControls.markStopped();
  }

  private stopMetronomes() {
    this.recordingMetronome.stop();
    this.playbackMetronome.stop();
  }
}

// Initialize the controller when the page is completely loaded
let webAudioController: WebAudioRecorderController;
let saves: Saves;
window.addEventListener("load", () => {
  webAudioController = new WebAudioRecorderController();
  saves = new Saves();
})
