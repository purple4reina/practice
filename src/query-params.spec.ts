import { expect, describe, test, beforeEach } from "vitest";
import { compressToEncodedURIComponent } from "lz-string";
import QueryParams from "./query-params";

describe("QueryParams", () => {
  beforeEach(() => {
    QueryParams.replace(new URLSearchParams());
  });

  test("set then get roundtrips a value", () => {
    QueryParams.set("foo", "bar");
    expect(QueryParams.get("foo")).toBe("bar");
  });

  test("get returns null for a missing key", () => {
    expect(QueryParams.get("nope")).toBeNull();
  });

  test("has reflects presence of a key", () => {
    expect(QueryParams.has("foo")).toBe(false);
    QueryParams.set("foo", "bar");
    expect(QueryParams.has("foo")).toBe(true);
  });

  test("getAll iterates every key/value pair", () => {
    QueryParams.set("a", "1");
    QueryParams.set("b", "2");
    expect([...QueryParams.getAll()]).toEqual([["a", "1"], ["b", "2"]]);
  });

  test("set updates the visible URL", () => {
    QueryParams.set("foo", "bar");
    expect(window.location.search).toContain("foo=bar");
  });

  test("replace swaps the entire param set", () => {
    QueryParams.set("foo", "bar");
    QueryParams.replace(new URLSearchParams("baz=qux"));
    expect(QueryParams.get("foo")).toBeNull();
    expect(QueryParams.get("baz")).toBe("qux");
  });

  describe("compressed params (the 'c' key)", () => {
    test("get prefers a decompressed value over a same-named raw param", () => {
      const compressed = compressToEncodedURIComponent("foo=from-compressed");
      const params = new URLSearchParams();
      params.set("c", compressed);
      params.set("foo", "from-raw");
      QueryParams.replace(params);

      expect(QueryParams.get("foo")).toBe("from-compressed");
    });

    test("has is true for a key that only exists inside the compressed blob", () => {
      const compressed = compressToEncodedURIComponent("hidden=1");
      const params = new URLSearchParams();
      params.set("c", compressed);
      QueryParams.replace(params);

      expect(QueryParams.has("hidden")).toBe(true);
      expect(QueryParams.has("nope")).toBe(false);
    });

    test("getAll reads from the decompressed blob when present", () => {
      const compressed = compressToEncodedURIComponent("a=1&b=2");
      const params = new URLSearchParams();
      params.set("c", compressed);
      QueryParams.replace(params);

      expect([...QueryParams.getAll()]).toEqual([["a", "1"], ["b", "2"]]);
    });

    test("falls back to raw params when 'c' is not valid compressed data", () => {
      const params = new URLSearchParams();
      params.set("c", "not-actually-compressed");
      params.set("foo", "bar");
      QueryParams.replace(params);

      expect(QueryParams.get("foo")).toBe("bar");
    });

    test("a very long param set is compressed into the visible URL", () => {
      QueryParams.set("notation", "a".repeat(3000));
      expect(window.location.search.length).toBeLessThan(2000);
      expect(window.location.search).toMatch(/^\?c=/);
    });

    test("compressing the URL does not change what get() returns", () => {
      QueryParams.set("notation", "a".repeat(3000));
      expect(QueryParams.get("notation")).toBe("a".repeat(3000));
    });
  });
});
