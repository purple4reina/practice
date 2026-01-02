import BlockManager from "./blocks";
import Drone from "./drone";
import PlayerDevice from "./player";
import RecorderDevice from "./recorder";
import Saves from "./saves";
import Tapper from "./tapper";
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

  // tools
  private tapper = new Tapper();
  private drone = new Drone(this.audioContext);

  private startRecordingTimeout: number = 0;
  private stopRecordingTimeout: number = 0;

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
  }

  private getClipSettings(): ClipSettings {
    return new ClipSettings(
      this.blockManager.recordClicks(),
      this.blockManager.playClicks(),
      this.recordSpeed() / 100,
    );
  }

  async record(): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    await this.recorder.reset();
    this.stopMetronomes();
    this.visualizer.clear();
    await sleep(100);

    this.clipSettings = this.getClipSettings();

    if (this.recordingMetronome.enabled()) {
      const startTime = this.audioContext.currentTime + this.clipSettings.recordingPrelay;
      this.recordingMetronome.start(
        startTime,
        this.clipSettings.recordClicks,
        this.clipSettings.recordSpeed,
        true,
      );
    }

    this.startRecordingTimeout = setTimeout(() => this.recorder.start(), this.clipSettings.startRecordingDelay);
    this.stopRecordingTimeout = setTimeout(() => this.stopRecording(), this.clipSettings.stopDelay);
    this.playRecordControls.markRecording();
  }

  stopRecording() {
    clearTimeout(this.startRecordingTimeout);
    clearTimeout(this.stopRecordingTimeout);
    this.stopMetronomes();
    this.recorder.stop();
    this.playRecordControls.markStopped();

    const audioBuffer = this.recorder.getAudioBuffer();
    if (audioBuffer) {
      this.clip = new Clip(this.clipSettings, audioBuffer);
      this.visualizer.drawVisualization(this.clip);
      sendRecordingEvent({ duration: this.clip.audioBuffer.duration });
      if (this.autoPlay()) {
        setTimeout(() => this.play(), 500);
      }
    }
  }

  play() {
    if (!this.clip?.audioBuffer) {
      console.error("No audio buffer available for playback");
      this.playRecordControls.reset();
      return;
    }

    this.stopMetronomes();

    // Start playback and metronome at the same time
    const startTime = this.player.play(this.clip.audioBuffer, this.playbackSpeed(), () => {
      this.stopPlaying();
    });

    if (this.playbackMetronome.enabled()) {
      // Apply latency compensation scaled by playback rate
      const compensatedStartTime = this.playbackMetronome.getPlaybackStartTime(startTime, this.playbackSpeed());
      const playbackSpeed = this.playbackSpeed() * this.clip.recordSpeed;
      this.playbackMetronome.start(compensatedStartTime, this.clip.playClicks, playbackSpeed, false);
    }

    // The visualization already shows the recorded data from when recording stopped
    // Start playback position animation
    this.visualizer.startPlayback(this.playbackSpeed());

    sendPlaybackEvent({ duration: this.clip.audioBuffer.duration, playbackSpeed: this.playbackSpeed() });

    this.playRecordControls.markPlaying();
  }

  stopPlaying(): void {
    this.player.stop();
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
