import { State } from "../state";

export default class PlayRecordControls {
  private recordIcon = document.getElementById("record");
  private recordingIcon = document.getElementById("recording");
  private playIcon = document.getElementById("play");
  private playingIcon = document.getElementById("playing");

  private state: State = State.STOPPED;
  private nextState: State = State.RECORDING;

  private offCanvass: boolean = false;

  constructor() {
    this.showControls([this.recordIcon]);
  }

  initializeEventListeners(callbacks: { record: () => void, stopRecording: () => void, play: () => void, stopPlaying: () => void }): void {
    this.recordIcon?.addEventListener("click", callbacks.record.bind(this));
    this.recordingIcon?.addEventListener("click", callbacks.stopRecording.bind(this));
    this.playIcon?.addEventListener("click", callbacks.play.bind(this));
    this.playingIcon?.addEventListener("click", callbacks.stopPlaying.bind(this));

    document.addEventListener("keydown", (e) => {
      if (this.offCanvass) return;
      if (e.key === " ") {
        e.preventDefault();
        if (this.state === State.RECORDING) {
          callbacks.stopRecording();
        } else if (this.state === State.PLAYING) {
          callbacks.stopPlaying();
        } else if (this.state === State.STOPPED) {
          if (this.nextState === State.RECORDING) {
            callbacks.record();
          } else if (this.nextState === State.PLAYING) {
            callbacks.play();
          }
        }
      } else if (e.key === "Enter") {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement.role === "switch") {
          activeElement.click();
        } else {
          activeElement.blur();
        }
      }
    });
    document.addEventListener("hidden.bs.offcanvas", () => { this.offCanvass = false });
    document.addEventListener("shown.bs.offcanvas", () => { this.offCanvass = true });
  }

  markRecording() {
    this.setState(State.RECORDING);
  }

  markPlaying() {
    this.setState(State.PLAYING);
  }

  markStopped() {
    this.setState(State.STOPPED);
  }

  reset() {
    this.setState(State.UNKNOWN);
  }

  private setState(state: State) {
    if (state === State.RECORDING) {
      this.showControls([this.recordingIcon]);
      this.state = State.RECORDING;
      this.nextState = State.STOPPED;
    } else if (state === State.STOPPED) {
      this.nextState = this.state === State.RECORDING ? State.PLAYING : State.RECORDING;
      this.showControls([this.playIcon, this.recordIcon]);
      this.state = State.STOPPED;
    } else if (state === State.PLAYING) {
      this.showControls([this.playingIcon]);
      this.state = State.PLAYING;
      this.nextState = State.STOPPED;
    } else if (state == State.UNKNOWN) {
      this.showControls([this.recordIcon]);
      this.state = State.STOPPED;
      this.nextState = State.RECORDING;
    }
  }

  private showControls(activeIcons: (HTMLElement | null)[]): void {
    [this.recordIcon, this.recordingIcon, this.playIcon, this.playingIcon].forEach(icon => {
      if (icon) {
        icon.style.display = (activeIcons.includes(icon)) ? "inline-block" : "none";
      }
    });
  }
}
