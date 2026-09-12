import { expect, describe, test, beforeEach, vi } from "vitest";
import RecorderDevice from "./recorder";
import {
  FakeAudioContext,
  FakeAudioWorkletNode,
  FakeScriptProcessorNode,
  installAudioGlobals,
} from "./test-support/fake-audio";

let ctx: FakeAudioContext;
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  installAudioGlobals();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });

  ctx = new FakeAudioContext();
  getUserMedia = vi.fn(() => Promise.resolve(new (globalThis as any).MediaStream()));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});

describe("RecorderDevice.initialize", () => {
  test("requests a stereo, echo/AGC-disabled microphone stream", async () => {
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: expect.objectContaining({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
      }),
    }));
  });

  test("prefers an AudioWorkletNode when the worklet module registers successfully", async () => {
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();

    expect(ctx.audioWorklet.addModule).toHaveBeenCalled();
    expect(ctx.createScriptProcessor).not.toHaveBeenCalled();
  });

  test("falls back to a ScriptProcessorNode when the AudioWorklet module fails to register", async () => {
    ctx.audioWorklet.addModule.mockRejectedValueOnce(new Error("not supported"));
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();

    expect(ctx.createScriptProcessor).toHaveBeenCalledWith(4096, 2, 2);
  });

  test("propagates getUserMedia rejection (e.g. permission denied)", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("Permission denied"));
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await expect(recorder.initialize()).rejects.toThrow("Permission denied");
  });
});

describe("RecorderDevice start/stop (AudioWorklet path)", () => {
  async function initializedRecorder(): Promise<RecorderDevice> {
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();
    return recorder;
  }

  test("start() connects the graph and tells the worklet to start recording", async () => {
    const recorder = await initializedRecorder();
    recorder.start();

    const source = ctx.createMediaStreamSource.mock.results[0].value as any;
    expect(source.connections.some((n: any) => n instanceof FakeAudioWorkletNode)).toBe(true);
  });

  test("calling start() twice logs an error and does not reset the second time", () => {
    return initializedRecorder().then(recorder => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      recorder.start();
      recorder.start();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("not in a stopped state"));
      errorSpy.mockRestore();
    });
  });

  test("recorded audio chunks are assembled into a stereo AudioBuffer on stop", async () => {
    const recorder = await initializedRecorder();
    recorder.start();

    const worklet = ctx.createMediaStreamSource.mock.results[0].value.connections
      .find((n: any) => n instanceof FakeAudioWorkletNode) as FakeAudioWorkletNode;

    worklet.port.onmessage!({
      data: { type: "audiodata", audioDataL: [0.1, 0.2], audioDataR: [0.3, 0.4] },
    } as MessageEvent);
    worklet.port.onmessage!({
      data: { type: "audiodata", audioDataL: [0.5], audioDataR: [0.6] },
    } as MessageEvent);

    recorder.stop();

    const buffer = recorder.getAudioBuffer();
    expect(buffer).not.toBeNull();
    expect(ctx.createBuffer).toHaveBeenCalledWith(2, 3, ctx.sampleRate);
    // Compare via Float32Array so both sides go through the same float32 rounding.
    expect([...(buffer as any).getChannelData(0)]).toEqual([...new Float32Array([0.1, 0.2, 0.5])]);
    expect([...(buffer as any).getChannelData(1)]).toEqual([...new Float32Array([0.3, 0.4, 0.6])]);
  });

  test("getAudioBuffer() returns null after the buffer has already been retrieved once", async () => {
    const recorder = await initializedRecorder();
    recorder.start();
    const worklet = ctx.createMediaStreamSource.mock.results[0].value.connections
      .find((n: any) => n instanceof FakeAudioWorkletNode) as FakeAudioWorkletNode;
    worklet.port.onmessage!({ data: { type: "audiodata", audioDataL: [0.1], audioDataR: [0.1] } } as MessageEvent);
    recorder.stop();

    recorder.getAudioBuffer();
    expect(recorder.getAudioBuffer()).toBeNull();
  });

  test("stop() while not recording is a no-op", async () => {
    const recorder = await initializedRecorder();
    expect(() => recorder.stop()).not.toThrow();
    expect(recorder.getAudioBuffer()).toBeNull();
  });

  test("stop() with no recorded data logs a warning and leaves no buffer", async () => {
    const recorder = await initializedRecorder();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    recorder.start();
    recorder.stop();

    expect(warnSpy).toHaveBeenCalledWith("No audio data recorded");
    expect(recorder.getAudioBuffer()).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("RecorderDevice (ScriptProcessorNode fallback path)", () => {
  test("onaudioprocess only captures samples while in the RECORDING state", async () => {
    ctx.audioWorklet.addModule.mockRejectedValueOnce(new Error("not supported"));
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();

    const node = ctx.createScriptProcessor.mock.results[0].value as FakeScriptProcessorNode;
    const fakeEvent = {
      inputBuffer: {
        numberOfChannels: 2,
        getChannelData: (ch: number) => (ch === 0 ? new Float32Array([0.1, 0.2]) : new Float32Array([0.3, 0.4])),
      },
    };

    node.onaudioprocess!(fakeEvent); // not recording yet - ignored
    recorder.start();
    node.onaudioprocess!(fakeEvent);
    recorder.stop();

    const buffer = recorder.getAudioBuffer();
    expect([...(buffer as any).getChannelData(0)]).toEqual([...new Float32Array([0.1, 0.2])]);
  });

  test("mono input is duplicated to both channels", async () => {
    ctx.audioWorklet.addModule.mockRejectedValueOnce(new Error("not supported"));
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();

    const node = ctx.createScriptProcessor.mock.results[0].value as FakeScriptProcessorNode;
    const monoEvent = {
      inputBuffer: {
        numberOfChannels: 1,
        getChannelData: () => new Float32Array([0.7, 0.8]),
      },
    };

    recorder.start();
    node.onaudioprocess!(monoEvent);
    recorder.stop();

    const buffer = recorder.getAudioBuffer();
    const expected = [...new Float32Array([0.7, 0.8])];
    expect([...(buffer as any).getChannelData(0)]).toEqual(expected);
    expect([...(buffer as any).getChannelData(1)]).toEqual(expected);
  });
});

describe("RecorderDevice.reset", () => {
  test("re-arms the recorder so it can record again after a completed take", async () => {
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();
    recorder.start();
    recorder.stop();
    recorder.getAudioBuffer();

    recorder.reset();
    expect(() => recorder.start()).not.toThrow();
  });

  test("stops an in-progress recording before resetting", async () => {
    const recorder = new RecorderDevice(ctx as unknown as AudioContext);
    await recorder.initialize();
    recorder.start();

    recorder.reset();

    // recorder is stopped and re-armed - starting again should work cleanly
    expect(() => recorder.start()).not.toThrow();
  });
});
