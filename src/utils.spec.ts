import { expect, describe, test, vi } from "vitest";
import { randomId, sleep, toTitleCase } from "./utils";

describe("randomId", () => {
  test("returns a string of the requested length", () => {
    expect(randomId(6)).toHaveLength(6);
    expect(randomId(10)).toHaveLength(10);
  });

  test("only contains base36 characters", () => {
    expect(randomId(20)).toMatch(/^[a-z0-9]+$/);
  });

  test("is not deterministic across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomId(8)));
    expect(ids.size).toBeGreaterThan(1);
  });

  test("still returns the full length when Math.random() yields few digits", () => {
    // 0.5.toString(36) is "0.5" - only one digit after the decimal point,
    // which used to make randomId() come up short (see utils.ts history).
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(randomId(10)).toHaveLength(10);
    vi.restoreAllMocks();
  });
});

describe("sleep", () => {
  test("resolves after the given delay", async () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    sleep(1000).then(spy);

    await vi.advanceTimersByTimeAsync(999);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("toTitleCase", () => {
  test("splits camelCase words", () => {
    expect(toTitleCase("squareRoot")).toBe("Square Root");
  });

  test("splits snake_case words", () => {
    expect(toTitleCase("square_root")).toBe("Square Root");
  });

  test("titlecases a single lowercase word", () => {
    expect(toTitleCase("linear")).toBe("Linear");
  });

  test("normalizes already-uppercase words", () => {
    expect(toTitleCase("LINEAR")).toBe("Linear");
  });
});
