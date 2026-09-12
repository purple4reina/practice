import { expect, describe, test, beforeEach } from "vitest";
import plusMinusControls from "./plus-minus-controls";

beforeEach(() => {
  document.body.innerHTML = `
    <button id="ctl-minus">-</button>
    <input id="ctl-val">
    <button id="ctl-plus">+</button>
  `;
});

describe("plusMinusControls", () => {
  test("starts at the initial value", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 10 });
    expect(value()).toBe(5);
    expect((document.getElementById("ctl-val") as HTMLInputElement).value).toBe("5");
  });

  test("the +/- buttons increment and decrement", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 10 });
    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(6);
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(4);
  });

  test("clamps to the given min/max range", () => {
    const value = plusMinusControls("ctl", { initial: 10, min: 0, max: 10 });
    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(10);

    const valueAtMin = plusMinusControls("ctl", { initial: 0, min: 0, max: 10 });
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(valueAtMin()).toBe(0);
  });

  test("ArrowUp/ArrowDown on the input also adjust the value", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 10 });
    const input = document.getElementById("ctl-val") as HTMLInputElement;

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(value()).toBe(6);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(value()).toBe(4);
  });

  test("typing a valid integer and firing change updates the value", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 20 });
    const input = document.getElementById("ctl-val") as HTMLInputElement;

    input.value = "17";
    input.dispatchEvent(new Event("change"));
    expect(value()).toBe(17);
  });

  test("an invalid (non-numeric) input is ignored, keeping the last valid value", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 20 });
    const input = document.getElementById("ctl-val") as HTMLInputElement;

    input.value = "not-a-number";
    input.dispatchEvent(new Event("change"));
    expect(value()).toBe(5);
  });

  test("a typed value outside the range is clamped", () => {
    const value = plusMinusControls("ctl", { initial: 5, min: 0, max: 20 });
    const input = document.getElementById("ctl-val") as HTMLInputElement;

    input.value = "999";
    input.dispatchEvent(new Event("change"));
    expect(value()).toBe(20);
  });

  test("works even when the DOM elements don't exist (no-op controls)", () => {
    document.body.innerHTML = "";
    expect(() => plusMinusControls("missing", { initial: 3, min: 0, max: 10 })).not.toThrow();
  });
});
