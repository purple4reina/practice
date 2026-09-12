// Neither jsdom (in this configuration) nor Node's own experimental global
// (gated behind --localstorage-file) provide a working localStorage/
// sessionStorage in the test environment, but src/saves.ts and friends read
// the bare global directly. Polyfill both with a simple in-memory Storage
// implementation so that code runs as it would in a real browser.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function installStorage(name: "localStorage" | "sessionStorage") {
  const storage = new MemoryStorage();
  for (const target of [globalThis, window]) {
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

if (typeof window !== "undefined") {
  installStorage("localStorage");
  installStorage("sessionStorage");
}
