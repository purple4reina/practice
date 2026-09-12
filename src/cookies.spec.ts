import { expect, describe, test, beforeEach } from "vitest";
import Cookies from "./cookies";

// jsdom implements document.cookie as a real per-document cookie jar, so we
// exercise Cookies against it directly rather than mocking document.cookie.
function clearAllCookies() {
  for (const name of Object.keys(Cookies.getAll())) {
    Cookies.delete(name);
  }
}

describe("Cookies", () => {
  beforeEach(() => {
    clearAllCookies();
  });

  test("set then get roundtrips a value", () => {
    Cookies.set("foo", "bar");
    expect(Cookies.get("foo")).toBe("bar");
  });

  test("get returns empty string for a missing cookie", () => {
    expect(Cookies.get("nope")).toBe("");
  });

  test("set overwrites an existing cookie of the same name", () => {
    Cookies.set("foo", "bar");
    Cookies.set("foo", "baz");
    expect(Cookies.get("foo")).toBe("baz");
  });

  test("getAll returns every cookie as a name/value map", () => {
    Cookies.set("a", "1");
    Cookies.set("b", "2");
    expect(Cookies.getAll()).toEqual({ a: "1", b: "2" });
  });

  test("getAll returns an empty object when there are no cookies", () => {
    expect(Cookies.getAll()).toEqual({});
  });

  test("delete removes a cookie", () => {
    Cookies.set("foo", "bar");
    Cookies.delete("foo");
    expect(Cookies.get("foo")).toBe("");
    expect(Cookies.getAll()).not.toHaveProperty("foo");
  });

  test("get distinguishes cookies with the same prefix", () => {
    Cookies.set("save", "1");
    Cookies.set("save-other", "2");
    expect(Cookies.get("save")).toBe("1");
    expect(Cookies.get("save-other")).toBe("2");
  });
});
