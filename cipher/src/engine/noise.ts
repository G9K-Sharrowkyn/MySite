import { createDomainPRNG, shuffle } from './prng';
import { hex32 } from './uint';
import type { MessageSignature } from './types';

export interface NoisePlan { noiseCount: number; noisePositions: Uint8Array; noiseValues: Uint8Array }
export function noiseCountFor(password: string, signature: MessageSignature, plaintextLength: number): number {
  const rng = createDomainPRNG(password, `NOISE-V1:${hex32(signature.a)}:${hex32(signature.b)}:${plaintextLength}`);
  return rng.nextInt(Math.min(512, 32 + plaintextLength * 2) + 1);
}
export function buildNoisePlan(password: string, signature: MessageSignature, plaintextLength: number): NoisePlan {
  const rng = createDomainPRNG(password, `NOISE-V1:${hex32(signature.a)}:${hex32(signature.b)}:${plaintextLength}`);
  const noiseCount = rng.nextInt(Math.min(512, 32 + plaintextLength * 2) + 1);
  const totalLength = plaintextLength + noiseCount;
  const positions = shuffle(Array.from({ length: totalLength }, (_, i) => i), rng);
  const noisePositions = new Uint8Array(totalLength);
  for (let i = 0; i < noiseCount; i++) noisePositions[positions[i]] = 1;
  const noiseValues = new Uint8Array(totalLength);
  for (let i = 0; i < totalLength; i++) if (noisePositions[i]) noiseValues[i] = rng.nextByte();
  return { noiseCount, noisePositions, noiseValues };
}
export function mergeNoise(coreStream: Uint8Array, plan: NoisePlan): Uint8Array {
  if (coreStream.length + plan.noiseCount !== plan.noisePositions.length) throw new Error('Invalid noise plan');
  const mixed = new Uint8Array(plan.noisePositions.length);
  let dataIndex = 0;
  for (let i = 0; i < mixed.length; i++) mixed[i] = plan.noisePositions[i] ? plan.noiseValues[i] : coreStream[dataIndex++];
  return mixed;
}
export function extractCore(mixed: Uint8Array, plan: NoisePlan): Uint8Array {
  if (mixed.length !== plan.noisePositions.length) throw new Error('Invalid body length');
  const core = new Uint8Array(mixed.length - plan.noiseCount);
  let dataIndex = 0;
  for (let i = 0; i < mixed.length; i++) {
    // Noise is deterministic too: validate it before discarding, so corruption
    // cannot hide in a noise-only location (also important for empty plaintext).
    if (plan.noisePositions[i]) {
      if (mixed[i] !== plan.noiseValues[i]) throw new Error('Noise mismatch');
    } else core[dataIndex++] = mixed[i];
  }
  return core;
}
