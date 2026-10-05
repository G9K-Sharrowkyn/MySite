import { createDomainPRNG, shuffle } from './prng';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function passwordAlphabet(password: string): string {
  return shuffle(ALPHABET.split(''), createDomainPRNG(password, 'ALPHABET-V1')).join('');
}
export function encode(password: string, bytes: Uint8Array): string {
  const alphabet = passwordAlphabet(password);
  const output: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    output.push(alphabet[a >>> 2], alphabet[((a & 3) << 4) | (b >>> 4)]);
    if (i + 1 < bytes.length) output.push(alphabet[((b & 15) << 2) | (c >>> 6)]);
    if (i + 2 < bytes.length) output.push(alphabet[c & 63]);
  }
  return output.join('');
}
export function decode(password: string, ciphertext: string): Uint8Array {
  if (ciphertext.length % 4 === 1) throw new Error('Invalid ciphertext length');
  const alphabet = passwordAlphabet(password);
  const sextets = new Uint8Array(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    const index = alphabet.indexOf(ciphertext[i]);
    if (index === -1) throw new Error('Invalid ciphertext character');
    sextets[i] = index;
  }
  // Unused bits must be zero; reject alternate encodings of the same payload.
  if (sextets.length % 4 === 2 && (sextets[sextets.length - 1] & 15)) throw new Error('Invalid trailing bits');
  if (sextets.length % 4 === 3 && (sextets[sextets.length - 1] & 3)) throw new Error('Invalid trailing bits');
  const bytes = new Uint8Array(Math.floor(sextets.length * 3 / 4));
  let cursor = 0;
  for (let i = 0; i < sextets.length; i += 4) {
    const a = sextets[i], b = sextets[i + 1], c = sextets[i + 2] ?? 0, d = sextets[i + 3] ?? 0;
    bytes[cursor++] = (a << 2) | (b >>> 4);
    if (i + 2 < sextets.length) bytes[cursor++] = ((b & 15) << 4) | (c >>> 2);
    if (i + 3 < sextets.length) bytes[cursor++] = ((c & 3) << 6) | d;
  }
  return bytes;
}
