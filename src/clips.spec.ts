import { expect, describe, test, beforeEach, vi } from "vitest";
import { ClipSettings, Clip } from "./clips";
import { Click } from "./blocks/clicks";

function click(delay: number, recording: boolean): Click {
  return { delay, level: 1, started: true, recording };
}

function tailClick(recording: boolean): Click {
  return { delay: 350, level: 1, started: true, recording, tail: true };
}

describe("ClipSettings delay calculations", () => {
  test("finds the first/last recording click and derives all delays from them", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false), // 4 count-in
      click(1000, true), click(1000, true), click(1000, true), // 3 recorded beats
      tailClick(true), // synthetic end marker (dropped from the delay calculation)
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 145);

    expect(settings.startRecordingDelay).toBe(4000); // ms elapsed before the first recording click
    expect(settings.stopRecordingDelay).toBe(350 + 6000 + 350); // prelay + last click's elapsed + postlay
    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + 350);
  });

  test("recordSpeed scales both start and stop delays", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false),
      click(1000, true), click(1000, true), click(1000, true),
      tailClick(true),
    ];
    const settings = new ClipSettings(recordClicks, [], 0.5, 145);

    expect(settings.startRecordingDelay).toBe(4000 / 0.5);
    expect(settings.stopRecordingDelay).toBe(350 + 6000 / 0.5 + 350);
  });

  test("with no recording clicks at all, delays fall back to the prelay/postlay only", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false),
      tailClick(false), // end marker
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 0);

    expect(settings.startRecordingDelay).toBe(0);
    expect(settings.stopRecordingDelay).toBe(350 + 0 + 350);
  });

  test("recordingPrelay and recordPostlay are equal, so a take opens and closes with the same amount of silence", () => {
    const settings = new ClipSettings([tailClick(false)], [], 1, 0);
    expect(settings.recordingPrelay).toBe(settings.recordPostlay);
  });

  test("blocks placed after the last recording click (e.g. between 'stop' and 'done') still get their full duration before stopDelay - they keep clicking audibly even though they aren't recorded", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false),
      click(1000, true), click(1000, true), click(1000, true),
      click(1000, false), click(1000, false), // two trailing, non-recorded clicks
      tailClick(false), // synthetic end marker
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 145);

    // Without the trailing clicks, stopDelay would just be stopRecordingDelay + recordingPrelay.
    // The two 1000ms trailing clicks must be given their own full duration too.
    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + settings.recordingPrelay + 2000);
  });

  test("trailing clicks are also scaled by recordSpeed", () => {
    const recordClicks: Click[] = [
      click(1000, true),
      click(1000, false), // one trailing click
      tailClick(false),
    ];
    const settings = new ClipSettings(recordClicks, [], 0.5, 0);

    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + settings.recordingPrelay + 1000 / 0.5);
  });

  describe("prelay/postlay invariants", () => {
    // Buffer-relative position of the first recorded click: real time of that
    // click (recordingPrelay + firstClickMs/speed) minus buffer t=0
    // (startRecordingDelay = firstClickMs/speed).
    function bufferRelativeFirstClickMs(s: ClipSettings, firstClickMs: number, speed: number): number {
      return (s.recordingPrelay + firstClickMs / speed) - s.startRecordingDelay;
    }

    test("the gap before the first recorded click is always exactly recordingPrelay, regardless of record speed or how much count-in precedes it", () => {
      for (const speed of [1, 0.5, 0.2, 2]) {
        for (const countIn of [0, 1, 10]) {
          const recordClicks: Click[] = [
            ...Array.from({ length: countIn }, () => click(1000, false)),
            click(1000, true), click(1000, true),
            tailClick(true),
          ];
          const settings = new ClipSettings(recordClicks, [], speed, 0);
          const firstClickMs = countIn * 1000;

          expect(bufferRelativeFirstClickMs(settings, firstClickMs, speed))
            .toBeCloseTo(settings.recordingPrelay, 6);
        }
      }
    });

    test("the gap after the last recorded click's own onset is always exactly recordPostlay, regardless of record speed, how many beats preceded it, or that click's own (irrelevant) delay", () => {
      // A "click" is an instantaneous tick; its `delay` is the wait until the
      // *next* event, not part of the click itself - so postlay is measured
      // from the last recorded click's onset, independent of its own delay.
      for (const speed of [1, 0.5, 0.2, 2]) {
        for (const recordedBeatCount of [1, 2, 8]) {
          for (const lastBeatDelay of [250, 1000, 4000]) {
            const recordClicks: Click[] = [
              ...Array.from({ length: recordedBeatCount - 1 }, () => click(1000, true)),
              click(lastBeatDelay, true),
              tailClick(true),
            ];
            const lastClickMs = (recordedBeatCount - 1) * 1000; // onset of the last recorded click
            const settings = new ClipSettings(recordClicks, [], speed, 0);

            const lastClickOnsetInBuffer =
              (settings.recordingPrelay + lastClickMs / speed) - settings.startRecordingDelay;
            const bufferDurationMs = settings.stopRecordingDelay - settings.startRecordingDelay;

            expect(bufferDurationMs - lastClickOnsetInBuffer).toBeCloseTo(settings.recordPostlay, 6);
          }
        }
      }
    });

    test("trailing (post-stop) blocks affect only stopDelay, never startRecordingDelay/stopRecordingDelay/the audio capture window", () => {
      const base: Click[] = [
        click(1000, false), click(1000, true), click(1000, true),
      ];
      const withoutTrailing = new ClipSettings([...base, tailClick(false)], [], 1, 0);
      const withTrailing = new ClipSettings(
        [...base, click(1000, false), click(2000, false), tailClick(false)],
        [], 1, 0,
      );

      expect(withTrailing.startRecordingDelay).toBe(withoutTrailing.startRecordingDelay);
      expect(withTrailing.stopRecordingDelay).toBe(withoutTrailing.stopRecordingDelay);
      // Only stopDelay (metronome teardown) should grow, to give the trailing
      // blocks time to actually finish clicking.
      expect(withTrailing.stopDelay).toBeGreaterThan(withoutTrailing.stopDelay);
    });

    test("the tail marker is excluded from the prelay/postlay calculation even if it's (incorrectly) marked recording: true", () => {
      const withCorrectFlag = new ClipSettings(
        [click(1000, true), { delay: 9999, level: 1, started: true, recording: true, tail: true }],
        [], 1, 0,
      );
      // Same track, but the marker also carries recording: true - the `tail`
      // flag alone must be what excludes it, not its recording value.
      expect(withCorrectFlag.stopRecordingDelay).toBe(
        withCorrectFlag.recordingPrelay + 0 / 1 + withCorrectFlag.recordPostlay,
      );
    });

    test("multiple record/stop segments: the first streak sets the prelay boundary, the last sets the postlay boundary", () => {
      const recordClicks: Click[] = [
        click(500, false),               // count-in
        click(500, true), click(500, true),   // first recorded segment (punch-in #1)
        click(500, false), click(500, false),  // punched out in between
        click(500, true), click(500, true),   // second recorded segment (punch-in #2)
        click(500, false),               // trailing cool-down
        tailClick(false),
      ];
      const settings = new ClipSettings(recordClicks, [], 1, 0);

      // firstClickMs = elapsed before the *first* recording:true click (index 1) = 500
      expect(settings.startRecordingDelay).toBe(500);
      // lastClickMs = elapsed before the *last* recording:true click (index 6) = 500*6 = 3000
      // recordingEndMs = elapsed right after it = 3500
      expect(settings.stopRecordingDelay).toBe(settings.recordingPrelay + 3000 + settings.recordPostlay);
      // trailingClicksMs = elapsed(4000) - recordingEndMs(3500) = 500
      expect(settings.stopDelay).toBe(settings.stopRecordingDelay + settings.recordingPrelay + 500);
    });
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

