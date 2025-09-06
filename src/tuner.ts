import TunerAnalyzer from "./tuner-analyzer";
import TunerVisualization from "./tuner-visualization";
import boolSwitchControls from "./bool-switch-controls";

export default class Tuner {
  private analyzer: TunerAnalyzer;
  private visualization: TunerVisualization;

  public enabled = boolSwitchControls("tuner-enabled", { initial: false });

  constructor(audioContext: AudioContext) {
    this.analyzer = new TunerAnalyzer(audioContext);
    this.visualization = new TunerVisualization('tuner');

    if (this.enabled()) {
      this.visualization.show();
      this.visualization.clear();
    } else {
      this.visualization.hide();
    }
  }

  async analyze(audioBuffer: AudioBuffer): Promise<void> {
    // Perform pitch analysis
    const pitchData = await this.analyzer.analyzePitch(audioBuffer);

    if (pitchData.length > 0) {
      // Create visualization data
      const { time, cents, note } = this.analyzer.createVisualizationData(pitchData);

      // Draw the tuner graph
      this.visualization.drawTunerGraph(time, cents, note);

      // Log some statistics for debugging
      const avgDeviation = cents.reduce((sum, c) => sum + Math.abs(c), 0) / cents.length;
      const maxDeviation = Math.max(...cents.map(c => Math.abs(c)));
      console.log(`Tuner Analysis: Avg deviation: ${avgDeviation.toFixed(1)}¢, Max deviation: ${maxDeviation.toFixed(1)}¢`);
    }
  }

  reset(): void {
    this.visualization.clear();
  }
}
