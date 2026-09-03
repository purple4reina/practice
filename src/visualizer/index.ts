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

const CHROMATIC_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// A visible loudness point's pitch wash: the rgba fill plus the note name (with
// octave, e.g. "C4") it came from, so repeated-note onsets can be detected.
interface WaveformPitch {
  color: string;
  note: string;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = (h % 360) / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (hPrime < 1) [r, g, b] = [c, x, 0];
  else if (hPrime < 2) [r, g, b] = [x, c, 0];
  else if (hPrime < 3) [r, g, b] = [0, c, x];
  else if (hPrime < 4) [r, g, b] = [0, x, c];
  else if (hPrime < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return [r + m, g + m, b + m];
}

// WCAG relative luminance - weights green far higher than red or blue, which is exactly
// why pure yellow-green hues (around E/F/F#/G) look far brighter than red or blue hues
// at the same HSL lightness.
function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

// Binary search the HSL lightness that makes a given hue hit a target relative luminance.
// Luminance increases monotonically with lightness for a fixed hue/saturation (l=0 is
// always black, l=1 is always white), so bisection is safe.
function lightnessForLuminance(hue: number, saturation: number, targetLuminance: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const [r, g, b] = hslToRgb(hue, saturation, mid);
    if (relativeLuminance(r, g, b) < targetLuminance) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (c: number) => {
    const hex = Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

const CHROMA_SATURATION = 0.75;
const CHROMA_TARGET_LUMINANCE = 0.3;

// Ctrl+wheel (trackpad pinch) zoom step, applied as WHEEL_ZOOM_SENSITIVITY ** deltaY per
// event. deltaY is clamped to WHEEL_ZOOM_MAX_DELTA first so no single anomalous/large event
// can jump the zoom to an extreme in one step.
const WHEEL_ZOOM_SENSITIVITY = 1.01;
const WHEEL_ZOOM_MAX_DELTA = 60;
// Largest single-event zoom step allowed, shared with touch-pinch so a distance-tracking
// glitch (currentDistance briefly reading near zero) can't jump the zoom to an extreme either.
const MAX_SINGLE_STEP_ZOOM_FACTOR = Math.pow(WHEEL_ZOOM_SENSITIVITY, WHEEL_ZOOM_MAX_DELTA);

// Equal-luminance chromatic palette: every note gets the same saturation and the same
// WCAG relative luminance, varying only hue (evenly spaced around the wheel in note order).
// This replaces a hand-picked ROYGBIV hex palette where yellow-green notes (E/F/F#/G) were
// several times brighter than red/blue notes at the same opacity, making them wash out
// against the light canvas background.
function buildChromaticColors(): { [key: string]: string } {
  const colors: { [key: string]: string } = {};
  CHROMATIC_NOTE_NAMES.forEach((name, i) => {
    const hue = i * 30;
    const l = lightnessForLuminance(hue, CHROMA_SATURATION, CHROMA_TARGET_LUMINANCE);
    const [r, g, b] = hslToRgb(hue, CHROMA_SATURATION, l);
    colors[name] = rgbToHex(r, g, b);
  });
  return colors;
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
  private intonationCache: { clip: Clip; offsetSamples: number; data: IntonationData } | null = null;
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
  private scheduledDurationMs: number = 0; // "total time" denominator for the current clip
  private savedZoomFraction: number | null = null; // fraction of scheduledDurationMs visible; null = never manually zoomed

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
        const clampedDeltaY = Math.max(-WHEEL_ZOOM_MAX_DELTA, Math.min(WHEEL_ZOOM_MAX_DELTA, e.deltaY));
        const zoomFactor = Math.pow(WHEEL_ZOOM_SENSITIVITY, clampedDeltaY);
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
        const rawFactor = this.lastPinchDistance / currentDistance;
        const zoomFactor = Math.max(1 / MAX_SINGLE_STEP_ZOOM_FACTOR, Math.min(MAX_SINGLE_STEP_ZOOM_FACTOR, rawFactor));
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

    if (Math.abs(newViewDuration - this.viewDuration) < this.viewDuration * 0.001) return; // Prevent tiny changes

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
      const denominator = this.scheduledDurationMs > 0 ? this.scheduledDurationMs : this.totalDuration;
      if (denominator > 0) {
        this.savedZoomFraction = this.viewDuration / denominator;
      }

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
    this.savedZoomFraction = null;
    this.draw();
  }

  drawVisualization(clip: Clip, offsetMs: number = 0) {
    const offsetSamples = Math.floor((offsetMs / 1000) * clip.audioBuffer.sampleRate);
    this.loudnessData = this.loudnessAnalyzer.calculateLoudnessFromBuffer(clip.audioBuffer, undefined, offsetSamples);
    this.intonationData = this.computeIntonationData(clip, offsetSamples);
    this.clicks = clip.playClicks;
    this.recordSpeed = clip.recordSpeed;
    this.latency = clip.latency - offsetMs;
    this.scheduledDurationMs = clip.scheduledDurationMs;
    this.updateScrollingState();
    this.draw();
  }

  // Re-runs pitch analysis (reusing a cached result when available) and repaints,
  // without resetting loudness/scroll/viewport state, so it's safe to call from a
  // toggle handler while playback is active.
  refreshIntonation(clip: Clip, offsetMs: number = 0): void {
    const offsetSamples = Math.floor((offsetMs / 1000) * clip.audioBuffer.sampleRate);
    this.intonationData = this.computeIntonationData(clip, offsetSamples);
    this.draw();
  }

  // The YIN sliding-window analysis is expensive, so once it's been run for a given
  // clip/offset (with the tuner or pitch-detection toggle on), cache the result. This
  // lets toggling the tuner off and back on reuse the data instead of re-deriving it.
  private computeIntonationData(clip: Clip, offsetSamples: number): IntonationData {
    if (this.intonationCache?.clip === clip && this.intonationCache.offsetSamples === offsetSamples) {
      return this.intonationCache.data;
    }

    const data = this.tuner.analyze(clip.audioBuffer, offsetSamples);
    if (this.tuner.tunerEnabled() || this.tuner.detectionEnabled()) {
      this.intonationCache = { clip, offsetSamples, data };
    }
    return data;
  }

  isPlaying(): boolean {
    return this.isPlaybackActive;
  }

  private updateScrollingState(): void {
    if (this.loudnessData.length === 0) {
      this.totalDuration = 0;
      this.isScrollingEnabled = false;
      this.updateCursor();
      return;
    }

    this.totalDuration = this.loudnessData[this.loudnessData.length - 1].timestamp;

    // Always reset to beginning
    this.viewStartTime = 0;

    if (this.savedZoomFraction === null) {
      // Never manually zoomed: fall back to the fixed default viewport for long
      // recordings, or show the whole clip for short ones.
      this.isScrollingEnabled = this.totalDuration > this.options.scrollThreshold;
      this.viewDuration = this.isScrollingEnabled ? this.options.viewportDuration : this.totalDuration;
    } else {
      // A saved zoom fraction applies regardless of clip length, so it sticks
      // across recordings even when a take is shorter than scrollThreshold.
      const desiredViewDuration = this.savedZoomFraction * this.scheduledDurationMs;
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

  // Replicates drawMetronomeBeats()'s accumulation to get each recording click's absolute
  // timestamp, in the same coordinate space as viewStartTime/viewDuration.
  private recordingClickTimestamps(): number[] {
    const timestamps: number[] = [];
    let currentTime = this.latency;
    for (const click of this.clicks) {
      if (!click.recording) continue;
      timestamps.push(currentTime);
      currentTime += click.delay / this.recordSpeed;
    }
    return timestamps;
  }

  // If the previous clip's first and last recording clicks are both already visible in the
  // current viewport, the saved zoom isn't a meaningful "zoom" worth protecting, so drop it.
  private clearZoomIfFullyVisible(): void {
    if (this.savedZoomFraction === null || this.clicks.length === 0) return;
    const timestamps = this.recordingClickTimestamps();
    if (timestamps.length === 0) return;
    const firstClick = timestamps[0];
    const lastClick = timestamps[timestamps.length - 1];
    const viewEnd = this.viewStartTime + this.viewDuration;
    const bothVisible = firstClick >= this.viewStartTime && firstClick <= viewEnd
      && lastClick >= this.viewStartTime && lastClick <= viewEnd;
    if (bothVisible) {
      this.savedZoomFraction = null;
    }
  }

  clear(): void {
    this.clearZoomIfFullyVisible();
    this.loudnessData = [];
    this.intonationData = null;
    this.intonationCache = null;
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
    if (this.loudnessData.length >= 2 && this.tuner.detectionEnabled()) {
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
    if (this.tuner.tunerEnabled()) {
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

  private static readonly CHROMATIC_COLORS: { [key: string]: string } = buildChromaticColors();
  private static readonly PITCH_BG_LOUDNESS_THRESHOLD = 0.015; // RMS below this = no background color
  private static readonly PITCH_ONSET_MARKER_WIDTH = 1; // px, darker sliver marking where each new pitch color begins
  // Scaling rgb channels down (shading toward black) muddies saturated hues like pink toward grey/maroon
  // rather than reading as a darker version of the same color, so keep this mild.
  private static readonly PITCH_ONSET_DARKEN_FACTOR = 0.9;

  // Segment alpha can be as low as ~0.1, and at that opacity any color gets diluted almost entirely
  // by the near-white canvas background and reads as grey rather than its hue - so the marker is
  // always drawn fully opaque, reading as the note's own vivid hue instead of a tint of it.
  private darkenColor(rgbaColor: string, factor: number): string {
    const match = rgbaColor.match(/rgba\((\d+), (\d+), (\d+)/);
    if (!match) return rgbaColor;
    const [, r, g, b] = match;
    const dr = Math.round(parseInt(r) * factor);
    const dg = Math.round(parseInt(g) * factor);
    const db = Math.round(parseInt(b) * factor);
    return `rgb(${dr}, ${dg}, ${db})`;
  }

  private getWaveformColors(visibleData: LoudnessData[]): (WaveformPitch | null)[] {
    if (!this.intonationData || this.intonationData.points.length === 0) {
      return visibleData.map(() => null);
    }

    const toneIntervalMs = (60 / this.intonationData.sampleRate) * 1000;
    const loudnessThreshold = Visualizer.PITCH_BG_LOUDNESS_THRESHOLD;

    // Map each loudness data point to its corresponding intonation color
    return visibleData.map(point => {
      if (point.loudness < loudnessThreshold) return null;

      const intonationIndex = Math.round(point.timestamp / toneIntervalMs);
      if (intonationIndex >= 0 && intonationIndex < this.intonationData!.points.length) {
        const intonationPoint = this.intonationData!.points[intonationIndex];

        if (!intonationPoint) return null;

        // Extract note name without octave (e.g., "C4" -> "C")
        const noteName = intonationPoint.name.replace(/\d+$/, '');
        const baseColor = Visualizer.CHROMATIC_COLORS[noteName];

        if (!baseColor) return null;

        // Extract octave number
        const octaveMatch = intonationPoint.name.match(/\d+$/);
        const octave = octaveMatch ? parseInt(octaveMatch[0]) : 4;

        // Map octave to opacity: lower octaves = less opaque, higher = more opaque
        // Range spans octave 1-7 (bass clarinet reaches concert octave 1)
        // Map octave 1 -> 0.1 opacity, octave 7 -> 0.3 opacity (pastel effect)
        const minOctave = 1;
        const maxOctave = 7;
        const minOpacity = 0.1;
        const maxOpacity = 0.3;

        const clampedOctave = Math.max(minOctave, Math.min(maxOctave, octave));
        const opacity = minOpacity + (clampedOctave - minOctave) * (maxOpacity - minOpacity) / (maxOctave - minOctave);

        // Convert hex color to rgba with opacity
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);

        return { color: `rgba(${r}, ${g}, ${b}, ${opacity})`, note: intonationPoint.name };
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
    let prevNote: string | null = null;
    while (segStart < visibleData.length) {
      const seg = colors[segStart];
      const color = seg?.color ?? null;
      let segEnd = segStart;
      while (segEnd < visibleData.length && (colors[segEnd]?.color ?? null) === color) {
        segEnd++;
      }

      // Skip segments where no pitch was detected
      if (seg !== null && color !== null) {
        const x1 = Math.max(0, this.timeToX(visibleData[segStart].timestamp));
        const x2 = segEnd < visibleData.length
          ? this.timeToX(visibleData[segEnd].timestamp)
          : this.timeToX(visibleData[segEnd - 1].timestamp) + 1;

        // Darker onset marker at the start of the segment, so the moment a new pitch
        // begins is visible even though the pitch wash itself is pastel/translucent.
        // Skip it when this segment is the same pitch (note + octave) as the previous
        // detected one - a repeated note shouldn't get a divider that reads like a
        // note change, and it's easy to confuse with the metronome beat lines.
        if (seg.note !== prevNote) {
          const markerEnd = Math.min(x2, x1 + Visualizer.PITCH_ONSET_MARKER_WIDTH);
          this.ctx.fillStyle = this.darkenColor(color, Visualizer.PITCH_ONSET_DARKEN_FACTOR);
          this.ctx.fillRect(x1, 0, markerEnd - x1, height);

          // Color already includes opacity from getWaveformColors
          this.ctx.fillStyle = color;
          this.ctx.fillRect(markerEnd, 0, x2 - markerEnd, height);
        } else {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(x1, 0, x2 - x1, height);
        }

        prevNote = seg.note;
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
    if (!this.tuner.tunerEnabled() || !this.intonationData) return;

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
