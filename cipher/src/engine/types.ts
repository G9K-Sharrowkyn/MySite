export interface MessageSignature { a: number; b: number }
export interface Rotor {
  wiring: Uint8Array; inverseWiring: Uint8Array;
  position: number; step: number; direction: 1 | -1; mutations: number; totalSteps: number;
}
export interface RotorPublicState extends Rotor { index: number; role: string }
export type Chain = [number, number, number, number, number, number];
export interface Tweaks { t0: number; t1: number; t2: number }
export interface EncryptionDiagnostic extends Tweaks {
  chain: Chain; inputByte: number; coreOutputByte: number;
}
export interface EncryptionResult {
  ciphertext: string; plaintextCharacters: number; plaintextBytes: number;
  bodyBytes: number; noiseBytes: number; finalBinaryBytes: number;
  signatureA: number; signatureB: number; checksum: number;
  rotorStates: RotorPublicState[]; totalMutations: number;
  diagnostic: EncryptionDiagnostic | null;
}
export interface DecryptionResult extends EncryptionResult { plaintext: string }
export interface RoundPlan {
  bytePermutation: Uint8Array; inverseBytePermutation: Uint8Array; mask: Uint8Array;
  forwardConstant: number; backwardConstant: number; rotateBy: number;
  reverseStart: number; reverseEnd: number;
  blockLength: number; blockStartA: number; blockStartB: number;
  indexPermutation: number[];
}
