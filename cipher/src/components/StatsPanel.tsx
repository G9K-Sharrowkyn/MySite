import type { EncryptionResult } from '../engine/types';
export function StatsPanel({ result }: { result?: EncryptionResult }) {
  const metrics = [['PLAINTEXT CHARACTERS', result?.plaintextCharacters], ['PLAINTEXT BYTES', result?.plaintextBytes], ['CORE BYTES', result?.plaintextBytes], ['NOISE BYTES', result?.noiseBytes], ['BODY BYTES', result?.bodyBytes], ['FINAL BINARY BYTES', result?.finalBinaryBytes], ['CIPHERTEXT CHARACTERS', result?.ciphertext.length], ['ROTOR MUTATIONS', result?.totalMutations]] as const;
  return <section className="stats-panel" aria-label="Machine statistics">{metrics.map(([label, value]) => <div className="stat" key={label}><span>{label}</span><strong data-stat={label}>{value === undefined ? '—' : value.toLocaleString('en-US')}</strong></div>)}</section>;
}
