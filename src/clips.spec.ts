import { expect, describe, test } from "vitest";
import { ClipSettings } from "./clips";
import { Click } from "./blocks/clicks";

// Minimal click-track builder. Each entry is [delayMs, recording]; a synthetic
// tail marker (delay 350, tail:true) is appended the way BlockManager does.
function clicks(entries: [number, boolean][]): Click[] {
  const out: Click[] = entries.map(([delay, recording]) => ({
    delay,
    level: 1,
    started: true,
    recording,
  }));
  const lastRecording = out.length ? out[out.length - 1].recording : false;
  out.push({ delay: 350, level: 1, started: true, recording: lastRecording, tail: true });
  return out;
}

function settings(recordClicks: Click[], recordSpeed: number): ClipSettings {
  return new ClipSettings(recordClicks, [], recordSpeed, 0);
}

describe("ClipSettings record window", () => {
  const PRELAY = new ClipSettings(clicks([[100, true]]), [], 1, 0).recordingPrelay;

  test("keeps a fixed tail equal to the lead-in, regardless of record speed", () => {
    // 6 recorded beats @ ~232bpm; last recorded click starts at 5 * 258.62ms.
    const beat = 60 / 232 * 1000;
    const track = clicks(Array.from({ length: 6 }, () => [beat, true] as [number, boolean]));
    const lastClickMs = 5 * beat;

    for (const recordSpeed of [1, 0.5, 0.2]) {
      const s = settings(track, recordSpeed);

      // Lead-in: metronome's first click sits `recordingPrelay` into the buffer.
      const firstClickInBuffer = PRELAY + 0 / recordSpeed - s.startRecordingDelay;
      // Tail: gap between the last recorded click and the recorder stopping.
      const lastClickInBuffer = PRELAY + lastClickMs / recordSpeed - s.startRecordingDelay;
      const tail = s.stopRecordingDelay - s.startRecordingDelay - lastClickInBuffer;

      expect(firstClickInBuffer).toBeCloseTo(PRELAY, 6);
      expect(tail).toBeCloseTo(PRELAY, 6);
    }
  });

  test("tail does not grow when the final beat is long or the record speed is slow", () => {
    const fast = settings(clicks([[250, true], [250, true]]), 1);
    const slowAndLong = settings(clicks([[2000, true], [2000, true]]), 0.2);

    const tailOf = (s: ClipSettings, lastClickMs: number, speed: number) =>
      s.stopRecordingDelay - (PRELAY + lastClickMs / speed);

    expect(tailOf(fast, 250, 1)).toBeCloseTo(PRELAY, 6);
    expect(tailOf(slowAndLong, 2000, 0.2)).toBeCloseTo(PRELAY, 6);
  });

  test("the synthetic tail marker never extends the recording", () => {
    const withMarker = settings(clicks([[500, true]]), 1);
    // Same track without the appended marker.
    const withoutMarker = new ClipSettings(
      [{ delay: 500, level: 1, started: true, recording: true }],
      [], 1, 0,
    );
    expect(withMarker.stopRecordingDelay).toBe(withoutMarker.stopRecordingDelay);
  });

  test("un-recorded cool-down clicks still play but are not recorded", () => {
    // 4 recorded beats, then 2 un-recorded cool-down beats @ 120bpm.
    const track = clicks([
      [500, true], [500, true], [500, true], [500, true],
      [500, false], [500, false],
    ]);
    const s = settings(track, 1);

    // Recorder stops a fixed tail after the last *recorded* click (starts at 1500).
    expect(s.stopRecordingDelay).toBeCloseTo(1500 + PRELAY * 2, 6);
    // ...but finalization waits for the cool-down clicks to finish.
    expect(s.stopDelay).toBeGreaterThan(s.stopRecordingDelay);
    expect(s.stopDelay).toBeCloseTo(2500 + PRELAY * 2, 6);
  });
});
