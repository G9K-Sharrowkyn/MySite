import { createDomainPRNG, shuffle } from './prng';
import type { Rotor, RotorPublicState } from './types';

export function rebuildInverse(rotor: Rotor): void {
  for (let i = 0; i < 256; i++) rotor.inverseWiring[rotor.wiring[i]] = i;
}
export function createRotors(password: string): Rotor[] {
  const rng = createDomainPRNG(password, 'ROTORS-V1');
  return Array.from({ length: 32 }, () => {
    const wiring = shuffle(Uint8Array.from({ length: 256 }, (_, i) => i), rng);
    const rotor: Rotor = {
      wiring, inverseWiring: new Uint8Array(256), position: rng.nextByte(),
      step: ((rng.nextByte() & 0x7f) << 1) | 1,
      direction: (rng.nextU32() & 1) ? 1 : -1, mutations: 0, totalSteps: 0,
    };
    rebuildInverse(rotor);
    return rotor;
  });
}
export function rotorForward(rotor: Rotor, value: number): number {
  return (rotor.wiring[(value + rotor.position) & 0xff] - rotor.position) & 0xff;
}
export function rotorBackward(rotor: Rotor, value: number): number {
  return (rotor.inverseWiring[(value + rotor.position) & 0xff] - rotor.position) & 0xff;
}
export function advanceRotor(rotor: Rotor, amount: number): number {
  const signedMove = rotor.direction * rotor.step * amount;
  const raw = rotor.position + signedMove;
  rotor.position = ((raw % 256) + 256) % 256;
  rotor.totalSteps += Math.abs(signedMove);
  return raw >= 0 ? Math.floor(raw / 256) : Math.abs(Math.floor(raw / 256));
}
export function rotorRole(index: number): string {
  return index < 16 ? 'DATA' : index < 24 ? 'STATE' : index < 28 ? 'NOISE' : index < 30 ? 'MUTATION' : index === 30 ? 'PERMUTATION' : 'CONTROL';
}
export function publicRotorStates(rotors: Rotor[]): RotorPublicState[] {
  return rotors.map((rotor, index) => ({ ...rotor, wiring: rotor.wiring.slice(), inverseWiring: rotor.inverseWiring.slice(), index, role: rotorRole(index) }));
}
