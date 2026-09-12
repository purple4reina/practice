import { expect, describe, test, beforeEach, afterEach, vi } from "vitest";
import Tapper from "./tapper";

beforeEach(() => {
  document.body.innerHTML = `
    <button id="tapper" class="btn btn-outline-secondary"></button>
    <span id="tapper-display"></span>
  `;
});

afterEach(() => {
  vi.useRealTimers();
});

function toggleButton(): HTMLElement {
  return document.getElementById("tapper") as HTMLElement;
}

function display(): HTMLElement {
  return document.getElementById("tapper-display") as HTMLElement;
}

function tapEnter() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
}

describe("Tapper toggle", () => {
  test("starts inactive, styled as outline-secondary", () => {
    new Tapper();
    expect(toggleButton().classList.contains("btn-outline-secondary")).toBe(true);
    expect(toggleButton().classList.contains("btn-primary")).toBe(false);
  });

  test("clicking the toggle activates tapping mode", () => {
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));

    expect(toggleButton().classList.contains("btn-primary")).toBe(true);
    expect(toggleButton().classList.contains("btn-outline-secondary")).toBe(false);
    expect(display().innerText).toBe("Press Enter to Tap");
  });

  test("clicking again deactivates it", () => {
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));
    toggleButton().dispatchEvent(new MouseEvent("click"));

    expect(toggleButton().classList.contains("btn-outline-secondary")).toBe(true);
    expect(display().innerText).toBe("");
  });

  test("Enter does nothing while inactive", () => {
    vi.useFakeTimers();
    new Tapper();
    tapEnter();
    vi.advanceTimersByTime(0);
    expect(display().innerText).toBeUndefined(); // never touched - toggle() was never called
  });
});

describe("Tapper BPM calculation", () => {
  test("computes bpm from the average interval between taps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));

    tapEnter(); // t=0
    vi.setSystemTime(1000);
    tapEnter(); // t=1000 -> 1000ms interval -> 60bpm
    vi.advanceTimersByTime(0);

    expect(display().innerText).toBe("60");
  });

  test("averages multiple intervals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));

    tapEnter(); // t=0
    vi.setSystemTime(500);
    tapEnter(); // interval 500ms
    vi.setSystemTime(1500);
    tapEnter(); // interval 1000ms; avg = 750ms -> 80bpm
    vi.advanceTimersByTime(0);

    expect(display().innerText).toBe("80");
  });

  test("a single tap shows no bpm yet", () => {
    vi.useFakeTimers();
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));

    tapEnter();
    vi.advanceTimersByTime(0);

    expect(display().innerText).toBe("Press Enter to Tap");
  });

  test("toggling off and back on resets the tap history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));
    tapEnter();
    vi.setSystemTime(1000);
    tapEnter();
    vi.advanceTimersByTime(0);
    expect(display().innerText).toBe("60");

    toggleButton().dispatchEvent(new MouseEvent("click")); // off
    toggleButton().dispatchEvent(new MouseEvent("click")); // on again

    expect(display().innerText).toBe("Press Enter to Tap");
  });
});

describe("Tapper offcanvas integration", () => {
  test("closing the offcanvas panel turns off an active tapper", () => {
    new Tapper();
    toggleButton().dispatchEvent(new MouseEvent("click"));
    expect(toggleButton().classList.contains("btn-primary")).toBe(true);

    window.dispatchEvent(new Event("hidden.bs.offcanvas"));

    expect(toggleButton().classList.contains("btn-outline-secondary")).toBe(true);
  });

  test("closing the offcanvas panel is a no-op when already inactive", () => {
    new Tapper();
    window.dispatchEvent(new Event("hidden.bs.offcanvas"));
    expect(toggleButton().classList.contains("btn-outline-secondary")).toBe(true);
  });
});
