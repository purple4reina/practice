import { expect, describe, test, beforeEach, vi } from "vitest";
import BlockManager from "./index";
import QueryParams from "../query-params";
import { resetDom } from "../test-support/dom";

beforeEach(() => {
  resetDom();
  QueryParams.replace(new URLSearchParams());
});

function blockTypesInDom(): string[] {
  return [...document.querySelectorAll("#blocks > .block-element")].map(
    el => [...el.classList].find(c => c.startsWith("block-") && c !== "block-element")!.replace("block-", ""),
  );
}

describe("BlockManager default construction (no ?record= in the URL)", () => {
  test("builds the default start/metronome/pattern/count-in/record/beats/stop/done chain", () => {
    new BlockManager();
    expect(blockTypesInDom()).toEqual([
      "start", "metronome", "pattern", "beats", "record", "beats", "stop", "done",
    ]);
  });

  test("produces the expected record and playback click sequences", () => {
    const manager = new BlockManager();

    // 4 count-in clicks (not recording) + 16 recorded clicks + a synthetic end marker
    const recordClicks = manager.recordClicks();
    expect(recordClicks).toHaveLength(21);
    expect(recordClicks.slice(0, 4).every(c => !c.recording)).toBe(true);
    expect(recordClicks.slice(4, 20).every(c => c.recording)).toBe(true);
    expect(recordClicks[20]).toMatchObject({ delay: 350, recording: true });

    // playback only includes what was actually recorded, plus the end marker
    const playClicks = manager.playClicks();
    expect(playClicks).toHaveLength(17);
    expect(playClicks.every(c => c.recording)).toBe(true);
  });

  test("tags the synthetic end marker with tail:true (and only the end marker) in both click lists", () => {
    const manager = new BlockManager();

    for (const clicks of [manager.recordClicks(), manager.playClicks()]) {
      expect(clicks.slice(0, -1).every(c => !c.tail)).toBe(true);
      expect(clicks.at(-1)).toMatchObject({ delay: 350, tail: true });
    }
  });
});

describe("BlockManager query-param driven construction (?record=...)", () => {
  test("builds a chain from the URL and auto-adds any missing start/record/stop/done markers", () => {
    const params = new URLSearchParams();
    params.set("metronome", encodeURIComponent("bpm:90"));
    params.set("beats", encodeURIComponent("count:8"));
    params.set("record", encodeURIComponent(""));
    QueryParams.replace(params);

    new BlockManager();

    expect(blockTypesInDom()).toEqual(["start", "metronome", "beats", "record", "stop", "done"]);
    const bpmInput = document.querySelector('input[id$="-bpm-val"]') as HTMLInputElement;
    const beatsInput = document.querySelector('input[id$="-beats-val"]') as HTMLInputElement;
    expect(bpmInput.value).toBe("90");
    expect(beatsInput.value).toBe("8");
  });

  test("ignores unknown query keys and ordering follows the URL", () => {
    const params = new URLSearchParams();
    params.set("unrelated-app-param", "should-be-ignored");
    params.set("record", encodeURIComponent(""));
    params.set("pause", encodeURIComponent("pause:250"));
    QueryParams.replace(params);

    new BlockManager();

    expect(blockTypesInDom()).toEqual(["start", "record", "pause", "stop", "done"]);
  });
});

describe("BlockManager.newBlock", () => {
  test("adds a block of the requested type to the DOM", () => {
    const manager = new BlockManager();
    manager.newBlock("pause", { pause: 10 });
    expect(document.querySelectorAll(".block-pause")).toHaveLength(1);
  });

  test("silently ignores an unrecognized block type", () => {
    const manager = new BlockManager();
    const before = document.querySelectorAll("#blocks > .block-element").length;
    manager.newBlock("not-a-real-type");
    expect(document.querySelectorAll("#blocks > .block-element")).toHaveLength(before);
  });

  test("without explicit opts, copies settings from the most recently added block of the same type", () => {
    const manager = new BlockManager();
    manager.newBlock("beats"); // should inherit count:16 from the existing beats(16) block
    const beatsInputs = [...document.querySelectorAll('input[id$="-beats-val"]')] as HTMLInputElement[];
    expect(beatsInputs[beatsInputs.length - 1].value).toBe("16");
  });

  test("the 'Add Block' dropdown wires up to newBlock via event delegation", () => {
    new BlockManager();
    const metronomeButton = document.querySelector(
      '#add-block button[value="metronome"]',
    ) as HTMLButtonElement;
    const before = document.querySelectorAll(".block-metronome").length;

    metronomeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelectorAll(".block-metronome")).toHaveLength(before + 1);
  });
});

describe("BlockManager move/remove wiring (via real chevron/trash clicks)", () => {
  test("moving a block above the trailing stop/done markers changes whether it contributes clicks, and removing it reverts that", async () => {
    vi.useFakeTimers();
    const manager = new BlockManager();
    const baseline = manager.recordClicks().length;

    manager.newBlock("pause", { pause: 5 });
    // appended after the non-removable "done" marker, so playback has already
    // "stopped" by the time it would run - it contributes nothing yet.
    expect(manager.recordClicks().length).toBe(baseline);

    const pauseEnvelope = document.querySelector(".block-pause") as HTMLElement;
    const moveUp = pauseEnvelope.querySelector(".bi-chevron-up") as HTMLElement;

    moveUp.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);
    moveUp.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(100);

    // now ordered ahead of "stop"/"done", so it runs while still "started"
    expect(manager.recordClicks().length).toBe(baseline + 1);

    const trash = pauseEnvelope.querySelector(".bi-trash") as HTMLElement;
    trash.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(manager.recordClicks().length).toBe(baseline);
    expect(document.querySelectorAll(".block-pause")).toHaveLength(0);

    vi.useRealTimers();
  });
});

describe("BlockManager URL persistence", () => {
  test("block configuration is written back to the URL as it changes", async () => {
    new BlockManager();
    // MutationObserver callbacks run as a microtask; flush the queue via a real macrotask.
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(window.location.search).toContain("start=");
    expect(window.location.search).toContain("metronome=");
    expect(window.location.search).toContain("done=");
  });
});
