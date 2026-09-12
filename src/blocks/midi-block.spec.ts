import { expect, describe, test, beforeEach } from "vitest";
import MidiBlock from "./midi-block";
import { ClickState } from "./clicks";

let parent: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="blocks"></div>';
  parent = document.getElementById("blocks") as HTMLElement;
});

function fields(block: MidiBlock) {
  return {
    timeSig: document.getElementById(`${block.id}-timesig`) as HTMLSelectElement,
    notation: document.getElementById(`${block.id}-notation`) as HTMLInputElement,
    recEnable: document.getElementById(`${block.id}-rec-enable`) as HTMLInputElement,
    playEnable: document.getElementById(`${block.id}-play-enable`) as HTMLInputElement,
  };
}

describe("MidiBlock defaults and opts", () => {
  test("defaults to 4/4, empty notation, recording enabled, playback disabled, no transpose", () => {
    const block = new MidiBlock(parent, { index: 0 });
    expect(block.getOpts()).toEqual({
      timeSig: 4,
      notation: "",
      recEnable: true,
      playEnable: false,
      transpose: "C",
    });
  });

  test("honors initial opts, decoding '+' back to spaces in notation", () => {
    const block = new MidiBlock(parent, {
      index: 0,
      timeSig: "8",
      notation: "c4+d4",
      recEnable: "false",
      playEnable: "true",
      transpose: "Bb",
    });
    expect(block.getOpts()).toEqual({
      timeSig: 8,
      notation: "c4 d4",
      recEnable: false,
      playEnable: true,
      transpose: "Bb",
    });
  });

  test("queryString encodes spaces in notation as '+'", () => {
    const block = new MidiBlock(parent, { index: 0, notation: "c4 d4" });
    expect(block.queryString()).toBe(
      "timeSig:4 notation:c4+d4 recEnable:true playEnable:false transpose:C",
    );
  });
});

describe("MidiBlock validation", () => {
  test("marks invalid notation as invalid on blur", () => {
    const block = new MidiBlock(parent, { index: 0 });
    const { notation } = fields(block);

    notation.value = "not valid lilypond";
    notation.dispatchEvent(new Event("blur"));
    expect(notation.classList.contains("is-invalid")).toBe(true);

    notation.value = "c4 d4";
    notation.dispatchEvent(new Event("blur"));
    expect(notation.classList.contains("is-invalid")).toBe(false);
  });

  test("empty notation is never marked invalid", () => {
    const block = new MidiBlock(parent, { index: 0 });
    const { notation } = fields(block);

    notation.value = "   ";
    notation.dispatchEvent(new Event("blur"));
    expect(notation.classList.contains("is-invalid")).toBe(false);
  });
});

describe("MidiBlock.clickIntervalGen", () => {
  test("does nothing when disabled for the current phase", () => {
    const block = new MidiBlock(parent, { index: 0, notation: "c4", recEnable: "false" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    expect(state.midiSequencers).toHaveLength(0);
  });

  test("registers a MidiSequencer when enabled with valid notation", () => {
    const block = new MidiBlock(parent, { index: 0, notation: "c4 d4", recEnable: "true" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    expect(state.midiSequencers).toHaveLength(1);
  });

  test("registers nothing for invalid notation", () => {
    const block = new MidiBlock(parent, { index: 0, notation: "garbage", recEnable: "true" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    expect(state.midiSequencers).toHaveLength(0);
  });

  test("respects recEnable vs playEnable independently per phase", () => {
    const block = new MidiBlock(parent, {
      index: 0,
      notation: "c4",
      recEnable: "false",
      playEnable: "true",
    });

    const recordState = new ClickState("record");
    [...block.clickIntervalGen("record", recordState)];
    expect(recordState.midiSequencers).toHaveLength(0);

    const playState = new ClickState("play");
    [...block.clickIntervalGen("play", playState)];
    expect(playState.midiSequencers).toHaveLength(1);
  });

  test("applies the transpose semitone offset to note frequencies", () => {
    const block = new MidiBlock(parent, { index: 0, notation: "a4", recEnable: "true", transpose: "Bb" });
    const state = new ClickState("record");

    [...block.clickIntervalGen("record", state)];
    const notes = state.midiSequencers[0].getNotesForBeat(1000);
    // A4 (440Hz) transposed down 2 semitones (Bb clarinet key).
    expect(notes[0].frequency).toBeCloseTo(440 * Math.pow(2, -2 / 12), 6);
  });

  test("clicking the playback-enabled checkbox notifies playback changed", () => {
    const block = new MidiBlock(parent, { index: 0 });
    let notified = false;
    (block as any).notifyPlaybackChanged = () => { notified = true; };
    const { playEnable } = fields(block);

    playEnable.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(notified).toBe(true);
  });
});

describe("MidiBlock transpose gear menu", () => {
  test("opens a transpose selector reflecting the current transpose key", () => {
    const block = new MidiBlock(parent, { index: 0, transpose: "F" });
    const envelope = document.getElementById(block.id) as HTMLElement;
    const gear = envelope.querySelector(".bi-gear") as HTMLElement;

    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const select = document.getElementById(`${block.id}-transpose`) as HTMLSelectElement;
    expect(select.value).toBe("F");
  });

  test("changing the transpose selector updates getOpts/queryString", () => {
    const block = new MidiBlock(parent, { index: 0 });
    const envelope = document.getElementById(block.id) as HTMLElement;
    const gear = envelope.querySelector(".bi-gear") as HTMLElement;
    gear.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const select = document.getElementById(`${block.id}-transpose`) as HTMLSelectElement;
    select.value = "G";

    expect(block.getOpts().transpose).toBe("G");
    expect(block.queryString()).toContain("transpose:G");
  });
});
