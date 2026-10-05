import { u32, rotl32 } from './uint';

export function seedMixer(data: Uint8Array): [number, number, number, number] {
  let a = 0x243f6a88, b = 0x85a308d3, c = 0x13198a2e, d = 0x03707344;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const p1 = Math.imul(i + 1, 0x9e3779b1);
    const p2 = Math.imul(x + 1, 0x85ebca6b);
    const p3 = Math.imul(i + 1, 0xc2b2ae35);
    a = u32(rotl32(u32(a ^ u32(x + p1)), 5) + b);
    b = u32(rotl32(u32(b + x + c), 7) ^ a);
    c = u32(rotl32(u32(c ^ p2), 11) + d);
    d = u32(rotl32(u32(d + x + p3), 13) ^ c);
  }
  for (let r = 0; r < 16; r++) {
    const t = u32(a ^ rotl32(b, (r % 31) + 1) ^ c ^ d ^ r);
    a = u32(rotl32(u32(a + t), 5) ^ b);
    b = u32(rotl32(u32(b ^ t), 7) + c);
    c = u32(rotl32(u32(c + t), 11) ^ d);
    d = u32(rotl32(u32(d ^ t), 13) + a);
  }
  if (a === 0 && b === 0 && c === 0 && d === 0) d = 1;
  return [a, b, c, d];
}
