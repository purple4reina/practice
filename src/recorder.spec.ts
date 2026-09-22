// The capture path had no coverage at all: every other suite fabricates an
// AudioBuffer directly and never runs src/recorder.ts, which is how a race
// that truncates the end of every recording survived several rounds of
// "last beat is missing" fixes aimed further downstream.
//
// These tests deliberately use jsdom's real MessageChannel rather than a
// hand-rolled port fake. Its delivery is genuinely asynchronous and FIFO, the
// same properties an AudioWorkletNode's port has - a fake that invoked the
// message handler synchronously would mask the exact bug under test.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecorderDevice, { RECORDER_WORKLET_SOURCE } from "./recorder";

const QUANTUM = 128;
const SP_BUFFER = 4096;

// Runs the real worklet source - the string that actually ships inside the
// blob URL - so these tests can't drift away from the shipped processor.
function instantiateRealWorklet(port: MessagePort): any {
  let Registered: any = null;
  class FakeAudioWorkletProcessor {
    port: MessagePort;
    constructor() {
      this.port = port;
    }
  }
  new Function("AudioWorkletProcessor", "registerProcessor", RECORDER_WORKLET_SOURCE)(
    FakeAudioWorkletProcessor,
    (_name: string, ctor: any) => { Registered = ctor; },
  );
  return new Registered();
}

// One macrotask turn, which is what a MessagePort needs to actually deliver.
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
async function turns(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await turn();
}

class WorkletHarness {
  readonly nodePort: MessagePort;
  readonly workletPort: MessagePort;
  readonly processor: any;

  constructor(alive: boolean) {
    const channel = new MessageChannel();
    this.nodePort = channel.port1;
    this.workletPort = channel.port2;
    this.processor = alive ? instantiateRealWorklet(channel.port2) : null;
  }

  // One render quantum on the audio thread.
  render(value: number): void {
    const chan = new Float32Array(QUANTUM).fill(value);
    this.processor.process([[chan, chan]], []);
  }
}

class FakeScriptProcessorNode {
  onaudioprocess: ((event: any) => void) | null = null;
  connect(): void {}
  disconnect(): void {}

  // One onaudioprocess dispatch on the main thread.
  render(value: number): void {
    const chan = new Float32Array(SP_BUFFER).fill(value);
    this.onaudioprocess?.({
      inputBuffer: { numberOfChannels: 2, getChannelData: () => chan },
    });
  }
}

let workletHarness: WorkletHarness | null = null;
let scriptNode: FakeScriptProcessorNode | null = null;
let workletAlive = true;
let addModuleFails = false;

class FakeAudioWorkletNode {
  port: MessagePort;
  constructor(_context: unknown, _name: string) {
    workletHarness = new WorkletHarness(workletAlive);
    this.port = workletHarness.nodePort;
  }
}

function makeContext(): AudioContext {
  return {
    sampleRate: 44100,
    destination: {},
    audioWorklet: {
      addModule: async () => {
        if (addModuleFails) throw new Error("AudioWorklet unavailable");
      },
    },
    createMediaStreamSource: () => ({ connect() {}, disconnect() {} }),
    createScriptProcessor: () => {
      scriptNode = new FakeScriptProcessorNode();
      return scriptNode;
    },
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => {
      const channels = [new Float32Array(length), new Float32Array(length)];
      return {
        numberOfChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (i: number) => channels[i],
      };
    },
  } as unknown as AudioContext;
}

async function makeDevice(): Promise<RecorderDevice> {
  const device = new RecorderDevice(makeContext());
  await device.initialize();
  if (!addModuleFails && workletHarness === null) {
    throw new Error("expected the AudioWorklet path, got the ScriptProcessor fallback");
  }
  return device;
}

beforeEach(() => {
  workletHarness = null;
  scriptNode = null;
  workletAlive = true;
  addModuleFails = false;
  vi.stubGlobal("AudioWorkletNode", FakeAudioWorkletNode);
  vi.stubGlobal("ScriptProcessorNode", FakeScriptProcessorNode);
  // jsdom's URL.createObjectURL throws on a real Blob, which would send
  // initialize() down the ScriptProcessor fallback and quietly stop these
  // tests from covering the worklet path at all.
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:recorder-worklet");
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: async () => ({}) },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recorder worklet", () => {
  it("acks the stop command behind every audiodata message it already posted", async () => {
    const channel = new MessageChannel();
    const processor = instantiateRealWorklet(channel.port2);
    const received: string[] = [];
    channel.port1.onmessage = event => received.push(event.data.type);

    channel.port1.postMessage({ command: "start" });
    await turns(2);

    const chan = new Float32Array(QUANTUM).fill(0.5);
    processor.process([[chan, chan]], []);
    processor.process([[chan, chan]], []);
    processor.process([[chan, chan]], []);

    // The race, stated plainly: three quanta are captured and posted, and the
    // main thread has seen none of them. Anything that snapshots the recorded
    // data at this instant loses all three.
    expect(received).toEqual([]);

    channel.port1.postMessage({ command: "stop" });
    await turns(4);

    expect(received).toEqual(["audiodata", "audiodata", "audiodata", "stopped"]);

    // The ack is also a promise that nothing further is coming.
    processor.process([[chan, chan]], []);
    await turns(2);
    expect(received).toEqual(["audiodata", "audiodata", "audiodata", "stopped"]);
  });
});

describe("RecorderDevice.stop", () => {
  it("keeps the quanta the worklet posted just before stop()", async () => {
    const device = await makeDevice();
    device.start();
    await turns(2);

    workletHarness!.render(0.25);
    await turns(2); // delivered the ordinary way

    workletHarness!.render(0.5);
    workletHarness!.render(0.75); // still in flight when stop() runs

    await device.stop();

    const buffer = device.getAudioBuffer()!;
    expect(buffer).not.toBeNull();
    expect(buffer.length).toBe(3 * QUANTUM);
    // The final quantum is the last audio captured, not padding.
    expect(buffer.getChannelData(0)[2 * QUANTUM + 1]).toBeCloseTo(0.75);
    expect(buffer.getChannelData(1)[2 * QUANTUM + 1]).toBeCloseTo(0.75);
  });

  it("makes a second stop() wait for the in-flight one", async () => {
    const device = await makeDevice();
    device.start();
    await turns(2);

    workletHarness!.render(0.6);

    // record()'s stopRecordingTimeout fires stop() without awaiting it, then
    // stopRecording() calls stop() again and reads the buffer straight after.
    const first = device.stop();
    await device.stop();

    expect(device.getAudioBuffer()?.length).toBe(QUANTUM);
    await first;
  });

  it("still finishes when the worklet never acks the stop", async () => {
    workletAlive = false;
    const device = await makeDevice();
    device.start();

    const chan = new Float32Array(QUANTUM).fill(0.4);
    workletHarness!.workletPort.postMessage({
      type: "audiodata",
      audioDataL: chan,
      audioDataR: chan,
    });
    await turns(2);

    vi.useFakeTimers();
    try {
      const stopping = device.stop();
      await vi.advanceTimersByTimeAsync(300);
      await stopping;
    } finally {
      vi.useRealTimers();
    }

    expect(device.getAudioBuffer()?.length).toBe(QUANTUM);
  });

  it("keeps a ScriptProcessor buffer that was already queued when stop() was called", async () => {
    addModuleFails = true;
    const device = await makeDevice();
    device.start();

    scriptNode!.render(0.25);

    // onaudioprocess runs on the main thread, but its events are still queued
    // tasks: this one was queued before the user hit stop, so it dispatches
    // ahead of stop()'s own drain turn - the ordering a browser produces.
    setTimeout(() => scriptNode!.render(0.5), 0);
    await device.stop();

    const buffer = device.getAudioBuffer()!;
    expect(buffer.length).toBe(2 * SP_BUFFER);
    expect(buffer.getChannelData(0)[SP_BUFFER + 1]).toBeCloseTo(0.5);
  });
});
