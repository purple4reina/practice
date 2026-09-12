import { expect, describe, test, beforeEach } from "vitest";
import LatencyCompensator from "./latency";
import Cookies from "./cookies";

beforeEach(() => {
  document.body.innerHTML = `
    <button id="lat-minus">-</button>
    <input id="lat-val">
    <button id="lat-plus">+</button>
  `;
  for (const key of Object.keys(Cookies.getAll())) {
    Cookies.delete(key);
  }
});

describe("LatencyCompensator", () => {
  test("defaults to the given default when no cookie is set", () => {
    const compensator = new LatencyCompensator("lat", "latency-cookie", 145);
    expect(compensator.getLatency()).toBe(145);
  });

  test("reads an existing cookie value instead of the default", () => {
    Cookies.set("latency-cookie", "50");
    const compensator = new LatencyCompensator("lat", "latency-cookie", 145);
    expect(compensator.getLatency()).toBe(50);
  });

  test("adjusting the value via the +/- buttons updates getLatency()", () => {
    const compensator = new LatencyCompensator("lat", "latency-cookie", 100);
    document.getElementById("lat-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(compensator.getLatency()).toBe(101);
  });

  test("adjusting the value persists it back to the cookie", () => {
    new LatencyCompensator("lat", "latency-cookie", 100);
    document.getElementById("lat-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(Cookies.get("latency-cookie")).toBe("99");
  });

  test("supports negative values (compensating the other direction)", () => {
    const compensator = new LatencyCompensator("lat", "latency-cookie", 0);
    document.getElementById("lat-minus")!.dispatchEvent(new MouseEvent("click"));
    expect(compensator.getLatency()).toBe(-1);
    expect(Cookies.get("latency-cookie")).toBe("-1");
  });

  test("clamps to the underlying control's [-500, 500] range", () => {
    Cookies.set("latency-cookie", "500");
    const compensator = new LatencyCompensator("lat", "latency-cookie", 0);
    document.getElementById("lat-plus")!.dispatchEvent(new MouseEvent("click"));
    expect(compensator.getLatency()).toBe(500);
  });
});
