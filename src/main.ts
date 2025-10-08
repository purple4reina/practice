import BlockManager from "./blocks";
import Drone from "./drone";
import PlayRecordControls from "./play-record-controls";
import PlayerDevice from "./player";
import RecorderDevice from "./recorder";
import Tapper from "./tapper";
import Visualizer, { MetronomeSettings } from "./visualizer";
import fractionControls from "./fraction-controls";
import {
  RecordingMetronome,
  PlaybackMetronome,
} from "./metronome";
import {
  initializeMonitoring,
  setMonitoredUser,
  sendPlaybackEvent,
  sendRecordingEvent,
} from "./monitoring";

if (window.location.hostname === "purple4reina.github.io") {
  initializeMonitoring();
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

  private playbackSpeed = fractionControls("playback", { initNum: 1, initDen: 4, arrowKeys: true });
  private playRecordControls = new PlayRecordControls();

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
  }

  async record(): Promise<void> {
    // Resume AudioContext if suspended
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    await this.recorder.reset();
    this.stopMetronomes();
    this.visualizer.clear(); // Clear visualization when starting new recording
    await new Promise(resolve => setTimeout(resolve, 100));

    if (this.recordingMetronome.enabled()) {
      const startTime = this.audioContext.currentTime;
      const clickGen = this.blockManager.clickIntervalGen("record");
      this.recordingMetronome.start(startTime, clickGen, 1, true);
    }

    setTimeout(() => this.recorder.start(), this.blockManager.recordingDelay());
    this.playRecordControls.markRecording();
  }

  stopRecording() {
    this.stopMetronomes();
    this.recorder.stop();
    this.playRecordControls.markStopped();

    // Analyze the recorded audio buffer and show visualization
    const audioBuffer = this.recorder.getAudioBuffer();
    if (audioBuffer) {
      const clickGen = this.blockManager.clickIntervalGen("play");
      this.visualizer.drawVisualization(audioBuffer, clickGen);

      sendRecordingEvent({ duration: audioBuffer.duration });
    }
  }

  play() {
    const audioBuffer = this.recorder.getAudioBuffer();
    if (!audioBuffer) {
      console.error("No audio buffer available for playback");
      return;
    }

    this.stopMetronomes();

    // Start playback and metronome at the same time
    const startTime = this.player.play(audioBuffer, this.playbackSpeed(), () => {
      this.stopPlaying();
    });

    if (this.playbackMetronome.enabled()) {
      // Apply latency compensation scaled by playback rate
      const compensatedStartTime = this.playbackMetronome.getPlaybackStartTime(startTime, this.playbackSpeed());
      const clickGen = this.blockManager.clickIntervalGen("play");
      this.playbackMetronome.start(compensatedStartTime, clickGen, this.playbackSpeed(), false);
    }

    // The visualization already shows the recorded data from when recording stopped
    // Start playback position animation
    this.visualizer.startPlayback(this.playbackSpeed());

    sendPlaybackEvent({ duration: audioBuffer.duration, playbackSpeed: this.playbackSpeed() });

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
window.addEventListener("load", () => {
  webAudioController = new WebAudioRecorderController();
})

declare global {
  interface Window {
    loginCallback: (resp: any) => void;
  }
}

window.loginCallback = function(resp: any) {
  // https://developers.google.com/identity/gsi/web/reference/js-reference#credential
  const decodeJwtResponse = function(token: any) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  }
  const data = decodeJwtResponse(resp.credential);
  setMonitoredUser(data.name, data.email, data.sub);
  (document.getElementById('user') as HTMLElement).innerText = `Welcome ${data.given_name}`;
}
