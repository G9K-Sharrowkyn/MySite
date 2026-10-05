import { calculateMessageSignature } from './signature';
import { checksum32 } from './checksum';
import { processCore } from './rotorMachine';
import { buildNoisePlan, mergeNoise } from './noise';
import { diffusion } from './diffusion';
import { buildTicket, scrambleTicket, TICKET_LENGTH } from './ticket';
import { encode } from './printableCodec';
import { publicRotorStates } from './rotor';
import type { EncryptionResult } from './types';

export function encrypt(password: string, plaintext: string): EncryptionResult {
  if (password === '') throw new Error('Hasło nie może być puste.');
  const bytes = new TextEncoder().encode(plaintext);
  const signature = calculateMessageSignature(bytes);
  const checksum = checksum32(bytes);
  const core = processCore(password, bytes, signature);
  const noise = buildNoisePlan(password, signature, bytes.length);
  const mixed = mergeNoise(core.output, noise);
  const body = diffusion(password, mixed, signature, bytes.length);
  const ticket = scrambleTicket(password, buildTicket(bytes.length, signature, checksum));
  const payload = new Uint8Array(TICKET_LENGTH + body.length);
  payload.set(ticket); payload.set(body, TICKET_LENGTH);
  return {
    ciphertext: encode(password, payload), plaintextCharacters: plaintext.length, plaintextBytes: bytes.length,
    bodyBytes: body.length, noiseBytes: noise.noiseCount, finalBinaryBytes: payload.length,
    signatureA: signature.a, signatureB: signature.b, checksum,
    rotorStates: publicRotorStates(core.rotors),
    totalMutations: core.rotors.reduce((sum, rotor) => sum + rotor.mutations, 0), diagnostic: core.diagnostic,
  };
}
