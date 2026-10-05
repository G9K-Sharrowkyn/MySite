import { createDomainPRNG, shuffle } from './prng';
import { hex32 } from './uint';
import type { MessageSignature, RoundPlan } from './types';

export function buildRoundPlan(password: string, signature: MessageSignature, plaintextLength: number, bufferLength: number, round: number): RoundPlan {
  const rng = createDomainPRNG(password, `DIFF-V1:${hex32(signature.a)}:${hex32(signature.b)}:${plaintextLength}:${bufferLength}:${round}`);
  const bytePermutation = shuffle(Uint8Array.from({ length: 256 }, (_, i) => i), rng);
  const inverseBytePermutation = new Uint8Array(256);
  for (let i = 0; i < 256; i++) inverseBytePermutation[bytePermutation[i]] = i;
  const mask = Uint8Array.from({ length: bufferLength }, () => rng.nextByte());
  const forwardConstant = rng.nextByte();
  const backwardConstant = rng.nextByte();
  const rotateBy = bufferLength === 0 ? 0 : rng.nextInt(bufferLength);
  let reverseStart = 0, reverseEnd = 0;
  if (bufferLength >= 2) {
    const a = rng.nextInt(bufferLength), b = rng.nextInt(bufferLength);
    reverseStart = Math.min(a, b); reverseEnd = Math.max(a, b);
  }
  let blockLength = 0, blockStartA = 0, blockStartB = 0;
  if (bufferLength >= 4) {
    const half = Math.floor(bufferLength / 2);
    blockLength = 1 + rng.nextInt(Math.min(16, half));
    blockStartA = rng.nextInt(half - blockLength + 1);
    blockStartB = half + rng.nextInt(bufferLength - half - blockLength + 1);
  }
  const indexPermutation = shuffle(Array.from({ length: bufferLength }, (_, i) => i), rng);
  return { bytePermutation, inverseBytePermutation, mask, forwardConstant, backwardConstant, rotateBy, reverseStart, reverseEnd, blockLength, blockStartA, blockStartB, indexPermutation };
}
function rotateLeft(buffer: Uint8Array, amount: number): Uint8Array {
  if (!buffer.length) return buffer;
  const output = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) output[i] = buffer[(i + amount) % buffer.length];
  return output;
}
function reverseSegment(buffer: Uint8Array, plan: RoundPlan): void {
  buffer.subarray(plan.reverseStart, plan.reverseEnd + 1).reverse();
}
function swapBlocks(buffer: Uint8Array, plan: RoundPlan): void {
  for (let i = 0; i < plan.blockLength; i++) {
    const a = plan.blockStartA + i, b = plan.blockStartB + i;
    [buffer[a], buffer[b]] = [buffer[b], buffer[a]];
  }
}
export function applyRound(bytes: Uint8Array, plan: RoundPlan): Uint8Array {
  let buffer: Uint8Array = bytes.slice();
  for (let i = 0; i < buffer.length; i++) buffer[i] = plan.bytePermutation[buffer[i]];
  for (let i = 0; i < buffer.length; i++) buffer[i] = (buffer[i] + plan.mask[i]) & 0xff;
  for (let i = 1; i < buffer.length; i++) buffer[i] = (buffer[i] + buffer[i - 1] + plan.forwardConstant) & 0xff;
  for (let i = buffer.length - 2; i >= 0; i--) buffer[i] = (buffer[i] + buffer[i + 1] + plan.backwardConstant) & 0xff;
  buffer = rotateLeft(buffer, plan.rotateBy);
  reverseSegment(buffer, plan); swapBlocks(buffer, plan);
  const output = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) output[plan.indexPermutation[i]] = buffer[i];
  return output;
}
export function undoRound(bytes: Uint8Array, plan: RoundPlan): Uint8Array {
  let buffer: Uint8Array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes[plan.indexPermutation[i]];
  swapBlocks(buffer, plan); reverseSegment(buffer, plan);
  buffer = rotateLeft(buffer, buffer.length ? (buffer.length - plan.rotateBy) % buffer.length : 0);
  for (let i = 0; i < buffer.length - 1; i++) buffer[i] = (buffer[i] - buffer[i + 1] - plan.backwardConstant) & 0xff;
  for (let i = buffer.length - 1; i >= 1; i--) buffer[i] = (buffer[i] - buffer[i - 1] - plan.forwardConstant) & 0xff;
  for (let i = 0; i < buffer.length; i++) buffer[i] = (buffer[i] - plan.mask[i]) & 0xff;
  for (let i = 0; i < buffer.length; i++) buffer[i] = plan.inverseBytePermutation[buffer[i]];
  return buffer;
}
export function diffusion(password: string, bytes: Uint8Array, signature: MessageSignature, plaintextLength: number): Uint8Array {
  let buffer: Uint8Array = bytes.slice();
  for (let round = 0; round < 5; round++) buffer = applyRound(buffer, buildRoundPlan(password, signature, plaintextLength, bytes.length, round));
  return buffer;
}
export function inverseDiffusion(password: string, bytes: Uint8Array, signature: MessageSignature, plaintextLength: number): Uint8Array {
  const plans = Array.from({ length: 5 }, (_, round) => buildRoundPlan(password, signature, plaintextLength, bytes.length, round));
  let buffer: Uint8Array = bytes.slice();
  for (let round = 4; round >= 0; round--) buffer = undoRound(buffer, plans[round]);
  return buffer;
}
