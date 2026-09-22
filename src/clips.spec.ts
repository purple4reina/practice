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
    // prelay + (last click's onset [6000] + its own delay [1000]) + postlay
    expect(settings.stopRecordingDelay).toBe(100 + 7000 + 350);
    expect(settings.stopDelay).toBe(settings.stopRecordingDelay + 100);
  });

  test("the gap after the *end* of the last recorded click's own interval is always exactly recordPostlay, regardless of record speed, how many beats preceded it, or that click's own delay", () => {
    // A click's `delay` is the wait until the *next* pulse. For every click
    // except the last recorded one, that time belongs to the following click.
    // But for the *last* recorded click, that same interval is still time the
    // recording is meant to cover (the rest of that beat/subdivision) - so
    // postlay must be measured from the end of that interval (onset + its own
    // delay), not from the onset alone. Otherwise a high subdivision count
    // with few recorded beats chops off part of the final beat itself, before
    // recordPostlay even starts.
    for (const speed of [1, 0.5, 0.2, 2]) {
      for (const recordedBeatCount of [1, 2, 8]) {
        for (const lastBeatDelay of [250, 1000, 4000]) {
          const recordClicks: Click[] = [
            ...Array.from({ length: recordedBeatCount - 1 }, () => click(1000, true)),
            click(lastBeatDelay, true),
            click(350, true), // synthetic end marker
          ];
          const lastClickOnsetMs = (recordedBeatCount - 1) * 1000; // onset of the last recorded click
          const lastClickEndMs = lastClickOnsetMs + lastBeatDelay; // onset + its own delay
          const settings = new ClipSettings(recordClicks, [], speed, 0);

          const lastClickEndInBuffer =
            (settings.recordingPrelay + lastClickEndMs / speed) - settings.startRecordingDelay;
          const bufferDurationMs = settings.stopRecordingDelay - settings.startRecordingDelay;

          expect(bufferDurationMs - lastClickEndInBuffer).toBeCloseTo(settings.recordPostlay, 6);
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
    expect(settings.stopRecordingDelay).toBe(100 + 7000 / 0.5 + 350);
  });

  test("with subdivisions, the postlay pad starts after the last subdivision click's own interval, not its onset (the user's exact repro: 4-beat count-in, 1 beat recorded, 4 subdivisions)", () => {
    const beatMs = 1000; // 60bpm
    const subdivisions = 4;
    const subMs = beatMs / subdivisions;
    const recordClicks: Click[] = [
      // 4 count-in beats x 4 subdivisions each, not recording
      ...Array.from({ length: 4 * subdivisions }, () => click(subMs, false)),
      // 1 recorded beat x 4 subdivisions
      ...Array.from({ length: subdivisions }, () => click(subMs, true)),
      click(350, true), // synthetic end marker
    ];
    const settings = new ClipSettings(recordClicks, [], 1, 0);

    // The last recorded (4th) subdivision click's own interval ends exactly
    // one full beat after the first recorded click - i.e. the recorded beat's
    // own nominal duration must be fully covered before recordPostlay even
    // starts, regardless of how many subdivisions it was split into.
    // scheduledDurationMs = recordingPrelay + (full beat) + recordPostlay.
    const scheduledDurationMs = settings.stopRecordingDelay - settings.startRecordingDelay;
    expect(scheduledDurationMs).toBeCloseTo(settings.recordingPrelay + beatMs + settings.recordPostlay, 6);
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
