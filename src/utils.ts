export function randomId(len: number): string {
  // Math.random().toString(36) doesn't always yield enough digits to satisfy
  // `len` (e.g. 0.5 -> "0.5" -> only 1 char after the decimal point), so loop
  // until there's enough to slice from.
  let id = "";
  while (id.length < len) {
    id += Math.random().toString(36).slice(2);
  }
  return id.slice(0, len);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function toTitleCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
