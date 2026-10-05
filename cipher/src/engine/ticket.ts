import { createDomainPRNG, shuffle } from './prng';
import type { MessageSignature } from './types';

export const TICKET_LENGTH = 24;
export function buildTicket(plaintextLength: number, signature: MessageSignature, checksum: number): Uint8Array {
  const ticket = new Uint8Array(TICKET_LENGTH);
  ticket.set([0x55, 0x45, 0x4e, 0x31, 1, 0]);
  const view = new DataView(ticket.buffer);
  view.setUint32(6, plaintextLength, true);
  view.setUint32(10, signature.a, true); view.setUint32(14, signature.b, true);
  view.setUint32(18, checksum, true);
  view.setUint16(22, (plaintextLength ^ signature.a ^ signature.b ^ checksum) & 0xffff, true);
  return ticket;
}
export function readTicket(ticket: Uint8Array) {
  if (ticket.length !== TICKET_LENGTH) throw new Error('Invalid ticket length');
  if (ticket[0] !== 0x55 || ticket[1] !== 0x45 || ticket[2] !== 0x4e || ticket[3] !== 0x31) throw new Error('Invalid magic');
  if (ticket[4] !== 1) throw new Error('Invalid version');
  if (ticket[5] !== 0) throw new Error('Invalid flags');
  const view = new DataView(ticket.buffer, ticket.byteOffset, ticket.byteLength);
  const plaintextLength = view.getUint32(6, true);
  const signature = { a: view.getUint32(10, true), b: view.getUint32(14, true) };
  const checksum = view.getUint32(18, true);
  if (view.getUint16(22, true) !== ((plaintextLength ^ signature.a ^ signature.b ^ checksum) & 0xffff)) throw new Error('Invalid guard');
  return { plaintextLength, signature, checksum };
}
function ticketPlan(password: string) {
  const rng = createDomainPRNG(password, 'TICKET-V1');
  const mask = Uint8Array.from({ length: TICKET_LENGTH }, () => rng.nextByte());
  const permutation = shuffle(Array.from({ length: TICKET_LENGTH }, (_, i) => i), rng);
  return { mask, permutation };
}
export function scrambleTicket(password: string, ticket: Uint8Array): Uint8Array {
  if (ticket.length !== TICKET_LENGTH) throw new Error('Invalid ticket length');
  const { mask, permutation } = ticketPlan(password);
  const output = new Uint8Array(TICKET_LENGTH);
  for (let i = 0; i < TICKET_LENGTH; i++) output[permutation[i]] = ticket[i] ^ mask[i];
  return output;
}
export function unscrambleTicket(password: string, ticket: Uint8Array): Uint8Array {
  if (ticket.length !== TICKET_LENGTH) throw new Error('Invalid ticket length');
  const { mask, permutation } = ticketPlan(password);
  const output = new Uint8Array(TICKET_LENGTH);
  for (let i = 0; i < TICKET_LENGTH; i++) output[i] = ticket[permutation[i]] ^ mask[i];
  return output;
}
