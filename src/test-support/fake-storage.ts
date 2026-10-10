import { vi } from "vitest";

// Node 26 ships an experimental global `localStorage` that is unusable unless
// node is started with --localstorage-file, and it shadows jsdom's. Under
// vitest's jsdom environment `localStorage` therefore reads as undefined.
// Install a fresh in-memory Storage instead; call it from beforeEach so every
// test starts empty.
export function installFakeLocalStorage(): void {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
  };
  vi.stubGlobal("localStorage", storage);
}
