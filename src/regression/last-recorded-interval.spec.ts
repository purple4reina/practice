// Permanent regression coverage for the bug class fixed in 9767acc: the
// recorder stopping before the *last recorded beat had finished playing*.
//
// ClipSettings measures its 350ms recordPostlay pad from the end of the last
// recorded click's own interval (onset + that click's own delay), not from
// the onset instant. A click's `delay` is the gap until the next pulse, and
// RecordingMetronome.scheduler() advances real time by exactly
// `delay / recordSpeed` per click - so "onset + own delay" is precisely the
// moment the recorded beat/subdivision's nominal duration has elapsed.
// Measuring from the onset alone truncated the final beat to whatever
// recordPostlay happened to be.
//
// The tests below are written so that each one FAILS under the old
// onset-only formula: every expected value here includes the last recorded
// click's own interval, and each `notToBe`-style guard pins the specific
// wrong value the old formula produced.
import { expect, describe, test } from "vitest";
import {
  buildScenario,
  START,
  RECORD,
  STOP,
  DONE,
  metronomeParam,
  subdivisionParam,
  beatsParam,
  pauseParam,
  accelerandoParam,
} from "../test-support/scenario";

const PRELAY_MS = 100;
const POSTLAY_MS = 350;

// Real-time offsets (ms from the record button press) of every recorded
// click, plus the moment the last recorded click's own interval ends -
// derived straight from the click list and the metronome's own accumulation
// rule, independently of ClipSettings.
function recordedTimeline(recordClicks: { delay: number; recording: boolean }[], recordSpeed: number) {
  const clicks = recordClicks.slice(0, -1); // drop BlockManager's synthetic end marker
  let t = PRELAY_MS;
  const onsets: number[] = [];
  let lastEnd: number | null = null;
  for (const click of clicks) {
    const scaled = click.delay / recordSpeed;
    if (click.recording) {
      onsets.push(t);
      lastEnd = t + scaled;
    }
    t += scaled;
  }
  return { onsets, lastEnd };
}

describe("the recorder never stops before the last recorded beat's own duration has elapsed", () => {
  // The headline invariant, and the one the old formula broke: n recorded
  // beats occupy exactly n whole beats of buffer, no matter how many
  // subdivision clicks those beats were chopped into. The old formula lost
  // one subdivision (beatMs / subdivisions) off the tail every time - which
  // is a whole beat at subdivisions=1, so this was never a subdivision-only
  // bug.
  for (const subdivisions of [1, 2, 3, 4, 8, 16]) {
    for (const bpm of [40, 60, 120]) {
      for (const recordSpeed of [1, 0.5, 0.35, 2]) {
        for (const [countIn, recorded] of [[0, 1], [4, 1], [3, 5]]) {
          test(`${recorded} recorded beat(s) occupy ${recorded} whole beat(s) of buffer (subdivisions=${subdivisions}, bpm=${bpm}, speed=${recordSpeed}, count-in=${countIn})`, () => {
            const { settings } = buildScenario(
              [
                START,
                metronomeParam(bpm),
                subdivisionParam(subdivisions, subdivisions),
                beatsParam(countIn),
                RECORD,
                beatsParam(recorded),
                STOP,
                DONE,
              ],
              recordSpeed,
              0,
            );

            const beatMs = (60 / bpm) * 1000 / recordSpeed;
            const bufferMs = settings.stopRecordingDelay - settings.startRecordingDelay;

            expect(bufferMs).toBeCloseTo(PRELAY_MS + recorded * beatMs + POSTLAY_MS, 6);
            // The old onset-only formula landed exactly one subdivision short.
            expect(bufferMs).not.toBeCloseTo(
              PRELAY_MS + recorded * beatMs - beatMs / subdivisions + POSTLAY_MS,
              6,
            );
          });
        }
      }
    }
  }

  test("subdivisions=1 is not a special case: the final quarter note still gets its full beat, not just the 350ms pad", () => {
    // 4 beats at 60bpm, no subdivisions at all. Before 9767acc this stopped
    // 350ms after the 4th click's onset, capturing 350ms of a 1000ms note.
    const { recordClicks, settings } = buildScenario(
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), STOP, DONE],
      1,
      0,
    );
    const { onsets } = recordedTimeline(recordClicks, 1);
    const lastOnset = onsets[onsets.length - 1];

    expect(settings.stopRecordingDelay - lastOnset).toBeCloseTo(1000 + POSTLAY_MS, 6);
    expect(settings.stopRecordingDelay - lastOnset).not.toBeCloseTo(POSTLAY_MS, 6);
  });
});

describe("a pause block as the last recorded content", () => {
  // A pause between "record" and "stop" emits a real click carrying
  // recording:true whose delay is the whole pause (pause-block.ts). The
  // metronome genuinely waits it out, so it is recording time the user asked
  // for - the old formula discarded it wholesale.
  for (const pauseMs of [0, 250, 2000, 60000]) {
    test(`a ${pauseMs}ms pause before "stop" is recorded, not discarded`, () => {
      const { settings } = buildScenario(
        [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), pauseParam(pauseMs), STOP, DONE],
        1,
        0,
      );
      const bufferMs = settings.stopRecordingDelay - settings.startRecordingDelay;
      expect(bufferMs).toBeCloseTo(PRELAY_MS + 4000 + pauseMs + POSTLAY_MS, 6);
    });
  }

  test("a pause placed after \"stop\" is still excluded - it is not recorded content", () => {
    const withTrailingPause = buildScenario(
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), STOP, pauseParam(9000), DONE],
      1,
      0,
    );
    const withoutTrailingPause = buildScenario(
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), STOP, DONE],
      1,
      0,
    );

    expect(withTrailingPause.settings.stopRecordingDelay).toBeCloseTo(PRELAY_MS + 4000 + POSTLAY_MS, 6);
    expect(withTrailingPause.settings.stopRecordingDelay).toBeCloseTo(
      withoutTrailingPause.settings.stopRecordingDelay,
      6,
    );
  });

  test("a pause is scaled by recordSpeed like every other delay, matching the metronome's own clock", () => {
    const recordSpeed = 0.5;
    const { recordClicks, settings } = buildScenario(
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(2), pauseParam(3000), STOP, DONE],
      recordSpeed,
      0,
    );
    const { lastEnd } = recordedTimeline(recordClicks, recordSpeed);
    expect(settings.stopRecordingDelay).toBeCloseTo((lastEnd as number) + POSTLAY_MS, 6);
    expect(settings.stopRecordingDelay).toBeCloseTo(PRELAY_MS + (2000 + 3000) / recordSpeed + POSTLAY_MS, 6);
  });
});

describe("an accelerando or ritardando as the last recorded content", () => {
  // Accel clicks get non-uniform delays rewritten along the timing curve
  // (metronome-block.ts). A ritardando is the worst case for the old bug:
  // its *final* beat is its *longest*, so onset-only measurement chopped off
  // the most exactly where the user is most likely to be holding a note.
  for (const kind of ["linear", "quadratic", "squareRoot", "cosine", "circular"]) {
    test(`ritardando (${kind}): the final, longest beat is fully covered before the postlay starts`, () => {
      const recordSpeed = 1;
      const { recordClicks, settings } = buildScenario(
        [
          START,
          metronomeParam(120),
          subdivisionParam(1, 1),
          RECORD,
          accelerandoParam(kind),
          beatsParam(8),
          metronomeParam(40),
          STOP,
          DONE,
        ],
        recordSpeed,
        0,
      );
      const { onsets, lastEnd } = recordedTimeline(recordClicks, recordSpeed);
      const lastOnset = onsets[onsets.length - 1];
      const finalBeatMs = (lastEnd as number) - lastOnset;

      // Sanity: this really is a ritardando, and its last beat really is long.
      expect(onsets.length).toBe(8);
      expect(finalBeatMs).toBeGreaterThan(900);

      expect(settings.stopRecordingDelay).toBeCloseTo((lastEnd as number) + POSTLAY_MS, 6);
      // i.e. the whole final beat plus the pad, not just the pad.
      expect(settings.stopRecordingDelay - lastOnset).toBeCloseTo(finalBeatMs + POSTLAY_MS, 6);
      expect(settings.stopRecordingDelay - lastOnset).toBeGreaterThan(POSTLAY_MS + 900);
    });

    test(`accelerando (${kind}): the final, shortest beat is fully covered before the postlay starts`, () => {
      const recordSpeed = 1;
      const { recordClicks, settings } = buildScenario(
        [
          START,
          metronomeParam(60),
          subdivisionParam(2, 2),
          RECORD,
          accelerandoParam(kind),
          beatsParam(8),
          metronomeParam(180),
          STOP,
          DONE,
        ],
        recordSpeed,
        0,
      );
      const { onsets, lastEnd } = recordedTimeline(recordClicks, recordSpeed);
      const lastOnset = onsets[onsets.length - 1];

      expect(lastEnd).not.toBeNull();
      expect(settings.stopRecordingDelay).toBeCloseTo((lastEnd as number) + POSTLAY_MS, 6);
      expect((lastEnd as number) - lastOnset).toBeGreaterThan(0);
    });
  }
});

describe("BlockManager's synthetic end-marker click", () => {
  // Documents a real audible consequence of measuring the postlay from the end
  // of the last recorded click's interval: that end is exactly where the next
  // pulse falls, which for a recording running to the end of the block
  // sequence is BlockManager's synthetic end-marker click. The marker carries
  // level 1 (an audible 1000Hz tick, see Metronome.clickSounds), and
  // stopDelay - which is when stopRecording() tears the metronome down - now
  // always trails it, so it sounds and lands inside the captured buffer. Under
  // the onset-only formula the metronome was usually torn down first and the
  // marker was silently dropped. If this closing tick is ever deemed
  // unwanted, suppress it at the source (its level in
  // BlockManager.clickIntervalGen) rather than by shortening the recording
  // window again.
  for (const [subdivisions, beats] of [[1, 4], [4, 1], [2, 8], [3, 2]]) {
    test(`fires and is captured, ${subdivisions} subdivision(s) x ${beats} beat(s)`, () => {
      const { recordClicks, settings } = buildScenario(
        [START, metronomeParam(60), subdivisionParam(subdivisions, subdivisions), RECORD, beatsParam(beats), STOP, DONE],
        1,
        0,
      );
      const marker = recordClicks[recordClicks.length - 1];
      const markerOnset =
        PRELAY_MS + recordClicks.slice(0, -1).reduce((sum, c) => sum + c.delay, 0);

      expect(marker.level).toBeGreaterThan(0);
      // With nothing after "stop", the marker is the pulse closing the final
      // recorded beat, so it sits exactly one postlay from the buffer's end.
      expect(markerOnset).toBeCloseTo(settings.stopRecordingDelay - POSTLAY_MS, 6);
      expect(settings.stopDelay).toBeGreaterThan(markerOnset);
    });
  }
});

describe("stopRecordingDelay stays finite and sane across pathological click sequences", () => {
  // The fix folds the last recorded click's own delay into stopRecordingDelay
  // for the first time, so a NaN/negative/absurd delay reaching that click
  // would now corrupt the recording window rather than being harmlessly
  // ignored. Sweep the shapes that can produce unusual delays.
  const configs: [string, [string, string][]][] = [
    ["plain", [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(4), STOP, DONE]],
    ["max subdivisions", [START, metronomeParam(512), subdivisionParam(16, 16), RECORD, beatsParam(64), STOP, DONE]],
    ["slowest tempo, one beat", [START, metronomeParam(5), subdivisionParam(1, 1), RECORD, beatsParam(1), STOP, DONE]],
    ["max pause last", [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(1), pauseParam(60000), STOP, DONE]],
    ["zero recorded beats", [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, STOP, DONE]],
    ["zero-count beats block", [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(0), STOP, DONE]],
    [
      "paused and resumed",
      [START, metronomeParam(60), subdivisionParam(1, 1), RECORD, beatsParam(2), STOP, pauseParam(5000), RECORD, beatsParam(2), STOP, DONE],
    ],
    [
      "ritardando to the slowest tempo",
      [START, metronomeParam(512), subdivisionParam(1, 1), RECORD, accelerandoParam("linear"), beatsParam(16), metronomeParam(5), STOP, DONE],
    ],
    [
      "accelerando to the fastest tempo",
      [START, metronomeParam(5), subdivisionParam(4, 4), RECORD, accelerandoParam("circular"), beatsParam(16), metronomeParam(512), STOP, DONE],
    ],
  ];

  for (const [name, params] of configs) {
    for (const recordSpeed of [0.2, 1, 2]) {
      test(`${name} @ speed ${recordSpeed}`, () => {
        const { recordClicks, settings } = buildScenario(params, recordSpeed, 0);

        expect(Number.isFinite(settings.startRecordingDelay)).toBe(true);
        expect(Number.isFinite(settings.stopRecordingDelay)).toBe(true);
        expect(settings.startRecordingDelay).toBeGreaterThanOrEqual(0);

        // The recording window can never be shorter than the two fixed pads,
        // and stopDelay (metronome teardown) always trails the recorder stop.
        const bufferMs = settings.stopRecordingDelay - settings.startRecordingDelay;
        expect(bufferMs).toBeGreaterThanOrEqual(PRELAY_MS + POSTLAY_MS);
        expect(settings.stopDelay).toBeGreaterThan(settings.stopRecordingDelay);

        // And the recorder must outlast every recorded click's own interval.
        const { onsets, lastEnd } = recordedTimeline(recordClicks, recordSpeed);
        if (lastEnd !== null) {
          expect(settings.stopRecordingDelay).toBeCloseTo(lastEnd + POSTLAY_MS, 6);
          for (const onset of onsets) {
            expect(onset).toBeLessThan(settings.stopRecordingDelay);
          }
        }
      });
    }
  }
});
