import { vi } from "vitest";

// Web Audio isn't implemented by jsdom. This is a minimal fake of just the
// surface this codebase actually calls, shared across the device-class specs
// (synth/drone/player/recorder/metronome) so each one isn't hand-rolling its
// own AudioContext double.

export class FakeAudioParam {
  value = 0;
  setValueAtTime = vi.fn((v: number) => { this.value = v; return this; });
  linearRampToValueAtTime = vi.fn((v: number) => { this.value = v; return this; });
  exponentialRampToValueAtTime = vi.fn((v: number) => { this.value = v; return this; });
  cancelScheduledValues = vi.fn(() => this);
}

export class FakeAudioNode {
  connections: FakeAudioNode[] = [];
  connect = vi.fn((dest: FakeAudioNode) => { this.connections.push(dest); return dest; });
  disconnect = vi.fn();
}

export class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

export class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = "sine";
  frequency = new FakeAudioParam();
  started: number[] = [];
  stopped: number[] = [];
  onended: (() => void) | null = null;
  start = vi.fn((when?: number) => { this.started.push(when ?? 0); });
  stop = vi.fn((when?: number) => { this.stopped.push(when ?? 0); });
}

export class FakeAudioBufferSourceNode extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  playbackRate = new FakeAudioParam();
  onended: (() => void) | null = null;
  started: Array<{ when?: number; offset?: number }> = [];
  start = vi.fn((when?: number, offset?: number) => { this.started.push({ when, offset }); });
  stop = vi.fn();
}

export class FakeAudioBuffer {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  duration: number;
  private channels: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.sampleRate = sampleRate;
    this.length = length;
    this.numberOfChannels = numberOfChannels;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
}

export class FakeMediaStreamAudioSourceNode extends FakeAudioNode {}

export class FakeAudioWorkletNode extends FakeAudioNode {
  port = { onmessage: null as ((e: MessageEvent) => void) | null, postMessage: vi.fn() };
  constructor(_ctx: unknown, _name: string) { super(); }
}

export class FakeScriptProcessorNode extends FakeAudioNode {
  onaudioprocess: ((e: any) => void) | null = null;
}

export class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 2048;
  frequencyBinCount = 1024;
  getByteTimeDomainData = vi.fn();
  getFloatTimeDomainData = vi.fn();
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: "running" | "suspended" | "closed" = "running";
  destination = new FakeAudioNode();
  audioWorklet = { addModule: vi.fn(() => Promise.resolve()) };

  createOscillator = vi.fn(() => new FakeOscillatorNode());
  createGain = vi.fn(() => new FakeGainNode());
  createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode());
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => new FakeAudioBuffer(channels, length, sampleRate));
  createMediaStreamSource = vi.fn(() => new FakeMediaStreamAudioSourceNode());
  createScriptProcessor = vi.fn(() => new FakeScriptProcessorNode());
  createAnalyser = vi.fn(() => new FakeAnalyserNode());

  resume = vi.fn(() => { this.state = "running"; return Promise.resolve(); });
  suspend = vi.fn(() => { this.state = "suspended"; return Promise.resolve(); });

  // Test helper: advance the fake clock (Web Audio's currentTime doesn't tick
  // on its own here - callers step it explicitly).
  advance(seconds: number): void {
    this.currentTime += seconds;
  }
}

/** Installs global stand-ins for DOM/Web Audio constructors this codebase
 * references by bare identifier (ScriptProcessorNode, AudioWorkletNode,
 * MediaStream, MediaRecorder) - none of which jsdom provides. */
export function installAudioGlobals(): void {
  vi.stubGlobal("ScriptProcessorNode", FakeScriptProcessorNode);
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);

  class FakeMediaStreamTrack {
    kind: string;
    constructor(kind: string) { this.kind = kind; }
    stop = vi.fn();
  }

  class FakeMediaStream {
    private tracks: FakeMediaStreamTrack[];
    constructor(tracks: FakeMediaStreamTrack[] = []) { this.tracks = [...tracks]; }
    addTrack(track: FakeMediaStreamTrack) { this.tracks.push(track); }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter(t => t.kind === "video"); }
    getAudioTracks() { return this.tracks.filter(t => t.kind === "audio"); }
  }

  class FakeMediaRecorder {
    static isTypeSupported = vi.fn(() => true);
    state: "inactive" | "recording" = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(public stream: unknown, public opts: unknown) {}
    start = vi.fn(() => { this.state = "recording"; });
    stop = vi.fn(() => {
      this.state = "inactive";
      this.onstop?.();
    });
  }

  vi.stubGlobal("MediaStreamTrack", FakeMediaStreamTrack);
  vi.stubGlobal("MediaStream", FakeMediaStream);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
}
