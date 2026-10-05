export function u32(x: number): number { return x >>> 0; }
export function rotl32(x: number, n: number): number {
  n &= 31;
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}
export function byte(x: number): number { return x & 0xff; }
export function hex32(x: number): string { return u32(x).toString(16).padStart(8, '0'); }
