import { expect, describe, test, beforeEach } from "vitest";
import fractionControls from "./fraction-controls";
import QueryParams from "../query-params";

beforeEach(() => {
  document.body.innerHTML = `
    <button id="ctl-minus">-</button>
    <input id="ctl-numer">
    <input id="ctl-denom">
    <button id="ctl-plus">+</button>
  `;
  QueryParams.replace(new URLSearchParams());
});

describe("fractionControls", () => {
  test("starts at initNum/initDen", () => {
    const value = fractionControls("ctl", { initNum: 1, initDen: 4 });
    expect(value()).toBeCloseTo(0.25, 10);
  });

  test("+ shrinks the denominator toward 1, then grows the numerator", () => {
    const value = fractionControls("ctl", { initNum: 1, initDen: 2 });
    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBeCloseTo(1, 10); // 1/1

    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBeCloseTo(2, 10); // 2/1, since denominator is already 1
  });

  test("- grows the denominator until the numerator is 1, then shrinks the numerator", () => {
    const value = fractionControls("ctl", { initNum: 1, initDen: 4 });
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBeCloseTo(1 / 5, 10);
  });

  test("- on 2/1 drops the numerator back down instead of growing the denominator", () => {
    const value = fractionControls("ctl", { initNum: 2, initDen: 1 });
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBeCloseTo(1, 10);
  });

  test("typing valid numerator/denominator values updates the fraction", () => {
    const value = fractionControls("ctl", { initNum: 1, initDen: 4 });
    const numer = document.getElementById("ctl-numer") as HTMLInputElement;
    const denom = document.getElementById("ctl-denom") as HTMLInputElement;

    numer.value = "3";
    numer.dispatchEvent(new Event("change"));
    denom.value = "8";
    denom.dispatchEvent(new Event("change"));

    expect(value()).toBeCloseTo(3 / 8, 10);
  });

  test("invalid (zero/negative/non-numeric) typed values are ignored", () => {
    const value = fractionControls("ctl", { initNum: 1, initDen: 4 });
    const numer = document.getElementById("ctl-numer") as HTMLInputElement;

    numer.value = "-5";
    numer.dispatchEvent(new Event("change"));
    expect(value()).toBeCloseTo(0.25, 10);

    numer.value = "abc";
    numer.dispatchEvent(new Event("change"));
    expect(value()).toBeCloseTo(0.25, 10);
  });

  test("query params (numer/denom) override the initial options", () => {
    QueryParams.set("ctl-numer", "3");
    QueryParams.set("ctl-denom", "16");
    const value = fractionControls("ctl", { initNum: 1, initDen: 4 });
    expect(value()).toBeCloseTo(3 / 16, 10);
  });

  test("changes are persisted back to the query params", () => {
    fractionControls("ctl", { initNum: 1, initDen: 4 });
    expect(QueryParams.get("ctl-numer")).toBe("1");
    expect(QueryParams.get("ctl-denom")).toBe("4");
  });

  describe("arrowKeys option", () => {
    test("ArrowRight/ArrowLeft adjust the value when focus isn't in a text input", () => {
      const value = fractionControls("ctl", { initNum: 1, initDen: 2, arrowKeys: true });
      document.body.tabIndex = -1;
      document.body.focus();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(value()).toBeCloseTo(1, 10);

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      expect(value()).toBeCloseTo(0.5, 10);
    });

    test("without arrowKeys, arrow key presses are ignored", () => {
      const value = fractionControls("ctl", { initNum: 1, initDen: 2 });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(value()).toBeCloseTo(0.5, 10);
    });
  });
});
