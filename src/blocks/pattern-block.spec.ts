import { expect, describe, test, beforeEach } from "vitest";
import PatternBlock from "./pattern-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("PatternBlock defaults and opts", () => {
  test("defaults to 4 beats, start beat 1, pattern 1,2,2,2", () => {
    const block = new PatternBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ beats: 4, start: 1, pattern: "1,2,2,2" });
  });

  test("honors initial beats/start/pattern options", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 3, start: 2, pattern: "3,1,2" });
    expect(block.getOpts()).toEqual({ beats: 3, start: 2, pattern: "3,1,2" });
  });

  test("queryString reports beats, start, and pattern", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 3, start: 1, pattern: "1,2,3" });
    expect(block.queryString()).toBe("beats:3 start:1 pattern:1,2,3");
  });
});

describe("PatternBlock.clickIntervalGen", () => {
  test("applies beats, start, and pattern onto the click state", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 3, start: 2, pattern: "3,1,2" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    expect(state.beatsPerMeasure).toBe(3);
    expect(state.beatIndex).toBe(1); // start (2) - 1
    expect(state.beatPattern).toEqual([3, 1, 2]);
  });
});

describe("PatternBlock UI interactions", () => {
  test("clicking a pattern button cycles its level 0 -> 1 -> 2 -> 3 -> 0", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 1, start: 1, pattern: "0" });
    const level = document.getElementById(`${block.id}-pattern-0`) as HTMLElement;

    expect(block.getOpts().pattern).toBe("0");
    level.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(block.getOpts().pattern).toBe("1");
    level.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(block.getOpts().pattern).toBe("2");
    level.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(block.getOpts().pattern).toBe("3");
    level.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(block.getOpts().pattern).toBe("0");
  });

  test("increasing the beat count via the +button adds a new pattern button", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 2, start: 1, pattern: "1,2" });
    const plus = document.getElementById(`${block.id}-beats-plus`) as HTMLElement;

    plus.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(block.getOpts().beats).toBe(3);
    expect(block.getOpts().pattern.split(",")).toHaveLength(3);
  });

  test("decreasing the beat count via the -button removes the last pattern button", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 2, start: 1, pattern: "1,2" });
    const minus = document.getElementById(`${block.id}-beats-minus`) as HTMLElement;

    minus.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(block.getOpts().beats).toBe(1);
    expect(block.getOpts().pattern).toBe("1");
  });

  test("changing the start beat moves which button is marked as the start", () => {
    const block = new PatternBlock(parent, { index: 0, beats: 3, start: 1, pattern: "1,2,2" });
    const plus = document.getElementById(`${block.id}-start-plus`) as HTMLElement;

    plus.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(block.getOpts().start).toBe(2);
    // getElementById (not a CSS id-selector) since block.id is a random
    // base36 string that can start with a digit, which querySelector would
    // reject as an unescaped identifier.
    const patternDiv = document.getElementById(`${block.id}-pattern`) as HTMLElement;
    const startDivs = [...patternDiv.querySelectorAll(".start-beat")] as HTMLElement[];
    expect(startDivs[0].innerText).toBe("");
    expect(startDivs[1].innerText).toBe("start");
    expect(startDivs[2].innerText).toBe("");
  });
});
