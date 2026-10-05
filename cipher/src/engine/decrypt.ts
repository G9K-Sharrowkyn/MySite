import { decode } from './printableCodec';
import { readTicket, unscrambleTicket, TICKET_LENGTH } from './ticket';
import { noiseCountFor, buildNoisePlan, extractCore } from './noise';
import { inverseDiffusion } from './diffusion';
import { processCore } from './rotorMachine';
import { calculateMessageSignature } from './signature';
import { checksum32 } from './checksum';
import { publicRotorStates } from './rotor';
import type { DecryptionResult } from './types';

export const INVALID_CIPHERTEXT = 'Nieprawidłowe hasło lub uszkodzony szyfrogram.';
export class DecryptionError extends Error {
  readonly detail: string;
  constructor(detail: string) { super(INVALID_CIPHERTEXT); this.name = 'DecryptionError'; this.detail = detail; }
}
export function decrypt(password: string, ciphertext: string): DecryptionResult {
  if (password === '') throw new Error('Hasło nie może być puste.');
  try {
    const payload = decode(password, ciphertext);
    if (payload.length < TICKET_LENGTH) throw new Error('Missing bootstrap ticket');
    const ticket = readTicket(unscrambleTicket(password, payload.subarray(0, TICKET_LENGTH)));
    const { plaintextLength, signature, checksum } = ticket;
    const encryptedBody = payload.subarray(TICKET_LENGTH);
    // Check the advertised length before allocating a potentially huge noise plan.
    const noiseCount = noiseCountFor(password, signature, plaintextLength);
    if (encryptedBody.length !== plaintextLength + noiseCount) throw new Error('Body length mismatch');
    const noise = buildNoisePlan(password, signature, plaintextLength);
    const mixed = inverseDiffusion(password, encryptedBody, signature, plaintextLength);
    const coreStream = extractCore(mixed, noise);
    if (coreStream.length !== plaintextLength) throw new Error('Core length mismatch');
    const recovered = processCore(password, coreStream, signature, true);
    if (checksum32(recovered.output) !== checksum) throw new Error('Checksum mismatch');
    const actualSignature = calculateMessageSignature(recovered.output);
    if (actualSignature.a !== signature.a || actualSignature.b !== signature.b) throw new Error('Signature mismatch');
    // Preserve a leading U+FEFF too; the default decoder strips the UTF-8 BOM.
    const plaintext = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(recovered.output);
    return {
      plaintext, ciphertext, plaintextCharacters: plaintext.length, plaintextBytes: plaintextLength,
      bodyBytes: encryptedBody.length, noiseBytes: noiseCount, finalBinaryBytes: payload.length,
      signatureA: signature.a, signatureB: signature.b, checksum,
      rotorStates: publicRotorStates(recovered.rotors),
      totalMutations: recovered.rotors.reduce((sum, rotor) => sum + rotor.mutations, 0), diagnostic: recovered.diagnostic,
    };
  } catch (error) {
    throw new DecryptionError(error instanceof Error ? error.message : 'Invalid ciphertext');
  }
}
