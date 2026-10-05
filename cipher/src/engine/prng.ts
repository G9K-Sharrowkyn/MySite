import { u32, rotl32 } from './uint';
import { seedMixer } from './seedMixer';

export class SFC32 {
  private a: number; private b: number; private c: number; private d: number;
  constructor(a: number, b: number, c: number, d: number) {
    this.a = a >>> 0; this.b = b >>> 0; this.c = c >>> 0; this.d = d >>> 0;
    for (let i = 0; i < 20; i++) this.nextU32();
  }
  nextU32(): number {
    let t = u32(this.a + this.b);
    this.a = u32(this.b ^ (this.b >>> 9));
    this.b = u32(this.c + (this.c << 3));
    this.c = rotl32(this.c, 21);
    this.d = u32(this.d + 1);
    t = u32(t + this.d);
    this.c = u32(this.c + t);
    return t;
  }
  nextByte(): number { return this.nextU32() & 0xff; }
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error('maxExclusive must be positive');
    return this.nextU32() % maxExclusive;
  }
}
export function createDomainPRNG(password: string, domain: string): SFC32 {
  return new SFC32(...seedMixer(new TextEncoder().encode(password + '\0' + domain)));
}
export function shuffle<T extends number[] | Uint8Array | string[]>(values: T, rng: SFC32): T {
  for (let i = values.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}
