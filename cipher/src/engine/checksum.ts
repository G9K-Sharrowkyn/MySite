export function checksum32(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (const x of bytes) { h ^= x; h = Math.imul(h, 0x01000193); h >>>= 0; }
  h ^= bytes.length;
  return h >>> 0;
}
