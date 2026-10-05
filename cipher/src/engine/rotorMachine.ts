import type { Rotor, MessageSignature, Chain, Tweaks, EncryptionDiagnostic } from './types';
import { advanceRotor, rebuildInverse, rotorForward, rotorBackward, createRotors } from './rotor';

export function primeMachine(rotors: Rotor[], signature: MessageSignature): void {
  const sig = new Uint8Array(8);
  const view = new DataView(sig.buffer);
  view.setUint32(0, signature.a, true); view.setUint32(4, signature.b, true);
  for (let j = 0; j < 8; j++) {
    const x = sig[j];
    for (let t = 0; t < 4; t++) advanceRotor(rotors[(x + j * 7 + t * 11) & 31], 1 + (x + t * 37 + j * 13) % 17);
    const target = (x + j * 9 + rotors[28].position + rotors[29].position) & 31;
    const p = (x + j * 31 + rotors[30].position) & 0xff;
    let q = (p + 1 + (x ^ rotors[31].position ^ (j * 17)) % 255) & 0xff;
    if (q === p) q = (q + 1) & 0xff;
    swapWiring(rotors[target], p, q);
  }
}
function swapWiring(rotor: Rotor, p: number, q: number): void {
  [rotor.wiring[p], rotor.wiring[q]] = [rotor.wiring[q], rotor.wiring[p]];
  rebuildInverse(rotor); rotor.mutations++;
}
export function calculateChain(index: number, signature: MessageSignature, rotors: Rotor[]): Chain {
  const r0 = (index + rotors[31].position + (signature.a & 31)) & 31;
  const r1 = (r0 + 1 + rotors[16].position % 31) & 31;
  const r2 = (r1 + 1 + rotors[17].position % 31) & 31;
  const r3 = (r2 + 1 + rotors[18].position % 31) & 31;
  const r4 = (r3 + 1 + rotors[19].position % 31) & 31;
  const r5 = (r4 + 1 + rotors[20].position % 31) & 31;
  return [r0, r1, r2, r3, r4, r5];
}
export function calculateTweaks(index: number, signature: MessageSignature, rotors: Rotor[]): Tweaks {
  const sigByteA = (signature.a >>> ((index & 3) * 8)) & 0xff;
  const sigByteB = (signature.b >>> (((index + 1) & 3) * 8)) & 0xff;
  return {
    t0: (rotors[21].position + index + sigByteA) & 0xff,
    t1: (rotors[22].position ^ rotors[23].position ^ sigByteB) & 0xff,
    t2: (rotors[30].position + rotors[31].position + index * 17) & 0xff,
  };
}
export function encryptByte(value: number, rotors: Rotor[], chain: Chain, { t0, t1, t2 }: Tweaks): number {
  const [r0, r1, r2, r3, r4, r5] = chain;
  let x = value ^ t0;
  x = rotorForward(rotors[r0], x);
  x = (x + t1) & 0xff;
  x = rotorForward(rotors[r1], x);
  x ^= t2;
  x = rotorBackward(rotors[r2], x);
  x = (x + rotors[24].position) & 0xff;
  x = rotorForward(rotors[r3], x);
  x ^= rotors[25].position;
  x = rotorBackward(rotors[r4], x);
  x = (x + rotors[26].position + rotors[27].position) & 0xff;
  return rotorForward(rotors[r5], x) & 0xff;
}
export function decryptByte(value: number, rotors: Rotor[], chain: Chain, { t0, t1, t2 }: Tweaks): number {
  const [r0, r1, r2, r3, r4, r5] = chain;
  let x = rotorBackward(rotors[r5], value);
  x = (x - rotors[26].position - rotors[27].position) & 0xff;
  x = rotorForward(rotors[r4], x);
  x ^= rotors[25].position;
  x = rotorBackward(rotors[r3], x);
  x = (x - rotors[24].position) & 0xff;
  x = rotorForward(rotors[r2], x);
  x ^= t2;
  x = rotorBackward(rotors[r1], x);
  x = (x - t1) & 0xff;
  x = rotorBackward(rotors[r0], x);
  return (x ^ t0) & 0xff;
}
export function advanceMachine(rotors: Rotor[], cipherByte: number, index: number, chain: Chain): void {
  const [r0, r1, r2, r3, , r5] = chain;
  const moves = [
    [r0, 1 + (cipherByte & 3)], [r1, 1 + ((cipherByte >>> 2) & 3)],
    [r2, 1 + ((cipherByte >>> 4) & 3)], [r5, 1 + ((cipherByte >>> 6) & 3)],
    [31, 1 + cipherByte % 5], [16 + ((cipherByte + index) & 7), 1 + ((cipherByte ^ index) & 3)],
  ];
  // Complete the six primary moves, then apply their one-level cascades in the same order.
  const cascades = moves.map(([source, amount]) => [source, advanceRotor(rotors[source], amount)]);
  for (const [source, wraps] of cascades) if (wraps > 0) advanceRotor(rotors[(source * 7 + 11) & 31], wraps);
  if (cipherByte & 1) rotors[r3].direction = rotors[r3].direction === 1 ? -1 : 1;
  if (cipherByte & 2) rotors[28].direction = rotors[28].direction === 1 ? -1 : 1;
  if (cipherByte & 4) rotors[29].direction = rotors[29].direction === 1 ? -1 : 1;
  const gate = (cipherByte + index + rotors[28].position + rotors[29].position + rotors[31].position) & 31;
  if (gate === 0) {
    const target = (cipherByte + index + rotors[30].position) & 31;
    const p = (cipherByte + rotors[28].position + index * 13) & 0xff;
    let q = (p + 1 + (rotors[29].position + rotors[31].position + index * 7) % 255) & 0xff;
    if (q === p) q = (q + 1) & 0xff;
    swapWiring(rotors[target], p, q);
  } else if (gate === 1) {
    const target = (cipherByte + rotors[29].position + index * 3) & 31;
    const length = 4 + ((rotors[28].position + rotors[31].position + cipherByte) & 15);
    const start = (cipherByte + rotors[30].position + index) % (256 - length + 1);
    rotors[target].wiring.subarray(start, start + length).reverse();
    rebuildInverse(rotors[target]); rotors[target].mutations++;
  }
}
export function processCore(password: string, bytes: Uint8Array, signature: MessageSignature, decrypting = false) {
  const rotors = createRotors(password);
  primeMachine(rotors, signature);
  const output = new Uint8Array(bytes.length);
  let diagnostic: EncryptionDiagnostic | null = null;
  for (let index = 0; index < bytes.length; index++) {
    const chain = calculateChain(index, signature, rotors);
    const tweaks = calculateTweaks(index, signature, rotors);
    const transformed = decrypting ? decryptByte(bytes[index], rotors, chain, tweaks) : encryptByte(bytes[index], rotors, chain, tweaks);
    output[index] = transformed;
    const cipherByte = decrypting ? bytes[index] : transformed;
    diagnostic = { chain, ...tweaks, inputByte: decrypting ? transformed : bytes[index], coreOutputByte: cipherByte };
    advanceMachine(rotors, cipherByte, index, chain);
  }
  return { output, rotors, diagnostic };
}
