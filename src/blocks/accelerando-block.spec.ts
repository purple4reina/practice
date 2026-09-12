import { expect, describe, test, beforeEach } from "vitest";
import AccelerandoBlock from "./accelerando-block";
import { ClickState } from "./clicks";
import { accelFunctions } from "./accel-functions";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("AccelerandoBlock", () => {
  test("renders an option for every accel function, defaulting to linear", () => {
    const block = new AccelerandoBlock(parent, { index: 0 });
    const select = document.getElementById(`${block.id}-accel-kind`) as HTMLSelectElement;

    expect([...select.options].map(o => o.value)).toEqual(Object.keys(accelFunctions));
    expect(select.value).toBe("linear");
  });

  test("honors an initial kind option when it's a real accel function", () => {
    const block = new AccelerandoBlock(parent, { index: 0, kind: "cosine" });
    expect(block.queryString()).toBe("kind:cosine");
  });

  test("falls back to linear for an unrecognized kind option", () => {
    const block = new AccelerandoBlock(parent, { index: 0, kind: "not-a-real-kind" });
    expect(block.queryString()).toBe("kind:linear");
  });

  test("clickIntervalGen starts the accelerando on the click state with the selected kind", () => {
    const block = new AccelerandoBlock(parent, { index: 0, kind: "quadratic" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    expect(state.accel.enabled).toBe(true);
    expect(state.accel.kind).toBe("quadratic");
  });

  test("selecting a different kind in the UI is reflected in queryString", () => {
    const block = new AccelerandoBlock(parent, { index: 0 });
    const select = document.getElementById(`${block.id}-accel-kind`) as HTMLSelectElement;
    select.value = "circular";

    expect(block.queryString()).toBe("kind:circular");
  });
});
