import Cookies from "./cookies";
import type { LocalSavesStore, RemoteSavesStore, SaveRecord } from "./saves-merge";

export const SAVES_PREFIX = "practice-recorder-saved-save";

// What the signed-in cloud layer hands to the UI.
export interface CloudSession {
  email: string;
  remote: RemoteSavesStore;
}

export function newSaveRecord(name: string, query: string, now: number = Date.now()): SaveRecord {
  return { id: `zzz-${now}`, name, query, createdAt: now };
}

function idFromKey(key: string): string {
  return key.slice(SAVES_PREFIX.length).replace(/^-/, "");
}

function createdAtFromId(id: string): number {
  const match = id.match(/(\d{10,})$/);
  return match ? Number(match[1]) : 0;
}

// Saves used to be stored as "name,<full page URL>". Split on the *last* comma:
// URLSearchParams percent-encodes commas in the URL, but a name may contain
// them. Returns null for anything that doesn't look like a legacy save.
export function parseLegacySave(id: string, value: string): SaveRecord | null {
  const comma = value.lastIndexOf(",");
  if (comma < 0) return null;
  let query: string;
  try {
    query = new URL(value.slice(comma + 1), window.location.href).search;
  } catch {
    return null;
  }
  return { id, name: value.slice(0, comma), query, createdAt: createdAtFromId(id) };
}

function parseRecord(value: string): SaveRecord | null {
  try {
    const r = JSON.parse(value);
    if (r && typeof r.id === "string" && typeof r.name === "string"
        && typeof r.query === "string" && typeof r.createdAt === "number") {
      return r as SaveRecord;
    }
  } catch {
    // not JSON; ignore
  }
  return null;
}

export class LocalStorageSavesStore implements LocalSavesStore {
  constructor() {
    this.upgradeLegacy();
  }

  list(): SaveRecord[] {
    const records: SaveRecord[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SAVES_PREFIX)) continue;
      const record = parseRecord(localStorage.getItem(key) || "");
      if (record) records.push(record);
    }
    return records;
  }

  put(record: SaveRecord): void {
    localStorage.setItem(`${SAVES_PREFIX}-${record.id}`, JSON.stringify(record));
  }

  // Rewrite legacy "name,url" localStorage values and legacy cookie saves as
  // JSON records. Idempotent, and never overwrites a record that already exists
  // (so a tombstone is not resurrected by a cookie that failed to expire).
  private upgradeLegacy(): void {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SAVES_PREFIX)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const value = localStorage.getItem(key) || "";
      if (parseRecord(value)) continue;
      const record = parseLegacySave(idFromKey(key), value);
      if (!record) continue;
      const canonicalKey = `${SAVES_PREFIX}-${record.id}`;
      if (key !== canonicalKey) {
        if (localStorage.getItem(canonicalKey) !== null) continue;
        localStorage.removeItem(key);
      }
      this.put(record);
    }

    for (const key of Object.keys(Cookies.getAll())) {
      if (!key.startsWith(SAVES_PREFIX)) continue;
      const id = idFromKey(key);
      if (localStorage.getItem(`${SAVES_PREFIX}-${id}`) === null) {
        const record = parseLegacySave(id, Cookies.get(key));
        if (!record) continue;
        this.put(record);
      }
      Cookies.delete(key);
    }
  }
}
