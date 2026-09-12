import { expect, describe, test, beforeEach } from "vitest";
import PlayerDevice from "./player";
import { FakeAudioContext, FakeAudioBuffer } from "./test-support/fake-audio";

let ctx: FakeAudioContext;
let player: PlayerDevice;

beforeEach(() => {
  ctx = new FakeAudioContext();
  player = new PlayerDevice(ctx as unknown as AudioContext);
});

describe("PlayerDevice.play", () => {
  test("creates a buffer source wired to the given buffer/playbackRate, connected to a gain to destination", () => {
    const buffer = new FakeAudioBuffer(2, 100, 44100) as unknown as AudioBuffer;
    player.play(buffer, 1.5);

    const source = ctx.createBufferSource.mock.results[0].value as any;
    expect(source.buffer).toBe(buffer);
    expect(source.playbackRate.value).toBe(1.5);

    const gain = ctx.createGain.mock.results[0].value as any;
    expect(gain.connections).toContain(ctx.destination);
    expect(source.connections).toContain(gain);
  });

  test("starts at the context's current time, honoring a given offset", () => {
    ctx.currentTime = 2.5;
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    const startTime = player.play(buffer, 1.0, undefined, 0.3);

    expect(startTime).toBe(2.5);
    const source = ctx.createBufferSource.mock.results[0].value as any;
    expect(source.started).toEqual([{ when: 2.5, offset: 0.3 }]);
  });

  test("clamps a negative offset to 0", () => {
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    player.play(buffer, 1.0, undefined, -5);
    const source = ctx.createBufferSource.mock.results[0].value as any;
    expect(source.started[0].offset).toBe(0);
  });

  test("invokes onEnded when the source's onended fires", () => {
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    let ended = false;
    player.play(buffer, 1.0, () => { ended = true; });

    const source = ctx.createBufferSource.mock.results[0].value as any;
    source.onended();

    expect(ended).toBe(true);
  });

  test("starting a new playback stops and disconnects the previous source", () => {
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    player.play(buffer, 1.0);
    const first = ctx.createBufferSource.mock.results[0].value as any;

    player.play(buffer, 1.0);

    expect(first.stop).toHaveBeenCalled();
    expect(first.disconnect).toHaveBeenCalled();
  });
});

describe("PlayerDevice.stop", () => {
  test("stops and disconnects the current source", () => {
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    player.play(buffer, 1.0);
    const source = ctx.createBufferSource.mock.results[0].value as any;

    player.stop();

    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
  });

  test("is a no-op when nothing is playing", () => {
    expect(() => player.stop()).not.toThrow();
  });

  test("calling stop twice in a row is safe", () => {
    const buffer = new FakeAudioBuffer(1, 100, 44100) as unknown as AudioBuffer;
    player.play(buffer, 1.0);
    player.stop();
    expect(() => player.stop()).not.toThrow();
  });
});
