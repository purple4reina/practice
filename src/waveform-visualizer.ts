import boolSwitchControls from "./bool-switch-controls";
import type { LoudnessData } from './audio-analyzer';
import type { IntonationData } from './tuner';

export interface WaveformVisualizerOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  waveformColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  maxTime?: number; // Maximum time range in milliseconds
  scrollThreshold?: number; // When recording is longer than this, enable scrolling (in ms)
  viewportDuration?: number; // How much time to show in viewport when scrolling (in ms)
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
  private intonationData: IntonationData | null = null;
  private metronomeSettings: MetronomeSettings | null = null;
  private playbackStartTime: number = 0;
  private playbackRate: number = 1;
  private isPlaybackActive: boolean = false;
  private animationFrameId: number | null = null;

  // Viewport/scrolling properties
  private isScrollingEnabled: boolean = false;
  private viewStartTime: number = 0; // Start time of current viewport in ms
  private viewDuration: number = 10000; // Duration of viewport in ms
  private totalDuration: number = 0; // Total duration of the recording
  private playbackMarkerPosition: number = 0.33; // Position where marker stops and scrolling begins (0-1)

  private enabled = boolSwitchControls('visualization-enabled', { initial: true });
  private statsDiv = document.getElementById('visualization-stats') as HTMLElement;

  constructor(canvas: HTMLCanvasElement, options: WaveformVisualizerOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    this.options = {
      width: options.width || 800,
      height: options.height || 300,
      backgroundColor: options.backgroundColor || '#f8f9fa',
      waveformColor: options.waveformColor || '#a55dfc',
      gridColor: options.gridColor || '#babcbf',
      showGrid: options.showGrid !== undefined ? options.showGrid : true,
      maxTime: options.maxTime || 30000, // 30 seconds default
      scrollThreshold: options.scrollThreshold || 15000, // 15 seconds
      viewportDuration: options.viewportDuration || 10000, // 10 seconds
    };

    this.viewDuration = this.options.viewportDuration;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '300px';
    this.canvas.style.border = '1px solid #dee2e6';
    this.canvas.style.borderRadius = '8px';
  }

  setLoudnessData(data: LoudnessData[]): void {
    this.loudnessData = [...data];
    this.updateScrollingState();
    this.draw();
  }

  setMetronomeSettings(settings: MetronomeSettings | null): void {
    this.metronomeSettings = settings;
    this.draw();
  }

  drawVisualization(
    loudnessData: LoudnessData[],
    intonationData: IntonationData,
    settings: MetronomeSettings | null,
  ) {
    this.loudnessData = [...loudnessData];
    this.intonationData = intonationData;
    this.metronomeSettings = settings;
    this.updateScrollingState();
    this.draw();
  }

  private updateScrollingState(): void {
    if (this.loudnessData.length === 0) {
      this.totalDuration = 0;
      this.isScrollingEnabled = false;
      return;
    }

    this.totalDuration = this.loudnessData[this.loudnessData.length - 1].timestamp;
    this.isScrollingEnabled = this.totalDuration > this.options.scrollThreshold;

    if (!this.isScrollingEnabled) {
      this.viewStartTime = 0;
      this.viewDuration = this.totalDuration;
    } else {
      this.viewStartTime = 0;
      this.viewDuration = this.options.viewportDuration;
    }
  }

  startPlayback(playbackRate: number = 1): void {
    this.playbackStartTime = Date.now();
    this.playbackRate = playbackRate;
    this.isPlaybackActive = true;

    // Reset viewport to beginning when starting playback
    if (this.isScrollingEnabled) {
      this.viewStartTime = 0;
    }

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
    this.intonationData = null;
    this.metronomeSettings = null;
    this.totalDuration = 0;
    this.isScrollingEnabled = false;
    this.viewStartTime = 0;
    this.stopPlayback();
    this.draw();
  }

  private setStats(maxLoudness?: number) {
    if (maxLoudness === undefined) {
      this.statsDiv.innerText = "";
    } else {
      let value = (maxLoudness * 1000).toFixed(0);
      const scrollInfo = this.isScrollingEnabled ? " (Scrolling)" : "";
      this.statsDiv.innerText = `Max Vol: ${value}${scrollInfo}`;
    }
  }

  private draw(): void {
    const { width, height, backgroundColor, waveformColor, gridColor, showGrid } = this.options;

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

    this.drawWaveform(this.loudnessData);

    // Draw metronome beat markers on top
    if (this.metronomeSettings) {
      this.drawMetronomeBeats();
    }

    // Draw intonation line
    if (this.intonationData) {
      this.drawIntonation();
    }

    // Draw playback position indicator
    if (this.isPlaybackActive) {
      this.drawPlaybackPosition();
    }
  }

  private drawGrid(): void {
    const { width, height, gridColor } = this.options;
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;

    // Horizontal grid lines (amplitude) - fewer lines since we have mirrored waveform
    const centerY = height / 2;

    // Center line (emphasized)
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, centerY);
    this.ctx.lineTo(width, centerY);
    this.ctx.stroke();

    const lineEveryLoudness = 50;
    const maxLoudness = Math.max(...this.loudnessData.map(d => d.loudness)) * 1000;
    const maxAmplitude = height * 0.4; // Use 40% of height for each side (80% total)
    const offsetDistance = lineEveryLoudness * maxAmplitude / maxLoudness;

    if (offsetDistance <= 0) {
      return;
    }

    // Amplitude grid lines
    this.ctx.lineWidth = 0.5;
    let offset = 0;
    while (offset < (height / 2)) {
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

      offset += offsetDistance;
    }

    // Time grid lines (vertical) - more useful when scrolling
    if (this.isScrollingEnabled) {
      this.ctx.strokeStyle = gridColor + '80'; // More transparent
      this.ctx.lineWidth = 0.5;

      // Draw time markers every second
      const secondInterval = 1000; // 1 second in ms
      const startSecond = Math.floor(this.viewStartTime / secondInterval) * secondInterval;

      for (let time = startSecond; time <= this.viewStartTime + this.viewDuration; time += secondInterval) {
        if (time >= this.viewStartTime && time <= this.viewStartTime + this.viewDuration) {
          const x = this.timeToX(time);
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, height);
          this.ctx.stroke();
        }
      }
    }
  }

  private timeToX(timestamp: number): number {
    return ((timestamp - this.viewStartTime) / this.viewDuration) * this.options.width;
  }

  private drawWaveform(data: LoudnessData[]): void {
    if (data.length < 2) return;

    const { width, height, waveformColor } = this.options;

    // Filter data to only include points in the current viewport
    const visibleData = data.filter(point =>
      point.timestamp >= this.viewStartTime &&
      point.timestamp <= this.viewStartTime + this.viewDuration
    );

    if (visibleData.length === 0) return;

    // Find maximum loudness for dynamic scaling
    const maxLoudness = Math.max(...data.map(d => d.loudness));
    if (maxLoudness === 0) return; // Avoid division by zero

    this.setStats(maxLoudness);

    const centerY = height / 2;
    const maxAmplitude = height * 0.4; // Use 40% of height for each side (80% total)

    this.ctx.strokeStyle = waveformColor;
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Draw upper half
    this.ctx.beginPath();
    let firstPoint = true;
    for (const point of visibleData) {
      const x = this.timeToX(point.timestamp);
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
    for (const point of visibleData) {
      const x = this.timeToX(point.timestamp);
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
    for (const point of visibleData) {
      const x = this.timeToX(point.timestamp);
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
    for (let i = visibleData.length - 1; i >= 0; i--) {
      const point = visibleData[i];
      const x = this.timeToX(point.timestamp);
      const normalizedLoudness = point.loudness / maxLoudness;
      const amplitude = normalizedLoudness * maxAmplitude;
      const y = centerY + amplitude;
      this.ctx.lineTo(Math.max(0, x), y);
    }

    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawMetronomeBeats(): void {
    if (!this.metronomeSettings) return;

    const { width, height } = this.options;
    const { bpm, subdivisions } = this.metronomeSettings;

    // Calculate beat interval in milliseconds
    const beatIntervalMs = (60 / bpm) * 1000; // Time between quarter note beats
    const subdivisionIntervalMs = beatIntervalMs / subdivisions; // Time between subdivisions

    // colors
    let strokesDrawn = 0;
    const black = '#000000';
    const blue = '#2905f5';

    // Draw beat markers
    this.ctx.lineWidth = 1;

    // Start from the first beat that's visible in the viewport
    let currentTime = 175; // XXX: TODO: This needs to be dynamic!

    // Find the first beat in the viewport
    while (currentTime < this.viewStartTime) {
      currentTime += subdivisionIntervalMs;
      strokesDrawn += 1;
    }

    // Draw beats within the viewport
    while (currentTime <= this.viewStartTime + this.viewDuration && currentTime <= this.totalDuration) {
      const x = this.timeToX(currentTime);

      // Only draw if within canvas bounds
      if (x >= 0 && x <= width) {
        this.ctx.strokeStyle = (strokesDrawn % subdivisions) === 0 ? blue : black;

        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
      }

      currentTime += subdivisionIntervalMs;
      strokesDrawn += 1;
    }
  }

  private drawIntonation(): void {
    if (!this.intonationData) return;

    // Time between each intonation sample, in ms
    const toneIntervalMs = (60 / this.intonationData.sampleRate) * 1000;
    const { height } = this.options;
    const y0 = height / 2;
    let currentTime = 0;

    this.ctx.lineWidth = 2;
    this.ctx.strokeStyle = '#29755c';
    this.ctx.beginPath();

    let pathStarted = false;

    this.intonationData.points.forEach(point => {
      if (point && currentTime >= this.viewStartTime && currentTime <= this.viewStartTime + this.viewDuration) {
        const x = this.timeToX(currentTime);
        const y = y0 - (point.cents * height / 100);

        if (!pathStarted) {
          this.ctx.moveTo(x, y);
          pathStarted = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      } else if (!point) {
        // Null point - break the line
        if (pathStarted) {
          this.ctx.stroke();
          this.ctx.beginPath();
          pathStarted = false;
        }
      }
      currentTime += toneIntervalMs;
    });

    if (pathStarted) {
      this.ctx.stroke();
    }
  }

  private updateViewport(currentPlaybackTime: number): void {
    if (!this.isScrollingEnabled) return;

    const markerTimePosition = this.viewStartTime + (this.viewDuration * this.playbackMarkerPosition);

    // If playback has reached the scroll threshold and we're not at the end
    if (currentPlaybackTime >= markerTimePosition &&
        this.viewStartTime + this.viewDuration < this.totalDuration) {

      // Calculate new viewport start time to keep the playback marker at the threshold position
      const newViewStartTime = currentPlaybackTime - (this.viewDuration * this.playbackMarkerPosition);

      // Don't scroll past the end
      const maxViewStartTime = this.totalDuration - this.viewDuration;
      this.viewStartTime = Math.min(newViewStartTime, Math.max(0, maxViewStartTime));
    }
  }

  private drawPlaybackPosition(): void {
    const { width, height } = this.options;

    // Calculate current playback position in milliseconds
    const currentTime = Date.now();
    const elapsedTime = (currentTime - this.playbackStartTime) * this.playbackRate;

    // Don't draw if we're past the end of the recording
    if (elapsedTime > this.totalDuration) {
      this.stopPlayback();
      return;
    }

    // Update viewport if scrolling is enabled
    this.updateViewport(elapsedTime);

    // Calculate x position based on whether we're scrolling or not
    let x: number;

    if (this.isScrollingEnabled) {
      // Check if we're in the scrolling region
      const markerTimePosition = this.viewStartTime + (this.viewDuration * this.playbackMarkerPosition);
      const viewEndTime = this.viewStartTime + this.viewDuration;

      if (elapsedTime >= markerTimePosition && viewEndTime < this.totalDuration) {
        // We're scrolling - keep marker at fixed position
        x = width * this.playbackMarkerPosition;
      } else {
        // We're either before scrolling starts or after scrolling ends
        x = this.timeToX(elapsedTime);
      }
    } else {
      // No scrolling - normal behavior
      x = this.timeToX(elapsedTime);
    }

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
    this.setStats();
  }
}
