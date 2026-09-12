import { expect, describe, test, beforeEach, vi } from "vitest";
import { ClipSettings, Clip } from "./clips";
import { Click } from "./blocks/clicks";

function click(delay: number, recording: boolean): Click {
  return { delay, level: 1, started: true, recording };
}

describe("ClipSettings delay calculations", () => {
  test("finds the first/last recording click and derives all delays from them", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false), // 4 count-in
      click(1000, true), click(1000, true), click(1000, true), // 3 recorded beats
      click(350, true), // synthetic end marker (dropped from the delay calculation)
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 145);

    expect(settings.startRecordingDelay).toBe(4000); // ms elapsed before the first recording click
    expect(settings.stopRecordingDelay).toBe(100 + 6000 + 350); // prelay + last click's elapsed + postlay
    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + 100);
  });

  test("recordSpeed scales both start and stop delays", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false),
      click(1000, true), click(1000, true), click(1000, true),
      click(350, true),
    ];
    const settings = new ClipSettings(recordClicks, [], 0.5, 145);

    expect(settings.startRecordingDelay).toBe(4000 / 0.5);
    expect(settings.stopRecordingDelay).toBe(100 + 6000 / 0.5 + 350);
  });

  test("with no recording clicks at all, delays fall back to the prelay/postlay only", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false),
      click(350, false), // end marker
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 0);

    expect(settings.startRecordingDelay).toBe(0);
    expect(settings.stopRecordingDelay).toBe(100 + 0 + 350);
  });

  test("stores latency, videoEnabled, and videoLatencyMs as given", () => {
    const settings = new ClipSettings([click(350, false)], [], 1, 145, true, 20);
    expect(settings.latency).toBe(145);
    expect(settings.videoEnabled).toBe(true);
    expect(settings.videoLatencyMs).toBe(20);
  });

  test("videoEnabled/videoLatencyMs default to false/0", () => {
    const settings = new ClipSettings([click(350, false)], [], 1, 0);
    expect(settings.videoEnabled).toBe(false);
    expect(settings.videoLatencyMs).toBe(0);
  });
});

describe("Clip", () => {
  function fakeAudioBuffer(): AudioBuffer {
    const channel = new Float32Array(100);
    return {
      sampleRate: 44100,
      length: 100,
      numberOfChannels: 1,
      duration: 100 / 44100,
      getChannelData: () => channel,
    } as unknown as AudioBuffer;
  }

  test("scheduledDurationMs is the gap between start and stop recording delays", () => {
    const settings = new ClipSettings(
      [click(1000, true), click(350, true)],
      [],
      1,
      0,
    );
    const clip = new Clip(settings, fakeAudioBuffer());
    expect(clip.scheduledDurationMs).toBe(settings.stopRecordingDelay - settings.startRecordingDelay);
  });

  test("carries playClicks, recordSpeed, latency, and videoLatencyMs from settings", () => {
    const playClicks = [click(500, true)];
    const settings = new ClipSettings([click(350, true)], playClicks, 0.75, 90, true, 15);
    const clip = new Clip(settings, fakeAudioBuffer());

    expect(clip.playClicks).toBe(playClicks);
    expect(clip.recordSpeed).toBe(0.75);
    expect(clip.latency).toBe(90);
    expect(clip.videoLatencyMs).toBe(15);
    expect(clip.videoBlob).toBeNull();
  });

  describe("download", () => {
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    let clickSpy: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      createObjectURL = vi.fn(() => "blob:mock-url");
      revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      clickSpy = vi.fn<() => void>();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
    });

    test("triggers a single .wav download when there's no video", () => {
      const settings = new ClipSettings([click(350, true)], [], 1, 0);
      const clip = new Clip(settings, fakeAudioBuffer());

      clip.download();

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const [blob] = createObjectURL.mock.calls[0];
      expect(blob.type).toBe("audio/wav");
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    test("also downloads the video blob, with its own file extension, when present", () => {
      const settings = new ClipSettings([click(350, true)], [], 1, 0);
      const clip = new Clip(settings, fakeAudioBuffer());
      clip.videoBlob = new Blob(["video-bytes"], { type: "video/webm" });
      clip.videoFileExtension = "webm";

      clip.download();

      expect(createObjectURL).toHaveBeenCalledTimes(2);
      expect(createObjectURL.mock.calls[1][0]).toBe(clip.videoBlob);
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });

    test("filenames follow the recording-<timestamp>.<ext> pattern", () => {
      const settings = new ClipSettings([click(350, true)], [], 1, 0);
      const clip = new Clip(settings, fakeAudioBuffer());

      const anchors: HTMLAnchorElement[] = [];
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") anchors.push(el as HTMLAnchorElement);
        return el;
      });

      clip.download();

      expect(anchors).toHaveLength(1);
      expect(anchors[0].download).toMatch(/^recording-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.wav$/);
    });
  });
});
