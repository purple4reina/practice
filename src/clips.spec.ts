import { expect, describe, test } from "vitest";
import { ClipSettings, Clip } from "./clips";
import { Click } from "./blocks/clicks";

function click(delay: number, recording: boolean): Click {
  return { delay, level: 1, started: true, recording };
}

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

describe("Clip.latency", () => {
  // clip.latency is passed straight through from the user's hardware-latency-
  // compensation setting. It must NOT be combined with recordingPrelay or any
  // other click-track constant here - users calibrate this single value
  // empirically (by ear/eye) against their own hardware, and folding in an
  // extra fixed offset would silently invalidate every already-correct,
  // previously-tuned setting instead of just working with it as given.
  test("passes the hardware-latency-compensation value through unchanged", () => {
    const settings = new ClipSettings([click(1000, true), click(350, true)], [], 1, 165);
    const clip = new Clip(settings, fakeAudioBuffer());

    expect(clip.latency).toBe(165);
  });

  test("is unaffected by recordSpeed or recordingPrelay", () => {
    for (const recordSpeed of [1, 0.55, 0.2, 2]) {
      const settings = new ClipSettings([click(1000, true), click(350, true)], [], recordSpeed, 165);
      const clip = new Clip(settings, fakeAudioBuffer());
      expect(clip.latency).toBe(165);
    }
  });
});

describe("ClipSettings prelay/postlay", () => {
  test("recordingPrelay and recordPostlay are independent (not required to be equal)", () => {
    const settings = new ClipSettings([click(350, false)], [], 1, 0);
    expect(settings.recordingPrelay).toBe(100);
    expect(settings.recordPostlay).toBe(350);
  });

  test("finds the first/last recording click and derives all delays from them", () => {
    const recordClicks: Click[] = [
      click(1000, false), click(1000, false), click(1000, false), click(1000, false), // 4 count-in
      click(1000, true), click(1000, true), click(1000, true), // 3 recorded beats
      click(350, true), // synthetic end marker (dropped from the delay calculation)
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 145);

    expect(settings.startRecordingDelay).toBe(4000); // ms elapsed before the first recording click
    expect(settings.stopRecordingDelay).toBe(100 + 6000 + 350); // prelay + last click's onset + postlay
    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + 100);
  });

  test("the gap after the last recorded click's onset is always exactly recordPostlay, regardless of record speed, how many beats preceded it, or that click's own (irrelevant) delay", () => {
    // A "click" is an instantaneous tick; its `delay` is the wait until the
    // *next* event, not part of the click itself - so postlay is measured
    // from the last recorded click's onset, independent of its own delay.
    for (const speed of [1, 0.5, 0.2, 2]) {
      for (const recordedBeatCount of [1, 2, 8]) {
        for (const lastBeatDelay of [250, 1000, 4000]) {
          const recordClicks: Click[] = [
            ...Array.from({ length: recordedBeatCount - 1 }, () => click(1000, true)),
            click(lastBeatDelay, true),
            click(350, true), // synthetic end marker
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

  test("recordSpeed scales the elapsed-time terms but not the fixed prelay/postlay pads", () => {
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
});

describe("ClipSettings / Clip basics", () => {
  test("scheduledDurationMs is the gap between start and stop recording delays", () => {
    const settings = new ClipSettings([click(1000, true), click(350, true)], [], 1, 0);
    const clip = new Clip(settings, fakeAudioBuffer());
    expect(clip.scheduledDurationMs).toBe(settings.stopRecordingDelay - settings.startRecordingDelay);
  });

  test("carries playClicks, recordSpeed, and videoLatencyMs from settings", () => {
    const playClicks = [click(500, true)];
    const settings = new ClipSettings([click(350, true)], playClicks, 0.75, 90, true, 15);
    const clip = new Clip(settings, fakeAudioBuffer());

    expect(clip.playClicks).toBe(playClicks);
    expect(clip.recordSpeed).toBe(0.75);
    expect(clip.videoLatencyMs).toBe(15);
    expect(clip.videoBlob).toBeNull();
  });
});
