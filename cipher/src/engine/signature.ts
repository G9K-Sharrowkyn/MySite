import { u32, rotl32 } from './uint';
import type { MessageSignature } from './types';

export function calculateMessageSignature(bytes: Uint8Array): MessageSignature {
  let a = 0x6a09e667, b = 0xbb67ae85;
  for (let i = 0; i < bytes.length; i++) {
    const x = bytes[i];
    a = u32(Math.imul(u32(a ^ u32(x + i)), 0x9e3779b1));
    a = rotl32(a, 7);
    b = u32(Math.imul(u32(b + x + Math.imul(i + 1, 0x85ebca6b)), 0xc2b2ae35));
    b = rotl32(u32(b ^ a), 11);
  }
  a = u32(a ^ Math.imul(bytes.length, 0x9e3779b1));
  b = u32(b ^ Math.imul(bytes.length, 0x85ebca6b));
  for (let r = 0; r < 8; r++) {
    a = u32(rotl32(u32(a ^ b ^ bytes.length ^ r), 9) + 0x7f4a7c15);
    b = u32(rotl32(u32(b + a + Math.imul(r + 1, 0x27d4eb2d)), 13) ^ 0x165667b1);
  }
  return { a, b };
}
