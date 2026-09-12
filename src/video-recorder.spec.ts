import { expect, describe, test, beforeEach, vi } from "vitest";
import VideoRecorderDevice from "./video-recorder";
import { installAudioGlobals } from "./test-support/fake-audio";

let getUserMedia: ReturnType<typeof vi.fn>;
let video: HTMLVideoElement;

beforeEach(() => {
  document.body.innerHTML = '<video id="video-element"></video>';
  video = document.getElementById("video-element") as HTMLVideoElement;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

  installAudioGlobals();
  (globalThis as any).MediaRecorder.isTypeSupported = vi.fn(() => true); // default: everything supported

  const stream = new (globalThis as any).MediaStream([
    new (globalThis as any).MediaStreamTrack("video"),
  ]);
  getUserMedia = vi.fn(() => Promise.resolve(stream));
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
});

describe("getSupportedVideoFormat (via mimeType/extension)", () => {
  test("prefers video/mp4 when supported", () => {
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn((t: string) => t === "video/mp4");
    const recorder = new VideoRecorderDevice();
    expect(recorder.getMimeType()).toBe("video/mp4");
    expect(recorder.getFileExtension()).toBe("mp4");
  });

  test("falls back to vp9 webm when mp4 isn't supported", () => {
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn((t: string) => t === "video/webm;codecs=vp9");
    const recorder = new VideoRecorderDevice();
    expect(recorder.getMimeType()).toBe("video/webm;codecs=vp9");
    expect(recorder.getFileExtension()).toBe("webm");
  });

  test("falls back to plain webm when nothing more specific is supported", () => {
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn((t: string) => t === "video/webm");
    const recorder = new VideoRecorderDevice();
    expect(recorder.getMimeType()).toBe("video/webm");
  });

  test("falls back to an empty mimeType (browser default) when nothing is supported", () => {
    (globalThis as any).MediaRecorder.isTypeSupported = vi.fn(() => false);
    const recorder = new VideoRecorderDevice();
    expect(recorder.getMimeType()).toBe("");
    expect(recorder.getFileExtension()).toBe("webm");
  });
});

describe("VideoRecorderDevice.initialize", () => {
  test("requests a video-only, high-framerate stream and previews it muted", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();

    expect(getUserMedia).toHaveBeenCalledWith({ video: { frameRate: { ideal: 120 } }, audio: false });
    expect(video.srcObject).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(recorder.isInitialized()).toBe(true);
  });

  test("is not initialized before initialize() resolves", () => {
    const recorder = new VideoRecorderDevice();
    expect(recorder.isInitialized()).toBe(false);
  });
});

describe("VideoRecorderDevice.start/stop", () => {
  test("start() builds a recording stream containing the device's video track", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();

    recorder.start(100);

    const anyRecorder = (recorder as any).mediaRecorder;
    expect(anyRecorder.stream.getVideoTracks()).toHaveLength(1);
    expect(anyRecorder.stream.getAudioTracks()).toHaveLength(0);
  });

  test("start() mixes in an external audio stream's audio tracks when given", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    const audioStream = new (globalThis as any).MediaStream([
      new (globalThis as any).MediaStreamTrack("audio"),
    ]);

    recorder.start(100, audioStream);

    const anyRecorder = (recorder as any).mediaRecorder;
    expect(anyRecorder.stream.getAudioTracks()).toHaveLength(1);
  });

  test("start() is a no-op if the device was never initialized", () => {
    const recorder = new VideoRecorderDevice();
    expect(() => recorder.start(100)).not.toThrow();
  });

  test("stop() resolves with an assembled Blob from the recorded chunks", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    recorder.start(100);

    // Simulate the browser handing back a chunk of recorded data, then stopping.
    const anyRecorder = (recorder as any).mediaRecorder;
    anyRecorder.ondataavailable({ data: new Blob(["chunk"]) });

    const blob = await recorder.stop();
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
  });

  test("stop() resolves null when nothing was ever recorded", async () => {
    const recorder = new VideoRecorderDevice();
    const blob = await recorder.stop();
    expect(blob).toBeNull();
  });

  test("stop() resolves null when there were no data chunks", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    recorder.start(100);
    const blob = await recorder.stop();
    expect(blob).toBeNull();
  });
});

describe("VideoRecorderDevice.getVideoOffsetMs", () => {
  test("is 0 before a frame has been captured", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    expect(recorder.getVideoOffsetMs()).toBe(0);
  });

  test("is audioStartPerfTime minus the first captured frame's timestamp", async () => {
    let frameCallback: ((now: number) => void) | null = null;
    (video as any).requestVideoFrameCallback = vi.fn((cb: any) => { frameCallback = cb; });

    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    recorder.start(1000);
    frameCallback!(1200);

    expect(recorder.getVideoOffsetMs()).toBe(1000 - 1200);
  });

  test("only the first captured frame counts, even if the callback fires again", async () => {
    let frameCallback: ((now: number) => void) | null = null;
    (video as any).requestVideoFrameCallback = vi.fn((cb: any) => { frameCallback = cb; });

    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    recorder.start(1000);
    frameCallback!(1200);
    frameCallback!(9999);

    expect(recorder.getVideoOffsetMs()).toBe(1000 - 1200);
  });
});

describe("VideoRecorderDevice.reset", () => {
  test("stops an in-progress recording and clears its chunks", async () => {
    const recorder = new VideoRecorderDevice();
    await recorder.initialize();
    recorder.start(100);
    const anyRecorder = (recorder as any).mediaRecorder;

    recorder.reset();

    expect(anyRecorder.stop).toHaveBeenCalled();
    const blob = await recorder.stop(); // nothing left to stop/resolve
    expect(blob).toBeNull();
  });

  test("is safe to call when nothing was ever recording", () => {
    const recorder = new VideoRecorderDevice();
    expect(() => recorder.reset()).not.toThrow();
  });
});
