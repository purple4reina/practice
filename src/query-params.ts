export default class QueryParams {
  private static params: URLSearchParams = new URLSearchParams(window.location.search);

  public static get(key: string): string | null {
    return this.params.get(key);
  }

  public static getAll(): IterableIterator<[string, string]> {
    return this.params.entries();
  }

  public static has(key: string): boolean {
    return this.params.has(key);
  }

  public static set(key: string, value: string): void {
    this.params.set(key, value);
    this.updateURL();
  }

  public static setAll(params: Map<string, string>): void {
    params.forEach((value, key) => {
      this.params.set(key, value);
    });
    this.updateURL();
  }

  public static delete(key: string): void {
    this.params.delete(key);
    this.updateURL();
  }

  private static updateURL(): void {
    const newUrl = `${window.location.pathname}?${this.params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }
}
