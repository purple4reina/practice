import { boolSwitchControls } from "../controls";
import {
  IntonationPoint,
  HOP_SIZE,
  createPitchDetectors,
  detectPitchTrack,
  PitchDetector,
} from "./pitch-track";

export interface IntonationData {
  sampleRate: number;
  points: (IntonationPoint | null)[];
}

// Analyses slower than this get a console warning. A long recording that is
// mostly sub-86Hz playing pushes the adaptive low-range pass (see pitch-track.ts)
// into multi-second territory - bounded and expected, but worth surfacing.
const PITCH_ANALYSIS_WARN_MS = 2000;

export class Tuner {
  private audioContextSampleRate: number;
  private detectPitch: PitchDetector;
  private detectPitchLow: PitchDetector;

  public tunerEnabled = boolSwitchControls("tuner-enabled", { initial: false });
  public detectionEnabled = boolSwitchControls("pitch-detection-enabled", { initial: false });

  constructor(audioContext: AudioContext) {
    this.audioContextSampleRate = audioContext.sampleRate;
    const detectors = createPitchDetectors(audioContext.sampleRate);
    this.detectPitch = detectors.detectPitch;
    this.detectPitchLow = detectors.detectPitchLow;
  }

  analyze(audioBuffer: AudioBuffer, startSample = 0): IntonationData {
    // Time between data points = hopSize / sampleRate (seconds), expressed here
    // as points-per-minute so downstream code can convert back to ms per point.
    const temporalSampleRate = (60 * this.audioContextSampleRate) / HOP_SIZE;

    const data: IntonationData = {
      sampleRate: temporalSampleRate,
      points: [],
    };

    if (this.tunerEnabled() || this.detectionEnabled()) {
      const channelData = audioBuffer.getChannelData(0).subarray(startSample);
      const start = performance.now();
      data.points = detectPitchTrack(channelData, {
        sampleRate: this.audioContextSampleRate,
        detectPitch: this.detectPitch,
        detectPitchLow: this.detectPitchLow,
      });
      const elapsed = performance.now() - start;
      if (elapsed > PITCH_ANALYSIS_WARN_MS) {
        console.warn(
          `Pitch analysis took ${elapsed.toFixed(0)}ms for ${channelData.length} samples`,
        );
      }
    }

    return data;
  }
}
