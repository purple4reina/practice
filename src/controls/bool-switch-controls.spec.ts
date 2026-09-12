import { expect, describe, test, beforeEach } from "vitest";
import boolSwitchControls from "./bool-switch-controls";
import QueryParams from "../query-params";

beforeEach(() => {
  document.body.innerHTML = '<input type="checkbox" id="my-switch">';
  QueryParams.replace(new URLSearchParams());
});

describe("boolSwitchControls", () => {
  test("defaults to opts.initial when there's no query param", () => {
    const value = boolSwitchControls("my-switch", { initial: true });
    expect(value()).toBe(true);
    expect((document.getElementById("my-switch") as HTMLInputElement).checked).toBe(true);
  });

  test("defaults to false when no initial option is given", () => {
    const value = boolSwitchControls("my-switch");
    expect(value()).toBe(false);
  });

  test("a query param overrides opts.initial", () => {
    QueryParams.set("my-switch", "true");
    const value = boolSwitchControls("my-switch", { initial: false });
    expect(value()).toBe(true);
  });

  test("clicking the checkbox in the UI updates the returned value", () => {
    const value = boolSwitchControls("my-switch", { initial: false });
    const elem = document.getElementById("my-switch") as HTMLInputElement;

    elem.click(); // toggles checked (false -> true) and fires "click", like a real user click

    expect(value()).toBe(true);
  });

  test("changes are persisted back to the query params", () => {
    const value = boolSwitchControls("my-switch", { initial: false });
    const elem = document.getElementById("my-switch") as HTMLInputElement;

    elem.click();

    expect(QueryParams.get("my-switch")).toBe("true");
    expect(value()).toBe(true);
  });
});
