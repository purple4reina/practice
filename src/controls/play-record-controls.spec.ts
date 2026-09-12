import { expect, describe, test, beforeEach, afterEach, vi } from "vitest";
import PlayRecordControls from "./play-record-controls";

// PlayRecordControls.initializeEventListeners attaches its listeners directly
// to `document`, which (unlike document.body) isn't reset between tests in
// the same file. Track and remove them after each test so one test's
// listeners can't fire during another's (they'd otherwise all react to the
// same shared document.activeElement/keydown events).
let addedListeners: Array<[string, EventListenerOrEventListenerObject]> = [];

beforeEach(() => {
  document.body.innerHTML = `
    <i id="record" style="display:inline-block"></i>
    <i id="recording" style="display:none"></i>
    <i id="play" style="display:none"></i>
    <i id="playing" style="display:none"></i>
  `;
  addedListeners = [];
  const originalAdd = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((type, handler, opts) => {
    addedListeners.push([type, handler as EventListenerOrEventListenerObject]);
    originalAdd(type, handler as EventListenerOrEventListenerObject, opts as AddEventListenerOptions);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  addedListeners.forEach(([type, handler]) => document.removeEventListener(type, handler));
});

function displays() {
  return {
    record: (document.getElementById("record") as HTMLElement).style.display,
    recording: (document.getElementById("recording") as HTMLElement).style.display,
    play: (document.getElementById("play") as HTMLElement).style.display,
    playing: (document.getElementById("playing") as HTMLElement).style.display,
  };
}

function callbacks() {
  return {
    record: vi.fn(),
    stopRecording: vi.fn(),
    play: vi.fn(),
    stopPlaying: vi.fn(),
  };
}

describe("PlayRecordControls initial/idle states", () => {
  test("shows only the record icon initially", () => {
    new PlayRecordControls();
    expect(displays()).toEqual({ record: "inline-block", recording: "none", play: "none", playing: "none" });
  });

  test("markRecording shows only the recording icon", () => {
    const controls = new PlayRecordControls();
    controls.markRecording();
    expect(displays()).toEqual({ record: "none", recording: "inline-block", play: "none", playing: "none" });
  });

  test("markPlaying shows only the playing icon", () => {
    const controls = new PlayRecordControls();
    controls.markPlaying();
    expect(displays()).toEqual({ record: "none", recording: "none", play: "none", playing: "inline-block" });
  });

  test("markStopped after recording shows play+record (a clip now exists)", () => {
    const controls = new PlayRecordControls();
    controls.markRecording();
    controls.markStopped();
    expect(displays()).toEqual({ record: "inline-block", recording: "none", play: "inline-block", playing: "none" });
  });

  test("markStopped always reveals both play and record (caller is expected to only invoke it after a clip exists)", () => {
    const controls = new PlayRecordControls();
    controls.markStopped();
    expect(displays().play).toBe("inline-block");
    expect(displays().record).toBe("inline-block");
  });

  test("reset() returns to the initial record-only state", () => {
    const controls = new PlayRecordControls();
    controls.markPlaying();
    controls.reset();
    expect(displays()).toEqual({ record: "inline-block", recording: "none", play: "none", playing: "none" });
  });
});

describe("PlayRecordControls click wiring", () => {
  test("clicking each icon invokes its corresponding callback", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);

    document.getElementById("record")!.dispatchEvent(new MouseEvent("click"));
    expect(cbs.record).toHaveBeenCalledTimes(1);

    document.getElementById("recording")!.dispatchEvent(new MouseEvent("click"));
    expect(cbs.stopRecording).toHaveBeenCalledTimes(1);

    document.getElementById("play")!.dispatchEvent(new MouseEvent("click"));
    expect(cbs.play).toHaveBeenCalledTimes(1);

    document.getElementById("playing")!.dispatchEvent(new MouseEvent("click"));
    expect(cbs.stopPlaying).toHaveBeenCalledTimes(1);
  });
});

describe("PlayRecordControls spacebar shortcut", () => {
  function spaceKeydown() {
    return new KeyboardEvent("keydown", { key: " ", cancelable: true });
  }

  test("space starts recording when idle and next action is 'record'", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);

    document.dispatchEvent(spaceKeydown());
    expect(cbs.record).toHaveBeenCalledTimes(1);
  });

  test("space plays back when idle after a completed recording (next action is 'play')", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);
    controls.markRecording();
    controls.markStopped(); // next action is now "play"

    document.dispatchEvent(spaceKeydown());
    expect(cbs.play).toHaveBeenCalledTimes(1);
  });

  test("space stops an in-progress recording", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);
    controls.markRecording();

    document.dispatchEvent(spaceKeydown());
    expect(cbs.stopRecording).toHaveBeenCalledTimes(1);
  });

  test("space stops in-progress playback", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);
    controls.markPlaying();

    document.dispatchEvent(spaceKeydown());
    expect(cbs.stopPlaying).toHaveBeenCalledTimes(1);
  });

  test("space is ignored while an offcanvas panel is open", () => {
    const controls = new PlayRecordControls();
    const cbs = callbacks();
    controls.initializeEventListeners(cbs);
    document.dispatchEvent(new Event("shown.bs.offcanvas"));

    document.dispatchEvent(spaceKeydown());
    expect(cbs.record).not.toHaveBeenCalled();

    document.dispatchEvent(new Event("hidden.bs.offcanvas"));
    document.dispatchEvent(spaceKeydown());
    expect(cbs.record).toHaveBeenCalledTimes(1);
  });
});

describe("PlayRecordControls Enter key handling", () => {
  test("Enter clicks a focused switch-role element", () => {
    document.body.innerHTML += '<input id="a-switch" role="switch">';
    const controls = new PlayRecordControls();
    controls.initializeEventListeners(callbacks());

    const switchEl = document.getElementById("a-switch") as HTMLInputElement;
    switchEl.focus();
    const clickSpy = vi.fn();
    switchEl.addEventListener("click", clickSpy);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test("Enter blurs a focused non-switch element", () => {
    document.body.innerHTML += '<button id="a-button">Go</button>';
    const controls = new PlayRecordControls();
    controls.initializeEventListeners(callbacks());

    const button = document.getElementById("a-button") as HTMLButtonElement;
    button.focus();
    expect(document.activeElement).toBe(button);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(document.activeElement).not.toBe(button);
  });
});
