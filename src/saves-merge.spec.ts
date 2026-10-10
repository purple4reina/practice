import { describe, it, expect } from "vitest";
import { mergeSaves, syncSaves, tombstone } from "./saves-merge";
import type { LocalSavesStore, RemoteSavesStore, SaveRecord } from "./saves-merge";

const rec = (id: string, createdAt = 1): SaveRecord => ({
  id,
  name: `name-${id}`,
  query: `?q=${id}`,
  createdAt,
});

const ids = (records: SaveRecord[]) => records.map(r => r.id);

describe("mergeSaves", () => {
  it("copies a save that exists only locally to the remote", () => {
    const result = mergeSaves([rec("a")], []);
    expect(ids(result.merged)).toEqual(["a"]);
    expect(ids(result.toWriteRemote)).toEqual(["a"]);
    expect(result.toWriteLocal).toEqual([]);
  });

  it("copies a save that exists only remotely to local", () => {
    const result = mergeSaves([], [rec("b")]);
    expect(ids(result.merged)).toEqual(["b"]);
    expect(ids(result.toWriteLocal)).toEqual(["b"]);
    expect(result.toWriteRemote).toEqual([]);
  });

  it("gives each side what the other has when they have different saves", () => {
    const result = mergeSaves([rec("a", 1)], [rec("b", 2)]);
    expect(ids(result.merged)).toEqual(["a", "b"]);
    expect(ids(result.toWriteLocal)).toEqual(["b"]);
    expect(ids(result.toWriteRemote)).toEqual(["a"]);
  });

  it("writes nothing when both sides already agree", () => {
    const result = mergeSaves([rec("a"), rec("b", 2)], [rec("b", 2), rec("a")]);
    expect(result.toWriteLocal).toEqual([]);
    expect(result.toWriteRemote).toEqual([]);
    expect(ids(result.merged)).toEqual(["a", "b"]);
  });

  it("lets a local tombstone beat the live remote copy", () => {
    const gone = tombstone(rec("a"), 100);
    const result = mergeSaves([gone], [rec("a")]);
    expect(result.merged).toEqual([gone]);
    expect(result.toWriteRemote).toEqual([gone]);
    expect(result.toWriteLocal).toEqual([]);
  });

  it("lets a remote tombstone beat the live local copy", () => {
    const gone = tombstone(rec("a"), 100);
    const result = mergeSaves([rec("a")], [gone]);
    expect(result.merged).toEqual([gone]);
    expect(result.toWriteLocal).toEqual([gone]);
    expect(result.toWriteRemote).toEqual([]);
  });

  it("propagates a tombstone for a save the other side never had", () => {
    const gone = tombstone(rec("a"), 100);
    const result = mergeSaves([], [gone]);
    expect(result.toWriteLocal).toEqual([gone]);
  });

  it("does not write when both sides hold a tombstone", () => {
    const result = mergeSaves([tombstone(rec("a"), 100)], [tombstone(rec("a"), 200)]);
    expect(result.toWriteLocal).toEqual([]);
    expect(result.toWriteRemote).toEqual([]);
  });

  it("orders the merged list by creation time, then id", () => {
    const result = mergeSaves([rec("z", 1), rec("m", 5)], [rec("a", 5), rec("b", 3)]);
    expect(ids(result.merged)).toEqual(["z", "b", "a", "m"]);
  });

  it("is idempotent: merging the result again produces no writes", () => {
    const local = [rec("a", 1), tombstone(rec("c", 3), 50)];
    const remote = [rec("b", 2), rec("c", 3)];
    const first = mergeSaves(local, remote);
    const newLocal = [...local.filter(r => !first.toWriteLocal.some(w => w.id === r.id)), ...first.toWriteLocal];
    const newRemote = [...remote.filter(r => !first.toWriteRemote.some(w => w.id === r.id)), ...first.toWriteRemote];
    const second = mergeSaves(newLocal, newRemote);
    expect(second.toWriteLocal).toEqual([]);
    expect(second.toWriteRemote).toEqual([]);
    expect(second.merged).toEqual(first.merged);
  });
});

function fakeLocal(initial: SaveRecord[] = []) {
  const records = new Map(initial.map(r => [r.id, r]));
  const store: LocalSavesStore & { records: Map<string, SaveRecord> } = {
    records,
    list: () => [...records.values()],
    put: (r) => { records.set(r.id, r); },
  };
  return store;
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

describe("syncSaves", () => {
  it("leaves both stores holding the union and returns it", async () => {
    const local = fakeLocal([rec("a", 1)]);
    const remote = fakeRemote([rec("b", 2)]);
    const merged = await syncSaves(local, remote);
    expect(ids(merged)).toEqual(["a", "b"]);
    expect([...local.records.keys()].sort()).toEqual(["a", "b"]);
    expect([...remote.docs.keys()].sort()).toEqual(["a", "b"]);
  });

  it("propagates a delete made on another device", async () => {
    const local = fakeLocal([rec("a")]);
    const remote = fakeRemote([tombstone(rec("a"), 100)]);
    await syncSaves(local, remote);
    expect(local.records.get("a")?.deleted).toBe(true);
  });

  it("rejects without touching local when the remote can't be read", async () => {
    const local = fakeLocal([rec("a")]);
    const remote = fakeRemote();
    remote.list = async () => { throw new Error("offline"); };
    await expect(syncSaves(local, remote)).rejects.toThrow("offline");
    expect(ids(local.list())).toEqual(["a"]);
  });

  it("still updates local when a remote write fails", async () => {
    const local = fakeLocal([rec("a", 1)]);
    const remote = fakeRemote([rec("b", 2)]);
    remote.put = async () => { throw new Error("denied"); };
    await syncSaves(local, remote);
    expect([...local.records.keys()].sort()).toEqual(["a", "b"]);
  });
});
