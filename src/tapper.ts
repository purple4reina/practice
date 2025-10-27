export default class Tapper {
  private taps: number[] = [];
  private tapperToggle = document.getElementById("tapper") as HTMLElement;
  private bpmDisplay = document.getElementById("tapper-display") as HTMLElement;
  private eventListener: (e: KeyboardEvent) => void;
  private started = false;

  constructor() {
    this.eventListener = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.tap();
      }
    }
    this.tapperToggle.addEventListener("click", this.toggle.bind(this));
    window.addEventListener("hidden.bs.offcanvas", () => {
      if (this.started) {
        this.toggle();
      }
    });
  }

  public toggle() {
    this.taps = [];
    if (!this.started) {
      window.addEventListener('keydown', this.eventListener);
      this.tapperToggle.classList.add("btn-primary");
      this.tapperToggle.classList.remove("btn-outline-secondary");
      this.bpmDisplay.innerText = "Press Enter to Tap";
      this.started = true;
    } else {
      window.removeEventListener('keydown', this.eventListener);
      this.tapperToggle.classList.add("btn-outline-secondary");
      this.tapperToggle.classList.remove("btn-primary");
      this.bpmDisplay.innerText = "";
      this.started = false;
    }
  }

  private async tap() {
    this.taps.push(Date.now());
    setTimeout(() => this.updateBpm(), 0);
  }

  private updateBpm() {
    if (this.taps.length < 2) {
      return;
    }

    const intervals = this.taps.slice(1).map((tap, i) => tap - this.taps[i]);
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);
    this.bpmDisplay.innerText = bpm.toString();

    while (this.taps.length > 8) {
      this.taps.shift();
    }
  }
}
