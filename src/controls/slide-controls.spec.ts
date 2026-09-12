import { expect, describe, test, beforeEach } from "vitest";
import slideControls from "./slide-controls";
import QueryParams from "../query-params";

beforeEach(() => {
  document.body.innerHTML = `
    <div id="ctl-label">Speed</div>
    <button id="ctl-minus">-</button>
    <input type="range" id="ctl">
    <button id="ctl-plus">+</button>
  `;
  QueryParams.replace(new URLSearchParams());
});

describe("slideControls", () => {
  test("starts at the initial value and sets the label text", () => {
    const value = slideControls("ctl", { initial: 50, min: 0, max: 100, step: 1, label: "Speed", valueSuffix: "%" });
    expect(value()).toBe(50);
    expect((document.getElementById("ctl-label") as HTMLElement).innerText).toBe("Speed (50%):");
  });

  test("+/- adjust by the configured step", () => {
    const value = slideControls("ctl", { initial: 50, min: 0, max: 100, step: 5 });
    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(55);
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    document.getElementById("ctl-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(45);
  });

  test("clamps to [min, max]", () => {
    const value = slideControls("ctl", { initial: 100, min: 0, max: 100, step: 1 });
    document.getElementById("ctl-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(value()).toBe(100);
  });

  test("changing the slider input fires a change and updates the value", () => {
    const value = slideControls("ctl", { initial: 0, min: 0, max: 100, step: 1 });
    const input = document.getElementById("ctl") as HTMLInputElement;
    input.value = "77";
    input.dispatchEvent(new Event("change"));
    expect(value()).toBe(77);
  });

  test("an existing query param overrides the initial value", () => {
    QueryParams.set("ctl", "33");
    const value = slideControls("ctl", { initial: 50, min: 0, max: 100, step: 1 });
    expect(value()).toBe(33);
  });

  test("without a label option, falls back to the label element's existing text", () => {
    // jsdom doesn't compute innerText from parsed markup, so set it explicitly
    // the way a real rendered label's innerText would already read.
    (document.getElementById("ctl-label") as HTMLElement).innerText = "Speed";

    const value = slideControls("ctl", { initial: 10, min: 0, max: 100, step: 1, valueSuffix: "%" });
    const input = document.getElementById("ctl") as HTMLInputElement;
    input.dispatchEvent(new Event("input"));
    expect((document.getElementById("ctl-label") as HTMLElement).innerText).toBe("Speed (10%):");
  });
});
