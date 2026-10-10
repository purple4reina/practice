// A save is immutable once created: it is only ever added or deleted. That
// makes syncing two copies a plain set union keyed by id, with one wrinkle:
// deletes are recorded as tombstones (`deleted: true`) so they can propagate
// instead of being undone by the other copy.
export interface SaveRecord {
  id: string;
  name: string;
  // Query string only (e.g. "?bpm=80"), never the full URL, so a save works
  // from any origin the app is served from.
  query: string;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface LocalSavesStore {
  list(): SaveRecord[];
  put(record: SaveRecord): void;
}

export interface RemoteSavesStore {
  list(): Promise<SaveRecord[]>;
  put(record: SaveRecord): Promise<void>;
}

export interface MergeResult {
  merged: SaveRecord[];
  toWriteLocal: SaveRecord[];
  toWriteRemote: SaveRecord[];
}

export function tombstone(record: SaveRecord, now: number = Date.now()): SaveRecord {
  return { ...record, deleted: true, deletedAt: now };
}

export function compareRecords(a: SaveRecord, b: SaveRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

// Per id: present on one side only -> copy it to the other; present on both ->
// they agree, unless exactly one is a tombstone, in which case the tombstone
// wins and is copied to the side that still has it live.
export function mergeSaves(local: SaveRecord[], remote: SaveRecord[]): MergeResult {
  const localById = new Map(local.map(r => [r.id, r]));
  const remoteById = new Map(remote.map(r => [r.id, r]));
  const ids = new Set([...localById.keys(), ...remoteById.keys()]);

  const merged: SaveRecord[] = [];
  const toWriteLocal: SaveRecord[] = [];
  const toWriteRemote: SaveRecord[] = [];

  for (const id of ids) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    if (l && !r) {
      merged.push(l);
      toWriteRemote.push(l);
    } else if (r && !l) {
      merged.push(r);
      toWriteLocal.push(r);
    } else if (l && r) {
      if (l.deleted && !r.deleted) {
        merged.push(l);
        toWriteRemote.push(l);
      } else if (r.deleted && !l.deleted) {
        merged.push(r);
        toWriteLocal.push(r);
      } else {
        merged.push(l);
      }
    }
  }

  merged.sort(compareRecords);
  toWriteLocal.sort(compareRecords);
  toWriteRemote.sort(compareRecords);
  return { merged, toWriteLocal, toWriteRemote };
}

// Reconciles the two stores and returns the union (tombstones included).
// Throws if the remote can't be read, in which case nothing has been changed
// and the caller should carry on with local data alone. Failed remote writes
// are ignored: local already holds the data, so the next session retries.
export async function syncSaves(
  local: LocalSavesStore,
  remote: RemoteSavesStore,
): Promise<SaveRecord[]> {
  const remoteRecords = await remote.list();
  const { merged, toWriteLocal, toWriteRemote } = mergeSaves(local.list(), remoteRecords);
  toWriteLocal.forEach(r => local.put(r));
  await Promise.all(toWriteRemote.map(r => remote.put(r).catch(() => {})));
  return merged;
}
