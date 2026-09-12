import { expect, describe, test, beforeEach } from "vitest";
import { Synth, OVERTONES } from "./synth";
import { FakeAudioContext, FakeAudioNode } from "./test-support/fake-audio";

let ctx: FakeAudioContext;
let synth: Synth;

beforeEach(() => {
  ctx = new FakeAudioContext();
  synth = new Synth(ctx as unknown as AudioContext);
});

describe("Synth.startOvertones", () => {
  test("creates one oscillator per overtone, tuned to frequency*ratio", () => {
    const output = new FakeAudioNode();
    const oscillators = synth.startOvertones(220, output as any);

    expect(oscillators).toHaveLength(OVERTONES.length);
    oscillators.forEach((osc: any, i) => {
      expect(osc.type).toBe("sine");
      expect(osc.frequency.value).toBeCloseTo(220 * OVERTONES[i].ratio, 6);
      expect(osc.started).toEqual([0]); // start() called with no args
    });
  });

  test("connects each oscillator's gain (scaled by overtone volume) to the given output", () => {
    const output = new FakeAudioNode();
    synth.startOvertones(220, output as any);

    // one gain node created per overtone, each connected to `output`
    expect(ctx.createGain).toHaveBeenCalledTimes(OVERTONES.length);
    const gains = ctx.createGain.mock.results.map(r => r.value);
    gains.forEach((gain: any, i: number) => {
      expect(gain.gain.value).toBeCloseTo(OVERTONES[i].volume, 6);
      expect(gain.connections).toContain(output);
    });
  });
});

describe("Synth.scheduleNote", () => {
  test("returns a master gain and one oscillator per overtone", () => {
    const { masterGain, oscillators } = synth.scheduleNote(1.0, 440, 0.5);
    expect(oscillators).toHaveLength(OVERTONES.length);
    expect((masterGain as any).connections).toContain(ctx.destination);
  });

  test("shapes the master gain with an attack/sustain/release envelope", () => {
    const { masterGain } = synth.scheduleNote(1.0, 440, 0.5) as any;
    expect(masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0, 1.0);
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 1.0 + Math.min(0.001, 0.05));
    // ramps back down to 0 by when+duration
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.0 + 0.5);
  });

  test("enforces a minimum duration of 20ms", () => {
    const { masterGain } = synth.scheduleNote(2.0, 440, 0.001) as any;
    // release/attack math is based on the clamped 0.02s duration, not 0.001
    expect(masterGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.0 + 0.02);
  });

  test("oscillators start at `when` and stop shortly after the note ends", () => {
    const { oscillators } = synth.scheduleNote(3.0, 440, 1.0) as any;
    oscillators.forEach((osc: any) => {
      expect(osc.started).toEqual([3.0]);
      expect(osc.stopped).toEqual([3.0 + 1.0 + 0.01]);
    });
  });
});

describe("Synth.scheduleClick", () => {
  test("schedules an oscillator at the given frequency/type with a short percussive envelope", () => {
    synth.scheduleClick(5.0, 1000, 2, "square");

    const osc = ctx.createOscillator.mock.results[0].value as any;
    const gain = ctx.createGain.mock.results[0].value as any;

    expect(osc.type).toBe("square");
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(1000, 5.0);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 5.0);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(2, 5.001);
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 5.05);
    expect(osc.started).toEqual([5.0]);
    expect(osc.stopped).toEqual([5.05]);
    expect(gain.connections).toContain(ctx.destination);
  });

  test("defaults to a square oscillator when no type is given", () => {
    synth.scheduleClick(0, 500, 1);
    const osc = ctx.createOscillator.mock.results[0].value as any;
    expect(osc.type).toBe("square");
  });
});
