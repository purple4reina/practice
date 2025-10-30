export function randomId(len: number): string {
  return Math.random().toString(36).substr(2, len);
}
