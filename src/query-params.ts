import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

export default class QueryParams {
  private static compressedKey = 'c';
  private static params: URLSearchParams = new URLSearchParams(window.location.search);

  private static getDecompressedParams(): URLSearchParams {
    const compressed = this.params.get(this.compressedKey);
    if (compressed) {
      const decompressed = decompressFromEncodedURIComponent(compressed);
      if (decompressed) {
        return new URLSearchParams(decompressed);
      }
    }
    return new URLSearchParams();
  }

  public static get(key: string): string | null {
    const decompressedParams = this.getDecompressedParams();
    if (decompressedParams.has(key)) {
      return decompressedParams.get(key);
    }
    return this.params.get(key);
  }

  public static getAll(): IterableIterator<[string, string]> {
    const decompressedParams = this.getDecompressedParams();
    if ([...decompressedParams.keys()].length > 0) {
      return decompressedParams.entries();
    }
    return this.params.entries();
  }

  public static has(key: string): boolean {
    const decompressedParams = this.getDecompressedParams();
    return decompressedParams.has(key) || this.params.has(key);
  }

  public static set(key: string, value: string): void {
    this.params.set(key, value);
    this.updateURL();
  }

  public static replace(params: URLSearchParams): void {
    this.params = params;
    this.updateURL();
  }

  private static updateURL(): void {
    const newUrl = `${window.location.pathname}?${this.params.toString()}`;
    if (newUrl.length > 1000) {
      const params = new URLSearchParams();
      params.set(this.compressedKey, compressToEncodedURIComponent(this.params.toString()));
      const compressedUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', compressedUrl);
    } else {
      window.history.replaceState({}, '', newUrl);
    }
  }
}
