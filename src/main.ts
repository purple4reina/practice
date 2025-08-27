import Metronome from "./metronome";
import PlayerDevice from "./player";
import RecorderDevice from "./recorder";
import fractionControls from "./fraction-controls";
import PlayRecordControls from "./play-record-controls";

class WebAudioRecorderController {
  private audioContext = new AudioContext();
  private recorder = new RecorderDevice(this.audioContext);
  private player = new PlayerDevice(this.audioContext);
  private metronome = new Metronome(this.audioContext);

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
    try {
      // Resume AudioContext if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      await this.recorder.reset();
      this.metronome.stop();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Start metronome immediately if enabled (for count-off and recording)
      if (this.metronome.enabled()) {
        const startTime = this.audioContext.currentTime;
        this.metronome.recordingStart(startTime, 1);
      }

      setTimeout(() => this.recorder.start(), this.metronome.countOffMs());
      this.playRecordControls.markRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }

  stopRecording() {
    this.metronome.stop();
    this.recorder.stop();
    this.playRecordControls.markStopped();
  }

  play() {
    const audioBuffer = this.recorder.getAudioBuffer();
    if (!audioBuffer) {
      console.error("No audio buffer available for playback");
      return;
    }

    // Stop any ongoing metronome first
    this.metronome.stop();

    // Start playback and metronome at the same time
    const startTime = this.player.play(audioBuffer, this.playbackSpeed(), () => {
      this.stopPlaying();
    });

    if (this.metronome.enabled()) {
      // Apply latency compensation scaled by playback rate
      const compensatedStartTime = this.metronome.getPlaybackStartTime(startTime, this.playbackSpeed());
      this.metronome.playingStart(compensatedStartTime, this.playbackSpeed());
    }

    this.playRecordControls.markPlaying();
  }

  stopPlaying(): void {
    this.player.stop();
    this.metronome.stop();
    this.playRecordControls.markStopped();
  }
}

// Initialize the controller when the page is completely loaded
let webAudioController: WebAudioRecorderController;
window.addEventListener("load", () => {
  webAudioController = new WebAudioRecorderController();
})
