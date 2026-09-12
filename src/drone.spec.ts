import { expect, describe, test, beforeEach } from "vitest";
import Drone from "./drone";
import { Synth, OVERTONES } from "./synth";
import { FakeAudioContext } from "./test-support/fake-audio";

let ctx: FakeAudioContext;

beforeEach(() => {
  document.body.innerHTML = `
    <button id="drone" class="btn btn-outline-secondary" type="button"></button>
    <select id="drone-pitch">
      <option value="C">C</option>
      <option value="A" selected>A</option>
    </select>
    <select id="drone-octave" class="border-secondary">
      <option value="3" selected>3</option>
      <option value="4">4</option>
    </select>
  `;
  ctx = new FakeAudioContext();
});

function droneButton(): HTMLElement {
  return document.getElementById("drone") as HTMLElement;
}

describe("Drone", () => {
  test("connects its master gain to the destination at the given volume", () => {
    new Drone(ctx as unknown as AudioContext, 0.4);
    const gain = ctx.createGain.mock.results[0].value as any;
    expect(gain.gain.value).toBe(0.4);
    expect(gain.connections).toContain(ctx.destination);
  });

  test("clicking the drone button starts overtone oscillators at the selected pitch/octave (A3 = 220Hz)", () => {
    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click"));

    expect(ctx.createOscillator).toHaveBeenCalledTimes(OVERTONES.length);
    const firstOsc = ctx.createOscillator.mock.results[0].value as any;
    expect(firstOsc.frequency.value).toBeCloseTo(220, 1);
    expect(droneButton().classList.contains("btn-primary")).toBe(true);
  });

  test("clicking again stops the oscillators and reverts styling", () => {
    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click")); // start
    const oscillators = ctx.createOscillator.mock.results.map(r => r.value as any);

    droneButton().dispatchEvent(new MouseEvent("click")); // stop

    oscillators.forEach(osc => expect(osc.stop).toHaveBeenCalled());
    expect(droneButton().classList.contains("btn-outline-secondary")).toBe(true);
    expect(droneButton().classList.contains("btn-primary")).toBe(false);
  });

  test("changing pitch while playing restarts the drone at the new frequency", () => {
    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click")); // start at A3 (220Hz)
    ctx.createOscillator.mockClear();

    const pitchSelect = document.getElementById("drone-pitch") as HTMLSelectElement;
    pitchSelect.value = "C";
    pitchSelect.dispatchEvent(new Event("change"));

    expect(ctx.createOscillator).toHaveBeenCalledTimes(OVERTONES.length);
    const osc = ctx.createOscillator.mock.results[0].value as any;
    expect(osc.frequency.value).toBeCloseTo(130.81, 1); // C3
  });

  test("changing pitch while stopped does not start the drone", () => {
    new Drone(ctx as unknown as AudioContext);
    const pitchSelect = document.getElementById("drone-pitch") as HTMLSelectElement;
    pitchSelect.value = "C";
    pitchSelect.dispatchEvent(new Event("change"));

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  test("changing to the same pitch is a no-op", () => {
    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click"));
    ctx.createOscillator.mockClear();

    const pitchSelect = document.getElementById("drone-pitch") as HTMLSelectElement;
    pitchSelect.value = "A"; // unchanged
    pitchSelect.dispatchEvent(new Event("change"));

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  test("changing octave while playing restarts the drone an octave up/down", () => {
    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click")); // A3 = 220Hz
    ctx.createOscillator.mockClear();

    const octaveSelect = document.getElementById("drone-octave") as HTMLSelectElement;
    octaveSelect.value = "4";
    octaveSelect.dispatchEvent(new Event("change"));

    const osc = ctx.createOscillator.mock.results[0].value as any;
    expect(osc.frequency.value).toBeCloseTo(440, 1); // A4
  });

  test("falls back to A4 (440Hz) for an unrecognized note/octave combination", () => {
    document.body.innerHTML += '<option value="Zz" id="bogus-pitch"></option>';
    const pitchSelect = document.getElementById("drone-pitch") as HTMLSelectElement;
    const bogus = document.createElement("option");
    bogus.value = "Zz";
    pitchSelect.appendChild(bogus);
    pitchSelect.value = "Zz";

    new Drone(ctx as unknown as AudioContext);
    droneButton().dispatchEvent(new MouseEvent("click"));

    const osc = ctx.createOscillator.mock.results[0].value as any;
    expect(osc.frequency.value).toBeCloseTo(440, 1);
  });
});
