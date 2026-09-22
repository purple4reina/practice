// Shared helpers for building real BlockManager -> ClipSettings -> Clip
// pipelines from query-param block configs, and for computing ground-truth
// buffer positions independently of the production code under test. Used by
// both the exact-repro regression scenarios and the combinatorial
// prelay/postlay matrix.
import BlockManager from "../blocks";
import QueryParams from "../query-params";
import { ClipSettings, Clip } from "../clips";
import { resetDom } from "./dom";

export class FakeAudioContext {
  sampleRate = 44100;
  currentTime = 0;
}

export function realishAudioBuffer(durationMs: number, sampleRate = 44100): AudioBuffer {
  const length = Math.round((durationMs / 1000) * sampleRate);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) data[i] = 0.3 * Math.sin(i * 0.05); // audible throughout, incl. the tail
  return { sampleRate, length, duration: length / sampleRate, getChannelData: () => data } as unknown as AudioBuffer;
}

export function buildScenario(params: [string, string][], recordSpeed: number, hardwareLatency: number) {
  resetDom();
  QueryParams.replace(new URLSearchParams());
  const usp = new URLSearchParams();
  for (const [k, v] of params) usp.append(k, v);
  QueryParams.replace(usp);

  const manager = new BlockManager();
  const recordClicks = manager.recordClicks();
  const playClicks = manager.playClicks();
  const settings = new ClipSettings(recordClicks, playClicks, recordSpeed, hardwareLatency);
  const audioBuffer = realishAudioBuffer(settings.stopRecordingDelay - settings.startRecordingDelay);
  const clip = new Clip(settings, audioBuffer);

  return { recordClicks, playClicks, settings, clip };
}

// Real-time (ms, from the record button press) each recordClicks entry is
// scheduled at, replicating RecordingMetronome.start()/_start()/scheduler()
// exactly: metronome start = recordingPrelay, then accumulate delay/speed.
// Returns the buffer-relative onset (ms from startRecordingDelay) of every
// *actually recorded* click, oldest first.
//
// BlockManager appends a synthetic end-marker as the final click, which can
// carry recording:true (whenever "stop" runs after the last recorded block).
// ClipSettings.getRecordDelays() drops it before finding the last recorded
// click; this must do the same so the ground truth matches what ClipSettings
// actually measures against.
export function groundTruthBufferPositions(
  recordClicks: ReturnType<BlockManager["recordClicks"]>,
  settings: ClipSettings,
): number[] {
  const clicks = recordClicks.slice(0, -1);

  let nextClickTimeMs = settings.recordingPrelay;
  const positions: number[] = [];
  for (const click of clicks) {
    if (click.recording) positions.push(nextClickTimeMs - settings.startRecordingDelay);
    nextClickTimeMs += click.delay / settings.recordSpeed;
  }
  return positions;
}

// Buffer-relative time (ms from startRecordingDelay) at which the *last*
// recorded click's own interval ends - its onset plus its own (scaled) delay
// - matching what ClipSettings.getRecordDelays() measures the postlay pad
// from. A click's `delay` is the gap before the *next* pulse; for the last
// recorded click that gap is still time the recording is meant to cover, so
// it must count toward the buffer, not just the click's onset instant.
// Returns null when nothing was recorded.
export function groundTruthLastRecordedClickEndMs(
  recordClicks: ReturnType<BlockManager["recordClicks"]>,
  settings: ClipSettings,
): number | null {
  const clicks = recordClicks.slice(0, -1);

  let nextClickTimeMs = settings.recordingPrelay;
  let lastEndMs: number | null = null;
  for (const click of clicks) {
    const scaledDelay = click.delay / settings.recordSpeed;
    if (click.recording) lastEndMs = (nextClickTimeMs + scaledDelay) - settings.startRecordingDelay;
    nextClickTimeMs += scaledDelay;
  }
  return lastEndMs;
}

// --- Block-config query-param builders, matching each block's own
// queryString() encoding (see src/blocks/*.ts). Kept intentionally minimal -
// only what the pre/postlay matrix needs. ---

export const START: [string, string] = ["start", ""];
export const RECORD: [string, string] = ["record", ""];
export const STOP: [string, string] = ["stop", ""];
export const DONE: [string, string] = ["done", ""];

export function metronomeParam(bpm: number): [string, string] {
  return ["metronome", encodeURIComponent(`bpm:${bpm}`)];
}

export function subdivisionParam(recordSubdivisions: number, playbackSubdivisions: number): [string, string] {
  return ["subdivision", encodeURIComponent(`recordSubdivisions:${recordSubdivisions} playbackSubdivisions:${playbackSubdivisions}`)];
}

export function beatsParam(count: number): [string, string] {
  return ["beats", encodeURIComponent(`count:${count}`)];
}

export function pauseParam(ms: number): [string, string] {
  return ["pause", encodeURIComponent(`pause:${ms}`)];
}

export function patternParam(beats: number, start: number, pattern: number[]): [string, string] {
  return ["pattern", encodeURIComponent(`beats:${beats} start:${start} pattern:${pattern.join(",")}`)];
}

export function midiParam(notation: string, opts: { recEnable?: boolean; playEnable?: boolean } = {}): [string, string] {
  const { recEnable = false, playEnable = false } = opts;
  return [
    "midi",
    encodeURIComponent(`timeSig:4 notation:${notation} recEnable:${recEnable} playEnable:${playEnable} transpose:C`),
  ];
}

export function accelerandoParam(kind: string): [string, string] {
  return ["accelerando", encodeURIComponent(`kind:${kind}`)];
}
