export function randomId(len: number): string {
  return Math.random().toString(36).substr(2, len);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
