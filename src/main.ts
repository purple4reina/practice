import AudioAnalyzer from "./audio-analyzer";
import Metronome from "./metronome";
import PlayRecordControls from "./play-record-controls";
import PlayerDevice from "./player";
import RecorderDevice from "./recorder";
import WaveformVisualizer, { MetronomeSettings } from "./waveform-visualizer";
import fractionControls from "./fraction-controls";
import { initializeMonitoring, setMonitoredUser } from "./monitoring";

if (window.location.hostname === "purple4reina.github.io") {
  initializeMonitoring();
}

class WebAudioRecorderController {
  private audioContext = new AudioContext();
  private recorder = new RecorderDevice(this.audioContext);
  private player = new PlayerDevice(this.audioContext);
  private recordingMetronome = new Metronome("rec", this.audioContext);
  private playbackMetronome = new Metronome("play", this.audioContext);
  private waveformVisualizer: WaveformVisualizer;

  private playbackSpeed = fractionControls("playback", { initNum: 1, initDen: 4, arrowKeys: true });
  private playRecordControls = new PlayRecordControls();

  constructor() {
    // Initialize waveform visualizer
    const canvas = document.getElementById('waveform-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Waveform canvas not found');
    }
    this.waveformVisualizer = new WaveformVisualizer(canvas, {
      backgroundColor: '#f8f9fa',
      waveformColor: '#a55dfc',
      showGrid: true,
      maxTime: 30000 // 30 seconds
    });

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
    try {
      // Resume AudioContext if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      await this.recorder.reset();
      this.stopMetronomes();
      this.waveformVisualizer.clear(); // Clear visualization when starting new recording
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start metronome immediately if enabled (for count-off and recording)
      if (this.recordingMetronome.enabled()) {
        const startTime = this.audioContext.currentTime;
        this.recordingMetronome.start(startTime, 1);
      }

      setTimeout(() => this.recorder.start(), this.recordingMetronome.countOffMs());
      this.playRecordControls.markRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }

  stopRecording() {
    this.stopMetronomes();
    this.recorder.stop();

    // Analyze the recorded audio buffer and show visualization
    const audioBuffer = this.recorder.getAudioBuffer();
    if (audioBuffer) {
      const loudnessData = AudioAnalyzer.calculateLoudnessFromBuffer(audioBuffer);
      this.waveformVisualizer.setLoudnessData(loudnessData);

      // Set metronome settings for beat markers (use playback metronome settings)
      if (this.playbackMetronome.enabled()) {
        const metronomeSettings: MetronomeSettings = {
          bpm: this.playbackMetronome.bpm(),
          subdivisions: this.playbackMetronome.subdivisions()
        };
        this.waveformVisualizer.setMetronomeSettings(metronomeSettings);
      } else {
        this.waveformVisualizer.setMetronomeSettings(null);
      }
    }

    this.playRecordControls.markStopped();
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
      this.playbackMetronome.start(compensatedStartTime, this.playbackSpeed());
    }

    // The visualization already shows the recorded data from when recording stopped
    // Start playback position animation
    this.waveformVisualizer.startPlayback(this.playbackSpeed());

    this.playRecordControls.markPlaying();
  }

  stopPlaying(): void {
    this.player.stop();
    this.stopMetronomes();
    this.waveformVisualizer.stopPlayback();
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
}
