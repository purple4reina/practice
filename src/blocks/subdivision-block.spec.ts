import { expect, describe, test, beforeEach } from "vitest";
import SubdivisionBlock from "./subdivision-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

describe("SubdivisionBlock", () => {
  test("defaults record and playback subdivisions to 1", () => {
    const block = new SubdivisionBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({ recordSubdivisions: 1, playbackSubdivisions: 1 });
  });

  test("honors initial options, clamped to [1, 64]", () => {
    const block = new SubdivisionBlock(parent, {
      index: 0,
      recordSubdivisions: 4,
      playbackSubdivisions: 200,
    });
    expect(block.getOpts()).toEqual({ recordSubdivisions: 4, playbackSubdivisions: 64 });
  });

  test("sets state.subdivisions from recordSubdivisions during the record phase", () => {
    const block = new SubdivisionBlock(parent, { index: 0, recordSubdivisions: 3, playbackSubdivisions: 5 });
    const state = new ClickState("record");
    [...block.clickIntervalGen("record", state)];
    expect(state.subdivisions).toBe(3);
  });

  test("sets state.subdivisions from playbackSubdivisions during the play phase", () => {
    const block = new SubdivisionBlock(parent, { index: 0, recordSubdivisions: 3, playbackSubdivisions: 5 });
    const state = new ClickState("play");
    [...block.clickIntervalGen("play", state)];
    expect(state.subdivisions).toBe(5);
  });

  test("throws for an unrecognized phase", () => {
    const block = new SubdivisionBlock(parent, { index: 0 });
    const state = new ClickState("record");
    expect(() => [...block.clickIntervalGen("bogus" as any, state)]).toThrow(/Unknown phase/);
  });

  test("queryString reports both subdivision values", () => {
    const block = new SubdivisionBlock(parent, { index: 0, recordSubdivisions: 2, playbackSubdivisions: 4 });
    expect(block.queryString()).toBe("recordSubdivisions:2 playbackSubdivisions:4");
  });
});
