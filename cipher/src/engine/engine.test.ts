import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { u32, rotl32, byte } from './uint';
import { seedMixer } from './seedMixer';
import { SFC32, createDomainPRNG } from './prng';
import { checksum32 } from './checksum';
import { calculateMessageSignature } from './signature';
import { createRotors, rotorForward, rotorBackward, advanceRotor } from './rotor';
import { processCore, primeMachine, calculateChain, calculateTweaks, encryptByte, decryptByte } from './rotorMachine';
import { buildNoisePlan, mergeNoise, extractCore } from './noise';
import { buildRoundPlan, diffusion, inverseDiffusion, applyRound, undoRound } from './diffusion';
import { buildTicket, readTicket, scrambleTicket, unscrambleTicket } from './ticket';
import { encode, decode, passwordAlphabet } from './printableCodec';
import { encrypt } from './encrypt';
import { decrypt, INVALID_CIPHERTEXT } from './decrypt';
import { v1Vectors } from './v1-vectors';

const password = 'Klucz: Zażółć 🔐';
const utf8 = (text: string) => new TextEncoder().encode(text);
const sampleSignature = calculateMessageSignature(utf8('test wiadomości'));
const randomBytes = (length: number) => {
  const rng = new SFC32(1, 2, 3, 4);
  return Uint8Array.from({ length }, () => rng.nextByte());
};

describe('V1 primitives and domains', () => {
  it('uses unsigned 32-bit helpers, including zero/full rotation', () => {
    expect(u32(-1)).toBe(0xffffffff); expect(rotl32(0x12345678, 0)).toBe(0x12345678);
    expect(rotl32(0x12345678, 32)).toBe(0x12345678); expect(rotl32(0x80000000, 1)).toBe(1);
    expect(byte(-1)).toBe(255);
  });
  it('mixes all bytes and separates all domains', () => {
    expect(seedMixer(utf8('a'))).not.toEqual(seedMixer(utf8('b')));
    const domains = ['ROTORS-V1', 'TICKET-V1', 'ALPHABET-V1'];
    expect(new Set(domains.map(domain => createDomainPRNG(password, domain).nextU32())).size).toBe(3);
    expect(() => createDomainPRNG(password, 'ROTORS-V1').nextInt(0)).toThrow();
    expect(checksum32(new Uint8Array())).toBe(0x811c9dc5);
  });
});

describe('32 real, dynamic rotors', () => {
  it('inverts all 256 values for every rotor before and after mutations', () => {
    const rotors = createRotors(password);
    expect(rotors).toHaveLength(32);
    primeMachine(rotors, sampleSignature);
    expect(rotors.reduce((sum, rotor) => sum + rotor.mutations, 0)).toBe(8);
    for (const rotor of rotors) {
      expect(new Set(rotor.wiring).size).toBe(256);
      expect(rotor.step & 1).toBe(1);
      for (let x = 0; x < 256; x++) expect(rotorBackward(rotor, rotorForward(rotor, x))).toBe(x);
    }
    const processed = processCore(password, randomBytes(10000), sampleSignature);
    expect(processed.rotors.reduce((sum, rotor) => sum + rotor.mutations, 0)).toBeGreaterThan(8);
    for (const rotor of processed.rotors) for (let x = 0; x < 256; x++) expect(rotorBackward(rotor, rotorForward(rotor, x))).toBe(x);
    expect(processed.rotors.every(rotor => rotor.totalSteps > 0)).toBe(true);
  });
  it('counts negative and positive zero crossings exactly', () => {
    const rotor = createRotors(password)[0];
    Object.assign(rotor, { position: 2, step: 3, direction: -1, totalSteps: 0 });
    expect(advanceRotor(rotor, 2)).toBe(1); expect(rotor.position).toBe(252); expect(rotor.totalSteps).toBe(6);
    Object.assign(rotor, { position: 255, step: 255, direction: 1 });
    expect(advanceRotor(rotor, 4)).toBe(4); expect(rotor.position).toBe(251);
  });
  it('inverts a six-rotor byte chain with repeated rotor indices', () => {
    const rotors = createRotors(password);
    const chain: [number, number, number, number, number, number] = [7, 7, 7, 7, 7, 7];
    const tweaks = { t0: 255, t1: 213, t2: 101 };
    for (let x = 0; x < 256; x++) expect(decryptByte(encryptByte(x, rotors, chain, tweaks), rotors, chain, tweaks)).toBe(x);
    expect(calculateChain(0, sampleSignature, rotors)).toHaveLength(6);
    expect(Object.keys(calculateTweaks(0, sampleSignature, rotors))).toEqual(['t0', 't1', 't2']);
  });
  it.each([0, 1, 2, 255, 1000, 10000])('round-trips core bytes and identical machine states, length %i', length => {
    const bytes = randomBytes(length);
    const signature = calculateMessageSignature(bytes);
    const forward = processCore(password, bytes, signature);
    const backward = processCore(password, forward.output, signature, true);
    expect(forward.output.length).toBe(bytes.length);
    expect(backward.output).toEqual(bytes); expect(backward.rotors).toEqual(forward.rotors);
    expect(backward.diagnostic).toEqual(forward.diagnostic);
  });
});

describe('noise inside body', () => {
  it.each([0, 1, 10, 255, 512, 1000])('merges and extracts a deterministic plan, length %i', length => {
    const bytes = randomBytes(length);
    const plan = buildNoisePlan(password, sampleSignature, length);
    expect(plan).toEqual(buildNoisePlan(password, sampleSignature, length));
    const mixed = mergeNoise(bytes, plan);
    expect(mixed.length).toBe(length + plan.noiseCount);
    expect(extractCore(mixed, plan)).toEqual(bytes);
    const noiseIndex = plan.noisePositions.findIndex(value => value === 1);
    if (noiseIndex !== -1) { mixed[noiseIndex] ^= 1; expect(() => extractCore(mixed, plan)).toThrow('Noise mismatch'); }
  });
});

describe('five diffusion rounds', () => {
  it.each([0, 1, 2, 3, 4, 5, 16, 64, 255, 512])('inverts every round and the complete cascade, length %i', length => {
    const bytes = randomBytes(length);
    for (let round = 0; round < 5; round++) {
      const plan = buildRoundPlan(password, sampleSignature, length, length, round);
      expect(new Set(plan.bytePermutation).size).toBe(256);
      expect(new Set(plan.indexPermutation).size).toBe(length);
      expect(undoRound(applyRound(bytes, plan), plan)).toEqual(bytes);
    }
    expect(inverseDiffusion(password, diffusion(password, bytes, sampleSignature, length), sampleSignature, length)).toEqual(bytes);
  });
});

describe('24-byte bootstrap ticket', () => {
  it('has exact magic, offsets, little endian fields, flags and guard', () => {
    const signature = { a: 0x12345678, b: 0x9abcdef0 };
    const ticket = buildTicket(0x01020304, signature, 0x87654321);
    expect(Array.from(ticket.slice(0, 10))).toEqual([0x55, 0x45, 0x4e, 0x31, 1, 0, 4, 3, 2, 1]);
    expect(readTicket(ticket)).toEqual({ plaintextLength: 0x01020304, signature, checksum: 0x87654321 });
    expect(unscrambleTicket(password, scrambleTicket(password, ticket))).toEqual(ticket);
    ticket[22] ^= 1; expect(() => readTicket(ticket)).toThrow('Invalid guard');
  });
});

describe('custom printable codec', () => {
  it.each(Array.from({ length: 1025 }, (_, i) => i))('round-trips byte length %i without padding', length => {
    const bytes = randomBytes(length);
    const encoded = encode(password, bytes);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
    expect(encoded.length).toBe(Math.ceil(bytes.length * 4 / 3));
    expect(decode(password, encoded)).toEqual(bytes);
  });
  it('rejects invalid length, characters and nonzero unused trailing bits', () => {
    expect(() => decode(password, 'a')).toThrow('Invalid ciphertext length');
    expect(() => decode(password, '===')).toThrow();
    const alphabet = passwordAlphabet(password);
    expect(() => decode(password, alphabet[0] + alphabet[1])).toThrow('Invalid trailing bits');
    expect(() => decode(password, alphabet[0] + alphabet[0] + alphabet[1])).toThrow('Invalid trailing bits');
  });
});

describe('complete Ultra Enigma V1', () => {
  it.each(v1Vectors)('matches the independent V1 forward fixture for $plaintext', vector => {
    const result = encrypt(vector.password, vector.plaintext);
    expect(result.ciphertext).toBe(vector.ciphertext);
    expect(result.signatureA).toBe(vector.signatureA);
    expect(result.signatureB).toBe(vector.signatureB);
    expect(result.checksum).toBe(vector.checksum);
    expect(result.noiseBytes).toBe(vector.noiseBytes);
    expect(result.rotorStates.map(rotor => rotor.position)).toEqual(vector.positions);
    expect(result.rotorStates.map(rotor => rotor.direction)).toEqual(vector.directions);
    expect(result.rotorStates.map(rotor => rotor.mutations)).toEqual(vector.mutations);
    expect(result.rotorStates.map(rotor => rotor.totalSteps)).toEqual(vector.steps);
    expect(result.rotorStates.map(rotor => checksum32(rotor.wiring))).toEqual(vector.wiringChecksums);
    expect(decrypt(vector.password, vector.ciphertext).plaintext).toBe(vector.plaintext);
  });
  const texts = ['', 'a', 'A', 'Hello', 'Zażółć gęślą jaźń', '🙂', '🙂🙂🙂', '漢字', '\n', '\n\n\n', 'tekst\nw kilku\nakapitach', '\t\0\r\n', '\uFEFFtekst'];
  it.each(texts)('preserves Unicode and exact whitespace: %j', text => {
    const encrypted = encrypt(password, text);
    const decrypted = decrypt(password, encrypted.ciphertext);
    expect(decrypted.plaintext).toBe(text);
    expect(decrypted.rotorStates).toEqual(encrypted.rotorStates);
    expect(decrypted.diagnostic).toEqual(encrypted.diagnostic);
    expect(encrypted.finalBinaryBytes).toBe(24 + encrypted.plaintextBytes + encrypted.noiseBytes);
    expect(encrypted.ciphertext.length).toBe(Math.ceil(encrypted.finalBinaryBytes * 4 / 3));
  });
  it.each([1, 10, 100, 1000, 10000])('round-trips text length %i', length => {
    const text = 'A'.repeat(length);
    expect(decrypt(password, encrypt(password, text).ciphertext).plaintext).toBe(text);
  });
  it('changes with the password and is deterministic across 100 runs', () => {
    const text = 'To jest tajna wiadomość.';
    expect(encrypt('password1', text).ciphertext).not.toBe(encrypt('password2', text).ciphertext);
    const expected = encrypt(password, text);
    for (let i = 0; i < 100; i++) expect(encrypt(password, text)).toEqual(expected);
  });
  it('rebuilds the entire message, without a long shared ciphertext prefix', () => {
    const a = encrypt(password, 'To jest tajna wiadomość.');
    const b = encrypt(password, 'To jest tajna wiadomość!');
    expect(a.signatureA + ':' + a.signatureB).not.toBe(b.signatureA + ':' + b.signatureB);
    let prefix = 0;
    while (a.ciphertext[prefix] === b.ciphertext[prefix] && prefix < Math.min(a.ciphertext.length, b.ciphertext.length)) prefix++;
    expect(prefix).toBeLessThan(4);
  });
  it('has required nonmonotonic ciphertext length through 500 A messages', () => {
    const lengths = Array.from({ length: 500 }, (_, i) => encrypt(password, 'A'.repeat(i + 1)).ciphertext.length);
    mkdirSync(new URL('../../.local/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../../.local/ciphertext-lengths-v1.json', import.meta.url), JSON.stringify(lengths.map((ciphertextLength, i) => ({ plaintextLength: i + 1, ciphertextLength })), null, 2));
    expect(lengths.some((length, i) => i > 0 && length < lengths[i - 1])).toBe(true);
  });
  it('rejects empty passwords, permits empty plaintext, and rejects the wrong password', () => {
    expect(() => encrypt('', 'test')).toThrow('Hasło nie może być puste.');
    expect(() => decrypt('', 'abc')).toThrow('Hasło nie może być puste.');
    expect(() => decrypt('abd', encrypt('abc', 'test').ciphertext)).toThrow(INVALID_CIPHERTEXT);
    expect(() => decrypt('abc', '')).toThrow(INVALID_CIPHERTEXT);
  });
  it('rejects EVERY single-character edit, including final unused bits and noise-only bodies', () => {
    for (const text of ['', 'test', 'Zażółć 🙂']) {
      const ciphertext = encrypt('abc', text).ciphertext;
      for (let i = 0; i < ciphertext.length; i++) {
        const changed = ciphertext.slice(0, i) + (ciphertext[i] === 'A' ? 'B' : 'A') + ciphertext.slice(i + 1);
        expect(() => decrypt('abc', changed)).toThrow(INVALID_CIPHERTEXT);
      }
    }
  });
  it('rejects every single-byte edit to the binary payload and oversized ticket claims', () => {
    const encoded = encrypt('abc', 'test').ciphertext;
    const payload = decode('abc', encoded);
    for (let i = 0; i < payload.length; i++) {
      const mutated = payload.slice(); mutated[i] ^= 1;
      expect(() => decrypt('abc', encode('abc', mutated))).toThrow(INVALID_CIPHERTEXT);
    }
    payload.set(scrambleTicket('abc', buildTicket(0xffffffff, sampleSignature, 0)));
    expect(() => decrypt('abc', encode('abc', payload))).toThrow(INVALID_CIPHERTEXT);
  });
});
