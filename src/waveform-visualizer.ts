import type { LoudnessData } from './audio-analyzer';

export interface WaveformVisualizerOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  waveformColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  maxTime?: number; // Maximum time range in milliseconds
}

export interface MetronomeSettings {
  bpm: number;
  subdivisions: number;
}

export default class WaveformVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<WaveformVisualizerOptions>;
  private loudnessData: LoudnessData[] = [];
  private metronomeSettings: MetronomeSettings | null = null;
  private playbackStartTime: number = 0;
  private playbackRate: number = 1;
  private isPlaybackActive: boolean = false;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, options: WaveformVisualizerOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    this.options = {
      width: options.width || 800,
      height: options.height || 200,
      backgroundColor: options.backgroundColor || '#f8f9fa',
      waveformColor: options.waveformColor || '#a55dfc',
      gridColor: options.gridColor || '#e9ecef',
      showGrid: options.showGrid !== undefined ? options.showGrid : true,
      maxTime: options.maxTime || 30000, // 30 seconds default
    };

    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '200px';
    this.canvas.style.border = '1px solid #dee2e6';
    this.canvas.style.borderRadius = '8px';
  }

  setLoudnessData(data: LoudnessData[]): void {
    this.loudnessData = [...data];
    this.draw();
  }

  setMetronomeSettings(settings: MetronomeSettings | null): void {
    this.metronomeSettings = settings;
    this.draw();
  }

  startPlayback(playbackRate: number = 1): void {
    this.playbackStartTime = Date.now();
    this.playbackRate = playbackRate;
    this.isPlaybackActive = true;
    this.animatePlayback();
  }

  stopPlayback(): void {
    this.isPlaybackActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.draw(); // Redraw without playback line
  }

  clear(): void {
    this.loudnessData = [];
    this.metronomeSettings = null;
    this.stopPlayback();
    this.draw();
  }

  private draw(): void {
    const { width, height, backgroundColor, waveformColor, gridColor, showGrid, maxTime } = this.options;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      this.drawGrid();
    }

    if (this.loudnessData.length === 0) {
      this.drawEmptyState();
      return;
    }

    // Determine time range
    const maxTimestamp = this.loudnessData.length > 0
      ? this.loudnessData[this.loudnessData.length - 1].timestamp
      : maxTime;

    this.drawWaveform(this.loudnessData, maxTimestamp);

    // Draw metronome beat markers on top
    if (this.metronomeSettings) {
      this.drawMetronomeBeats(maxTimestamp);
    }

    // Draw playback position indicator
    if (this.isPlaybackActive) {
      this.drawPlaybackPosition(maxTimestamp);
    }
  }

  private drawGrid(): void {
    const { width, height, gridColor } = this.options;
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Vertical grid lines (time)
    const timeInterval = 5000; // 5 second intervals
    const timeStep = (width * timeInterval) / this.options.maxTime;
    for (let x = 0; x <= width; x += timeStep) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Horizontal grid lines (amplitude) - fewer lines since we have mirrored waveform
    const centerY = height / 2;
    const amplitudeLines = 2; // Lines above and below center

    // Center line (emphasized)
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    // Amplitude grid lines
    this.ctx.lineWidth = 0.5;
    for (let i = 1; i <= amplitudeLines; i++) {
      const offset = (height / 2 / (amplitudeLines + 1)) * i;

      // Upper lines
      this.ctx.beginPath();
      this.ctx.moveTo(0, centerY - offset);
      this.ctx.lineTo(width, centerY - offset);
      this.ctx.stroke();

      // Lower lines
      this.ctx.beginPath();
      this.ctx.moveTo(0, centerY + offset);
      this.ctx.lineTo(width, centerY + offset);
      this.ctx.stroke();
    }
  }

  private drawWaveform(data: LoudnessData[], maxTimestamp: number): void {
    if (data.length < 2) return;

    const { width, height, waveformColor } = this.options;

    // Find maximum loudness for dynamic scaling
    const maxLoudness = Math.max(...data.map(d => d.loudness));
    if (maxLoudness === 0) return; // Avoid division by zero

    const centerY = height / 2;
    const maxAmplitude = height * 0.4; // Use 40% of height for each side (80% total)

    this.ctx.strokeStyle = waveformColor;
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw upper half
    this.ctx.beginPath();
    let firstPoint = true;
    for (const point of data) {
      const x = (point.timestamp / maxTimestamp) * width;
      const normalizedLoudness = point.loudness / maxLoudness; // Scale to 0-1
      const amplitude = normalizedLoudness * maxAmplitude;
      const y = centerY - amplitude; // Upper half

      if (firstPoint) {
        this.ctx.moveTo(Math.max(0, x), y);
        firstPoint = false;
      } else {
        this.ctx.lineTo(Math.max(0, x), y);
      }
    }
    this.ctx.stroke();

    // Draw lower half (mirrored)
    this.ctx.beginPath();
    firstPoint = true;
    for (const point of data) {
      const x = (point.timestamp / maxTimestamp) * width;
      const normalizedLoudness = point.loudness / maxLoudness; // Scale to 0-1
      const amplitude = normalizedLoudness * maxAmplitude;
      const y = centerY + amplitude; // Lower half

      if (firstPoint) {
        this.ctx.moveTo(Math.max(0, x), y);
        firstPoint = false;
      } else {
        this.ctx.lineTo(Math.max(0, x), y);
      }
    }
    this.ctx.stroke();

    // Draw filled area between the mirrored waveforms
    this.ctx.fillStyle = waveformColor + '20'; // Add transparency
    this.ctx.beginPath();

    // Upper path
    firstPoint = true;
    for (const point of data) {
      const x = (point.timestamp / maxTimestamp) * width;
      const normalizedLoudness = point.loudness / maxLoudness;
      const amplitude = normalizedLoudness * maxAmplitude;
      const y = centerY - amplitude;

      if (firstPoint) {
        this.ctx.moveTo(Math.max(0, x), y);
        firstPoint = false;
      } else {
        this.ctx.lineTo(Math.max(0, x), y);
      }
    }

    // Lower path (in reverse)
    for (let i = data.length - 1; i >= 0; i--) {
      const point = data[i];
      const x = (point.timestamp / maxTimestamp) * width;
      const normalizedLoudness = point.loudness / maxLoudness;
      const amplitude = normalizedLoudness * maxAmplitude;
      const y = centerY + amplitude;
      this.ctx.lineTo(Math.max(0, x), y);
    }

    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawMetronomeBeats(maxTimestamp: number): void {
    if (!this.metronomeSettings) return;

    const { width, height } = this.options;
    const { bpm, subdivisions } = this.metronomeSettings;

    // Calculate beat interval in milliseconds
    const beatIntervalMs = (60 / bpm) * 1000; // Time between quarter note beats
    const subdivisionIntervalMs = beatIntervalMs / subdivisions; // Time between subdivisions

    // Draw beat markers
    this.ctx.strokeStyle = '#000000'; // Black color for beat markers
    this.ctx.lineWidth = 1;

    let currentTime = 0;
    while (currentTime <= maxTimestamp) {
      const x = (currentTime / maxTimestamp) * width;

      // Only draw if within canvas bounds
      if (x >= 0 && x <= width) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
      }

      currentTime += subdivisionIntervalMs;
    }
  }

  private drawPlaybackPosition(maxTimestamp: number): void {
    const { width, height } = this.options;

    // Calculate current playback position in milliseconds
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.playbackStartTime) * this.playbackRate;

    // Don't draw if we're past the end of the recording
    if (elapsedTime > maxTimestamp) {
      this.stopPlayback();
      return;
    }

    // Calculate x position
    const x = (elapsedTime / maxTimestamp) * width;

    // Draw the playback position line
    this.ctx.strokeStyle = '#FF0000'; // Red color for playback indicator
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, 0);
    this.ctx.lineTo(x, height);
    this.ctx.stroke();
  }

  private animatePlayback(): void {
    if (!this.isPlaybackActive) return;

    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.animatePlayback());
  }

  private drawEmptyState(): void {
    const { width, height } = this.options;

    this.ctx.fillStyle = '#6c757d';
    this.ctx.font = '16px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.fillText(
      'Audio visualization will appear here during recording/playback',
      width / 2,
      height / 2
    );
  }

  // Update visualization options
  updateOptions(newOptions: Partial<WaveformVisualizerOptions>): void {
    Object.assign(this.options, newOptions);
    this.setupCanvas();
    this.draw();
  }

  destroy(): void {
    this.stopPlayback();
  }
}
