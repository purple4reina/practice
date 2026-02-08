import { Click } from "../blocks/clicks";
import { Clip } from "../clips";
import {
  boolSwitchControls,
  plusMinusControls,
} from "../controls";
import {
  LoudnessAnalyzer,
  LoudnessData,
} from './loudness-analyzer';
import {
  Tuner,
  IntonationData,
} from './tuner';

export interface VisualizerOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  waveformColor?: string;
  gridColor?: string;
  showGrid?: boolean;
  maxTime?: number; // Maximum time range in milliseconds
  scrollThreshold?: number; // When recording is longer than this, enable scrolling (in ms)
  viewportDuration?: number; // How much time to show in viewport when scrolling (in ms)
  minZoomDuration?: number; // Minimum zoom duration in ms
  maxZoomDuration?: number; // Maximum zoom duration in ms
}

export default class Visualizer {
  private canvas = document.getElementById('waveform-canvas') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

  // external analyzers
  private tuner;
  private loudnessAnalyzer = LoudnessAnalyzer;

  private options: Required<VisualizerOptions>;
  private loudnessData: LoudnessData[] = [];
  private intonationData: IntonationData | null = null;
  private clicks: Click[] = [];
  private recordSpeed: number = 1;
  private latency: number = 0;
  private playbackStartTime: number = 0;
  private playbackRate: number = 1;
  private isPlaybackActive: boolean = false;
  private animationFrameId: number | null = null;

  private clickLines: { [key: number]: string } = {
    1: '#f50505',  // red
    2: '#2905f5',  // blue
    3: '#02b025',  // green
    4: '#000000',  // black
  }

  // Viewport/scrolling properties
  private isScrollingEnabled: boolean = false;
  private viewStartTime: number = 0; // Start time of current viewport in ms
  private viewDuration: number = 10000; // Duration of viewport in ms
  private totalDuration: number = 0; // Total duration of the recording
  private playbackMarkerPosition: number = 0.33; // Position where marker stops and scrolling begins (0-1)

  // Drag/navigation properties
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartViewTime: number = 0;

  // Zoom/pinch properties
  private isZooming: boolean = false;
  private lastPinchDistance: number = 0;
  private pinchCenterX: number = 0;
  private savedZoomPercent: number = 100; // 100% = default zoom level

  private enabled = boolSwitchControls('visualization-enabled', { initial: true });
  private statsDiv = document.getElementById('visualization-stats') as HTMLElement;

  constructor(audioContext: AudioContext) {
    this.options = {
      width: 800,
      height: 300,
      backgroundColor: '#f8f9fa',
      waveformColor: '#a55dfc',
      gridColor: '#babcbf',
      showGrid: true,
      maxTime: 30000, // 30 seconds default
      scrollThreshold: 15000, // 15 seconds
      viewportDuration: 10000, // 10 seconds
      minZoomDuration: 500, // 0.5 seconds minimum zoom
      maxZoomDuration: 30000, // 30 seconds maximum zoom
    };

    this.tuner = new Tuner(audioContext);
    this.viewDuration = this.options.viewportDuration;
    this.setupCanvas();
    this.setupMouseEvents();
  }

  private setupCanvas(): void {
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '300px';
    this.canvas.style.border = '1px solid #dee2e6';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.touchAction = 'none';
  }

  private setupMouseEvents(): void {
    // Set initial cursor style
    this.canvas.style.cursor = 'default';

    this.canvas.addEventListener('mouseleave', () => {
      this.endDrag();
    });

    // Mouse events for dragging
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.isPlaybackActive && this.isScrollingEnabled && this.totalDuration > 0) {
        this.startDrag(e);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.updateDrag(e);
      } else {
        // Update cursor based on whether dragging is available
        this.updateCursor();
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.endDrag();
    });

    // Wheel events - only handle trackpad pinch (Ctrl+wheel), ignore regular scrolling
    this.canvas.addEventListener('wheel', (e) => {
      if (e.ctrlKey && !this.isPlaybackActive && this.totalDuration > 0) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        this.zoom(zoomFactor, e.offsetX);
      }
    }, { passive: false });

    // Touch events for pinch-to-zoom (mobile devices)
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.isPlaybackActive && this.totalDuration > 0) {
        this.handleTouchStart(e);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isPlaybackActive && this.totalDuration > 0) {
        this.handleTouchMove(e);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    }, { passive: false });

    // Prevent default context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  private updateCursor(): void {
    if (!this.isPlaybackActive && this.isScrollingEnabled && this.totalDuration > 0) {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }

  private startDrag(e: MouseEvent): void {
    this.isDragging = true;
    this.dragStartX = e.offsetX;
    this.dragStartViewTime = this.viewStartTime;
    this.canvas.style.cursor = 'grabbing';

    // Prevent text selection during drag
    e.preventDefault();
  }

  private updateDrag(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.offsetX - this.dragStartX;
    const deltaTime = (deltaX / this.options.width) * this.viewDuration;

    // Calculate new view start time (dragging left moves forward in time, right moves backward)
    const newViewStartTime = this.dragStartViewTime - deltaTime;

    // Clamp to valid boundaries
    const maxViewStartTime = Math.max(0, this.totalDuration - this.viewDuration);
    this.viewStartTime = Math.max(0, Math.min(maxViewStartTime, newViewStartTime));

    // Redraw with new viewport
    this.draw();
  }

  private endDrag(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.updateCursor();
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2) {
      // Start pinch gesture
      this.isZooming = true;
      this.isDragging = false; // Cancel any drag operation

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      this.lastPinchDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      // Calculate center point of pinch
      const rect = this.canvas.getBoundingClientRect();
      this.pinchCenterX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
    } else if (e.touches.length === 1 && !this.isZooming) {
      // Single touch - start drag
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      // Convert touch to mouse coordinates relative to canvas
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;

      if (this.isScrollingEnabled) {
        this.isDragging = true;
        this.dragStartX = offsetX;
        this.dragStartViewTime = this.viewStartTime;
        this.canvas.style.cursor = 'grabbing';
      }
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    if (e.touches.length === 2 && this.isZooming) {
      // Continue pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const currentDistance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      if (this.lastPinchDistance > 0) {
        const zoomFactor = this.lastPinchDistance / currentDistance;
        this.zoom(zoomFactor, this.pinchCenterX);
      }

      this.lastPinchDistance = currentDistance;
    } else if (e.touches.length === 1 && this.isDragging && !this.isZooming) {
      // Single touch drag
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const offsetX = touch.clientX - rect.left;

      const deltaX = offsetX - this.dragStartX;
      const deltaTime = (deltaX / this.options.width) * this.viewDuration;
      const newViewStartTime = this.dragStartViewTime - deltaTime;

      const maxViewStartTime = Math.max(0, this.totalDuration - this.viewDuration);
      this.viewStartTime = Math.max(0, Math.min(maxViewStartTime, newViewStartTime));

      this.draw();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (e.touches.length < 2) {
      this.isZooming = false;
      this.lastPinchDistance = 0;
    }

    if (e.touches.length === 0) {
      this.endDrag();
    }
  }

  private zoom(factor: number, centerX: number): void {
    if (!this.totalDuration) return;

    const oldViewDuration = this.viewDuration;
    const oldViewStartTime = this.viewStartTime;

    // Calculate the time point at the center of the zoom
    const centerTime = this.viewStartTime + (centerX / this.options.width) * this.viewDuration;

    // Calculate new view duration with better bounds checking
    let newViewDuration = this.viewDuration * factor;

    // Apply zoom limits more conservatively
    newViewDuration = Math.max(this.options.minZoomDuration, newViewDuration);
    newViewDuration = Math.min(this.options.maxZoomDuration, newViewDuration);
    newViewDuration = Math.min(newViewDuration, this.totalDuration);

    if (Math.abs(newViewDuration - this.viewDuration) < 10) return; // Prevent tiny changes

    // Calculate new view start time to keep the center point stable
    const centerRatio = centerX / this.options.width;
    let newViewStartTime = centerTime - (newViewDuration * centerRatio);

    // Apply bounds more carefully
    const maxViewStartTime = this.totalDuration - newViewDuration;
    newViewStartTime = Math.max(0, Math.min(maxViewStartTime, newViewStartTime));

    // Ensure we don't go beyond the data bounds
    if (newViewStartTime >= 0 && newViewStartTime + newViewDuration <= this.totalDuration + 1) {
      this.viewDuration = newViewDuration;
      this.viewStartTime = newViewStartTime;
      this.savedZoomPercent = (this.options.viewportDuration / this.viewDuration) * 100;

      // Update scrolling state
      this.isScrollingEnabled = this.viewDuration < this.totalDuration;
      this.updateCursor();

      this.draw();
    } else {
      // If bounds check fails, revert to old values
      console.warn('Zoom bounds check failed, reverting', {
        newViewStartTime,
        newViewDuration,
        totalDuration: this.totalDuration
      });
    }
  }

  private resetZoom(): void {
    if (!this.totalDuration) return;

    this.viewStartTime = 0;
    this.viewDuration = this.totalDuration > this.options.scrollThreshold
      ? this.options.viewportDuration
      : this.totalDuration;

    this.updateScrollingState();
    this.savedZoomPercent = 100;
    this.draw();
  }

  drawVisualization(clip: Clip) {
    this.loudnessData = this.loudnessAnalyzer.calculateLoudnessFromBuffer(clip.audioBuffer);
    this.intonationData = this.tuner.analyze(clip.audioBuffer);
    this.clicks = clip.playClicks;
    this.recordSpeed = clip.recordSpeed;
    this.latency = clip.latency;
    this.updateScrollingState();
    this.draw();
  }

  private updateScrollingState(): void {
    if (this.loudnessData.length === 0) {
      this.totalDuration = 0;
      this.isScrollingEnabled = false;
      this.updateCursor();
      return;
    }

    this.totalDuration = this.loudnessData[this.loudnessData.length - 1].timestamp;
    this.isScrollingEnabled = this.totalDuration > this.options.scrollThreshold;

    // Always reset to beginning
    this.viewStartTime = 0;

    if (!this.isScrollingEnabled) {
      this.viewDuration = this.totalDuration;
    } else {
      const desiredViewDuration = this.options.viewportDuration * (100 / this.savedZoomPercent);
      const clampedDuration = Math.max(
        this.options.minZoomDuration,
        Math.min(this.options.maxZoomDuration, desiredViewDuration)
      );
      this.viewDuration = Math.min(clampedDuration, this.totalDuration);
      this.isScrollingEnabled = this.viewDuration < this.totalDuration;
    }

    this.updateCursor();
  }

  startPlayback(playbackRate: number = 1): void {
    this.playbackStartTime = Date.now();
    this.playbackRate = playbackRate;
    this.isPlaybackActive = true;

    // Reset any drag state when starting playback
    this.endDrag();

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
    this.updateCursor(); // Update cursor when playback stops
    this.draw(); // Redraw without playback line
  }

  clear(): void {
    this.loudnessData = [];
    this.intonationData = null;
    this.clicks = [];
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
      let statusInfo = "";

      if (this.isScrollingEnabled) {
        const zoomPercent = Math.round((this.options.viewportDuration / this.viewDuration) * 100);
        statusInfo = ` (${zoomPercent}% zoom)`;
      }

      this.statsDiv.innerText = `Max Vol: ${value}${statusInfo}`;

      let fastestClick = Infinity;
      for (const click of this.clicks) {
        fastestClick = Math.min(fastestClick, click.delay);
      }
      fastestClick /= this.recordSpeed;
      this.statsDiv.innerText += `, Click Dur: ${Math.round(fastestClick)}ms`;
    }
  }

  private draw(): void {
    const { width, height, backgroundColor, waveformColor, gridColor, showGrid } = this.options;

    // Clear canvas
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    // Draw pitch-colored background bands
    if (this.loudnessData.length >= 2) {
      this.drawPitchBackground(this.loudnessData);
    }

    if (this.loudnessData.length === 0) {
      // Draw grid
      if (showGrid) {
        this.drawGrid();
      }
      this.drawEmptyState();
      return;
    }

    this.drawWaveform(this.loudnessData);

    // Draw grid on top of waveform fill so lines remain visible
    if (showGrid) {
      this.drawGrid();
    }

    // Draw metronome beat markers on top
    if (this.clicks) {
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

  private static readonly PITCH_COLORS = ['#a55dfc', '#4eb8d4', '#e8645a', '#58c462'];
  private static readonly PITCH_BG_LOUDNESS_THRESHOLD = 0.015; // RMS below this = no background color

  private getWaveformColors(visibleData: LoudnessData[]): (string | null)[] {
    if (!this.intonationData || this.intonationData.points.length === 0) {
      return visibleData.map(() => null);
    }

    const toneIntervalMs = (60 / this.intonationData.sampleRate) * 1000;
    const colors = Visualizer.PITCH_COLORS;

    // Cycle color when pitch resumes after a gap or when the pitch name changes
    const pitchColorIndices: (number | null)[] = [];
    let colorIndex = 0;
    let inGap = true;
    let lastPitchName: string | null = null;

    for (const point of this.intonationData.points) {
      if (!point) {
        inGap = true;
        pitchColorIndices.push(null);
      } else {
        if (inGap || point.name !== lastPitchName) {
          colorIndex = (colorIndex + 1) % colors.length;
          inGap = false;
        }
        lastPitchName = point.name;
        pitchColorIndices.push(colorIndex);
      }
    }

    // Map each loudness data point to its corresponding intonation color
    const loudnessThreshold = Visualizer.PITCH_BG_LOUDNESS_THRESHOLD;
    return visibleData.map(point => {
      if (point.loudness < loudnessThreshold) return null;
      const intonationIndex = Math.round(point.timestamp / toneIntervalMs);
      if (intonationIndex >= 0 && intonationIndex < pitchColorIndices.length) {
        const idx = pitchColorIndices[intonationIndex];
        return idx !== null ? colors[idx] : null;
      }
      return null;
    });
  }

  private drawPitchBackground(data: LoudnessData[]): void {
    const visibleData = data.filter(point =>
      point.timestamp >= this.viewStartTime &&
      point.timestamp <= this.viewStartTime + this.viewDuration
    );
    if (visibleData.length < 2) return;

    const { height } = this.options;
    const colors = this.getWaveformColors(visibleData);

    // Build segments of consecutive same-colored points
    let segStart = 0;
    while (segStart < visibleData.length) {
      const color = colors[segStart];
      let segEnd = segStart;
      while (segEnd < visibleData.length && colors[segEnd] === color) {
        segEnd++;
      }

      // Skip segments where no pitch was detected
      if (color !== null) {
        const x1 = Math.max(0, this.timeToX(visibleData[segStart].timestamp));
        const x2 = segEnd < visibleData.length
          ? this.timeToX(visibleData[segEnd].timestamp)
          : this.timeToX(visibleData[segEnd - 1].timestamp) + 1;

        this.ctx.fillStyle = color + '20';
        this.ctx.fillRect(x1, 0, x2 - x1, height);
      }

      segStart = segEnd;
    }
  }

  private drawWaveform(data: LoudnessData[]): void {
    if (data.length < 2) return;

    const { width, height, waveformColor, backgroundColor } = this.options;

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

    // Mask pitch background bands under the waveform with opaque background,
    // then draw translucent waveform fill on top
    for (const fillColor of [backgroundColor, waveformColor + '20']) {
      this.ctx.fillStyle = fillColor;
      this.ctx.beginPath();

      // Upper path
      let firstPoint = true;
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

    // Draw outline on top of fills
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
  }

  private drawMetronomeBeats(): void {
    const { width, height } = this.options;

    // Draw beat markers
    this.ctx.lineWidth = 1;

    // Start from the first beat that's visible in the viewport
    let currentTime = this.latency;

    // Draw beats within the viewport
    for (const click of this.clicks) {
      // Stop if we've gone past the end of the visible viewport
      if (currentTime > this.viewStartTime + this.viewDuration) {
        return;
      }
      if (!click.recording) {
        continue;
      }

      // Only draw if within the visible viewport
      if (currentTime >= this.viewStartTime && currentTime <= this.viewStartTime + this.viewDuration) {
        const x = this.timeToX(currentTime);

        // Only draw if within canvas bounds and has a level
        if (x >= 0 && x <= width && click.level > 0) {
          this.ctx.strokeStyle = this.clickLines[click.level];
          this.ctx.beginPath();
          this.ctx.moveTo(x, 0);
          this.ctx.lineTo(x, height);
          this.ctx.stroke();
        }
      }

      currentTime += click.delay / this.recordSpeed;
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
