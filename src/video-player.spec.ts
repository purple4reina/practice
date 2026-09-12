import { expect, describe, test, beforeEach, vi } from "vitest";
import VideoPlayerDevice from "./video-player";
import { FakeAudioContext } from "./test-support/fake-audio";

let ctx: FakeAudioContext;
let video: HTMLVideoElement;

beforeEach(() => {
  document.body.innerHTML = '<video id="video-element" class="mirrored"></video>';
  video = document.getElementById("video-element") as HTMLVideoElement;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL: vi.fn() });
  ctx = new FakeAudioContext();
});

describe("VideoPlayerDevice.play", () => {
  test("wires up the video element and starts playback", async () => {
    const player = new VideoPlayerDevice();
    const blob = new Blob(["x"], { type: "video/webm" });

    await player.play(blob, 1.5, ctx as unknown as AudioContext, 0, 0, 0);

    expect(video.src).toBe("blob:mock");
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(1.5);
    expect(video.classList.contains("mirrored")).toBe(false);
    expect(video.play).toHaveBeenCalled();
  });

  test("sets currentTime from videoOffsetMs + videoLatencyMs", async () => {
    const player = new VideoPlayerDevice();
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 300, 50);
    expect(video.currentTime).toBeCloseTo(0.35, 6);
  });

  test("clamps a negative combined offset to 0", async () => {
    const player = new VideoPlayerDevice();
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, -500, 0);
    expect(video.currentTime).toBe(0);
  });

  test("stops any existing playback before starting a new one", async () => {
    const player = new VideoPlayerDevice();
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);
    (video.pause as any).mockClear();

    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);
    expect(video.pause).toHaveBeenCalled();
  });

  test("if video.play() rejects, playback is stopped and no error escapes", async () => {
    (video.play as any).mockRejectedValueOnce(new Error("blocked"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new VideoPlayerDevice();

    await expect(player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("VideoPlayerDevice.stop", () => {
  test("pauses, revokes the blob URL, and clears the src", async () => {
    const player = new VideoPlayerDevice();
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);

    player.stop();

    expect(video.pause).toHaveBeenCalled();
    expect(video.hasAttribute("src")).toBe(false);
    expect(video.load).toHaveBeenCalled();
    expect((URL.revokeObjectURL as any)).toHaveBeenCalledWith("blob:mock");
  });

  test("restores the live preview stream after stopping", async () => {
    const player = new VideoPlayerDevice();
    const liveStream = {} as MediaStream;
    player.setLiveStream(liveStream);
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);

    player.stop();

    expect(video.srcObject).toBe(liveStream);
    expect(video.muted).toBe(true);
    expect(video.playbackRate).toBe(1);
    expect(video.classList.contains("mirrored")).toBe(true);
  });

  test("calling stop() when nothing has ever played still restores the live preview", () => {
    const player = new VideoPlayerDevice();
    const liveStream = {} as MediaStream;
    player.setLiveStream(liveStream);

    player.stop();

    expect(video.srcObject).toBe(liveStream);
  });

  test("calling stop() twice is safe", async () => {
    const player = new VideoPlayerDevice();
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);
    player.stop();
    expect(() => player.stop()).not.toThrow();
  });
});

describe("VideoPlayerDevice drift correction", () => {
  test("resyncs currentTime when playback drifts beyond the threshold", async () => {
    let frameCallback: ((now: number, meta: { mediaTime: number }) => void) | null = null;
    (video as any).requestVideoFrameCallback = vi.fn((cb: any) => { frameCallback = cb; });

    const player = new VideoPlayerDevice();
    ctx.currentTime = 0;
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);

    expect(frameCallback).not.toBeNull();

    ctx.currentTime = 1.0; // 1s of audio has played
    // Video reports way more progress than expected -> drift beyond 0.08s threshold
    frameCallback!(0, { mediaTime: 5.0 });

    expect(video.currentTime).toBeCloseTo(1.0, 6);
  });

  test("does not resync when drift is within the threshold", async () => {
    let frameCallback: ((now: number, meta: { mediaTime: number }) => void) | null = null;
    (video as any).requestVideoFrameCallback = vi.fn((cb: any) => { frameCallback = cb; });

    const player = new VideoPlayerDevice();
    ctx.currentTime = 0;
    await player.play(new Blob(), 1.0, ctx as unknown as AudioContext, 0, 0, 0);
    video.currentTime = 123; // sentinel - should be left alone

    ctx.currentTime = 1.0;
    frameCallback!(0, { mediaTime: 1.02 }); // 20ms drift, under the 80ms threshold

    expect(video.currentTime).toBe(123);
  });
});
