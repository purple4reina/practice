import { expect, describe, test, beforeEach } from "vitest";
import PatternControls from "./pattern-controls";

beforeEach(() => {
  // A trailing sentinel child mirrors the real usage inside pattern-block.ts,
  // where pattern buttons are always inserted before the pre-existing "+"
  // controls (PatternButton inserts before the container's *last* child).
  document.body.innerHTML = '<div id="pat"><span id="sentinel"></span></div>';
});

function levelsInDom(name: string): string[] {
  return [...document.querySelectorAll(`#${name} .pattern-level`)].map(el => (el as HTMLElement).innerText);
}

describe("PatternControls", () => {
  test("renders one button per initial pattern value, in order, before the sentinel", () => {
    new PatternControls("pat", { initial: [1, 2, 3], start: 1 });
    expect(levelsInDom("pat")).toEqual(["1", "2", "3"]);
    const container = document.getElementById("pat")!;
    expect(container.lastElementChild!.id).toBe("sentinel");
  });

  test("values() reflects the initial pattern", () => {
    const controls = new PatternControls("pat", { initial: [1, 2, 2, 3], start: 1 });
    expect(controls.values()).toEqual([1, 2, 2, 3]);
  });

  test("clicking a level button cycles it through 0-3 and wraps", () => {
    const controls = new PatternControls("pat", { initial: [1], start: 1 });
    const level = document.getElementById("pat-0") as HTMLElement;

    for (const expected of [2, 3, 0, 1]) {
      level.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(controls.values()).toEqual([expected]);
    }
  });

  test("setBeatCount grows the pattern with default level-2 buttons", () => {
    const controls = new PatternControls("pat", { initial: [1, 2], start: 1 });
    controls.setBeatCount(4);
    expect(controls.values()).toEqual([1, 2, 2, 2]);
  });

  test("setBeatCount shrinks the pattern by removing from the end", () => {
    const controls = new PatternControls("pat", { initial: [1, 2, 3, 1], start: 1 });
    controls.setBeatCount(2);
    expect(controls.values()).toEqual([1, 2]);
    expect(levelsInDom("pat")).toEqual(["1", "2"]);
  });

  test("setStartBeat marks exactly one button as the start beat", () => {
    new PatternControls("pat", { initial: [1, 2, 3], start: 1 });
    const startDivs = () => [...document.querySelectorAll("#pat .start-beat")] as HTMLElement[];

    expect(startDivs().map(d => d.innerText)).toEqual(["start", "", ""]);

    // (re-fetch a fresh controls instance isn't needed; call on the same one)
  });

  test("setStartBeat moves the marker when called again", () => {
    const controls = new PatternControls("pat", { initial: [1, 2, 3], start: 1 });
    controls.setStartBeat(3);
    const startDivs = [...document.querySelectorAll("#pat .start-beat")] as HTMLElement[];
    expect(startDivs.map(d => d.innerText)).toEqual(["", "", "start"]);
  });
});
