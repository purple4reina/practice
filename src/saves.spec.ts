import { beforeEach, describe, expect, it, vi } from "vitest";
import Cookies from "./cookies";
import Saves from "./saves";
import { SAVES_PREFIX, LocalStorageSavesStore, parseLegacySave } from "./saves-store";
import type { SaveRecord, RemoteSavesStore } from "./saves-merge";
import { tombstone } from "./saves-merge";
import { resetDom } from "./test-support/dom";
import { installFakeLocalStorage } from "./test-support/fake-storage";

const key = (id: string) => `${SAVES_PREFIX}-${id}`;
const syncTip = () => document.getElementById("saves-sync-info")!.getAttribute("title");

function clearStorage() {
  installFakeLocalStorage();
  for (const name of Object.keys(Cookies.getAll())) Cookies.delete(name);
}

function fakeRemote(initial: SaveRecord[] = []) {
  const docs = new Map(initial.map(r => [r.id, r]));
  const store: RemoteSavesStore & { docs: Map<string, SaveRecord> } = {
    docs,
    list: async () => [...docs.values()],
    put: async (r) => { docs.set(r.id, r); },
  };
  return store;
}

beforeEach(() => {
  resetDom();
  clearStorage();
});

describe("parseLegacySave", () => {
  it("splits name and url on the last comma so names may contain commas", () => {
    const rec = parseLegacySave("zzz-1700000000000", "Etude 4, take 2,https://example.com/practice/?bpm=80");
    expect(rec).toEqual({
      id: "zzz-1700000000000",
      name: "Etude 4, take 2",
      query: "?bpm=80",
      createdAt: 1700000000000,
    });
  });

  it("keeps only the query string, dropping the origin and path", () => {
    const rec = parseLegacySave("zzz-1700000000000", "A,http://localhost:5173/practice/?x=1&y=2");
    expect(rec?.query).toBe("?x=1&y=2");
  });

  it("uses a createdAt of 0 when the id carries no timestamp", () => {
    expect(parseLegacySave("old", "A,https://example.com/?x=1")?.createdAt).toBe(0);
  });

  it("returns null for a value with no comma", () => {
    expect(parseLegacySave("zzz-1", "garbage")).toBeNull();
  });
});

describe("LocalStorageSavesStore", () => {
  it("round-trips records", () => {
    const store = new LocalStorageSavesStore();
    const rec: SaveRecord = { id: "zzz-1700000000000", name: "A", query: "?x=1", createdAt: 1700000000000 };
    store.put(rec);
    expect(store.list()).toEqual([rec]);
  });

  it("upgrades legacy localStorage saves to records in place", () => {
    localStorage.setItem(key("zzz-1700000000000"), "My piece,https://example.com/practice/?bpm=60");
    const store = new LocalStorageSavesStore();
    expect(store.list()).toEqual([
      { id: "zzz-1700000000000", name: "My piece", query: "?bpm=60", createdAt: 1700000000000 },
    ]);
    expect(JSON.parse(localStorage.getItem(key("zzz-1700000000000"))!).name).toBe("My piece");
  });

  it("moves legacy cookie saves into localStorage and expires the cookie", () => {
    Cookies.set(key("cookie-save"), "From cookie,https://example.com/practice/?bpm=90");
    const store = new LocalStorageSavesStore();
    expect(store.list().map(r => [r.id, r.name, r.query])).toEqual([
      ["cookie-save", "From cookie", "?bpm=90"],
    ]);
    expect(Cookies.get(key("cookie-save"))).toBe("");
  });

  it("does not resurrect a deleted save from a leftover cookie", () => {
    const gone = tombstone({ id: "cookie-save", name: "X", query: "?a=1", createdAt: 0 }, 100);
    localStorage.setItem(key("cookie-save"), JSON.stringify(gone));
    Cookies.set(key("cookie-save"), "X,https://example.com/?a=1");
    const store = new LocalStorageSavesStore();
    expect(store.list()).toEqual([gone]);
  });

  it("ignores unrelated localStorage keys", () => {
    localStorage.setItem("something-else", "x,y");
    expect(new LocalStorageSavesStore().list()).toEqual([]);
  });
});

describe("Saves UI", () => {
  const names = () => [...document.querySelectorAll<HTMLElement>("#saves a")].map(a => a.innerText);

  it("lists Default plus live saves, hiding tombstones", () => {
    const store = new LocalStorageSavesStore();
    store.put({ id: "zzz-1700000000001", name: "Kept", query: "?a=1", createdAt: 1700000000001 });
    store.put(tombstone({ id: "zzz-1700000000002", name: "Gone", query: "?a=2", createdAt: 1700000000002 }));
    new Saves();
    expect(names()).toEqual(["Default", "Kept"]);
  });

  it("builds each save's link from the current origin and path plus its query", () => {
    new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "Kept", query: "?a=1", createdAt: 1700000000001 });
    new Saves();
    const link = document.querySelectorAll<HTMLAnchorElement>("#saves a")[1];
    expect(link.href).toBe(`${window.location.origin}${window.location.pathname}?a=1`);
  });

  it("stores only the query string when saving the current config", () => {
    new Saves();
    window.history.replaceState({}, "", "/?bpm=80");
    (document.getElementById("save-new") as HTMLElement).click();
    (document.getElementById("save-name") as HTMLInputElement).value = "Warmup, slow";
    (document.getElementById("save-submit") as HTMLElement).click();
    const [saved] = new LocalStorageSavesStore().list();
    expect(saved.name).toBe("Warmup, slow");
    expect(saved.query).toBe("?bpm=80");
    expect(names()).toEqual(["Default", "Warmup, slow"]);
  });

  it("deleting a save records a tombstone and removes it from the list", () => {
    new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "Doomed", query: "?a=1", createdAt: 1700000000001 });
    new Saves();
    (document.getElementById("save-delete") as HTMLElement).click();
    (document.querySelector("#saves i.bi-trash") as HTMLElement).click();
    expect(names()).toEqual(["Default"]);
    const [stored] = new LocalStorageSavesStore().list();
    expect(stored.deleted).toBe(true);
    expect(stored.name).toBe("Doomed");
  });

  it("clears and re-renders instead of accumulating duplicates", () => {
    new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "One", query: "?a=1", createdAt: 1700000000001 });
    new Saves();
    (document.getElementById("save-new") as HTMLElement).click();
    (document.getElementById("save-name") as HTMLInputElement).value = "Two";
    (document.getElementById("save-submit") as HTMLElement).click();
    expect(names()).toEqual(["Default", "One", "Two"]);
  });

  describe("with a cloud session", () => {
    it("shows the union of this device and the cloud, and uploads what the cloud lacked", async () => {
      new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "Laptop A", query: "?a=1", createdAt: 1700000000001 });
      const remote = fakeRemote([{ id: "zzz-1700000000002", name: "Laptop B", query: "?b=1", createdAt: 1700000000002 }]);
      const saves = new Saves();
      saves.enableSync(() => {});
      await saves.setSession({ email: "me@example.com", remote });
      expect(names()).toEqual(["Default", "Laptop A", "Laptop B"]);
      expect([...remote.docs.keys()].sort()).toEqual(["zzz-1700000000001", "zzz-1700000000002"]);
      expect(syncTip()).toBe("Synced as me@example.com.");
    });

    it("applies a delete made on the other device", async () => {
      new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "Shared", query: "?a=1", createdAt: 1700000000001 });
      const remote = fakeRemote([tombstone({ id: "zzz-1700000000001", name: "Shared", query: "?a=1", createdAt: 1700000000001 }, 5)]);
      const saves = new Saves();
      await saves.setSession({ email: "me@example.com", remote });
      expect(names()).toEqual(["Default"]);
    });

    it("writes new saves and deletes through to the cloud", async () => {
      const remote = fakeRemote();
      const saves = new Saves();
      await saves.setSession({ email: "me@example.com", remote });
      (document.getElementById("save-new") as HTMLElement).click();
      (document.getElementById("save-name") as HTMLInputElement).value = "Fresh";
      (document.getElementById("save-submit") as HTMLElement).click();
      await Promise.resolve();
      const [doc] = [...remote.docs.values()];
      expect(doc.name).toBe("Fresh");
      expect(doc.deleted).toBeUndefined();

      (document.getElementById("save-delete") as HTMLElement).click();
      (document.querySelector("#saves i.bi-trash") as HTMLElement).click();
      await Promise.resolve();
      expect(remote.docs.get(doc.id)?.deleted).toBe(true);
    });

    it("falls back to this device's saves when the cloud is unreachable", async () => {
      new LocalStorageSavesStore().put({ id: "zzz-1700000000001", name: "Local only", query: "?a=1", createdAt: 1700000000001 });
      const remote = fakeRemote();
      remote.list = async () => { throw new Error("offline"); };
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const saves = new Saves();
      await saves.setSession({ email: "me@example.com", remote });
      warn.mockRestore();
      expect(names()).toEqual(["Default", "Local only"]);
      expect(syncTip()).toContain("Couldn't reach the cloud");
    });

    it("reports sync status in the info icon's tooltip, not inline text", async () => {
      const info = document.getElementById("saves-sync-info") as HTMLElement;
      const saves = new Saves();
      saves.enableSync(() => {});
      expect(info.getAttribute("data-bs-toggle")).toBe("tooltip");
      expect(info.hidden).toBe(false);
      expect(syncTip()).toBe("Sign in to sync saves across devices.");

      await saves.setSession({ email: "me@example.com", remote: fakeRemote() });
      expect(info.hidden).toBe(false);
      expect(syncTip()).toBe("Synced as me@example.com.");

      await saves.setSession(null);
      expect(syncTip()).toBe("Sign in to sync saves across devices.");
      expect(document.getElementById("saves-sync-status")).toBeNull();
    });

    it("updates the live Bootstrap tooltip when one is attached to the icon", async () => {
      const setContent = vi.fn();
      vi.stubGlobal("bootstrap", { Tooltip: { getInstance: () => ({ setContent }) } });
      const saves = new Saves();
      saves.enableSync(() => {});
      await saves.setSession({ email: "me@example.com", remote: fakeRemote() });
      vi.unstubAllGlobals();
      expect(setContent).toHaveBeenLastCalledWith({ ".tooltip-inner": "Synced as me@example.com." });
    });

    it("offers sign-in again after signing out", async () => {
      const saves = new Saves();
      saves.enableSync(() => {});
      await saves.setSession({ email: "me@example.com", remote: fakeRemote() });
      expect((document.getElementById("saves-sync-signout") as HTMLElement).hidden).toBe(false);
      await saves.setSession(null);
      expect((document.getElementById("saves-sync-signout") as HTMLElement).hidden).toBe(true);
      expect((document.getElementById("saves-signin") as HTMLElement).hidden).toBe(false);
    });
  });
});
