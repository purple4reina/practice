import { describe, expect, it } from "vitest";
import { PRODUCTION_HOST, savesCollectionFor } from "./firebase-config";

describe("savesCollectionFor", () => {
  it("uses the real saves collection only on the production host", () => {
    expect(PRODUCTION_HOST).toBe("purple4reina.github.io");
    expect(savesCollectionFor("purple4reina.github.io")).toBe("saves");
  });

  it.each([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "192.168.1.20",
    "my-laptop.local",
    "dev.practice.test",
    "someone-else.github.io",
    "purple4reina.github.io.evil.example",
    "evilpurple4reina.github.io",
    "PURPLE4REINA.GITHUB.IO",
    "",
  ])("keeps %j on the separate test collection", (hostname) => {
    expect(savesCollectionFor(hostname)).toBe("saves-dev");
  });

  it("never maps a test host to the production collection name", () => {
    expect(savesCollectionFor("localhost")).not.toBe(savesCollectionFor(PRODUCTION_HOST));
  });
});
