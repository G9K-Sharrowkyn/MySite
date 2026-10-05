import { useEffect, useRef, useState } from 'react';
import { encrypt } from './engine/encrypt';
import { decrypt, DecryptionError } from './engine/decrypt';
import type { EncryptionResult } from './engine/types';
import { Header } from './components/Header';
import { KeyPanel } from './components/KeyPanel';
import { RotorGrid } from './components/RotorGrid';
import { Workspace } from './components/Workspace';
import type { Mode } from './components/Workspace';
import { StatsPanel } from './components/StatsPanel';
import { DiagnosticPanel } from './components/DiagnosticPanel';

interface Computation { result?: EncryptionResult; output: string; error: string; detail: string; busy: boolean }
const idle: Computation = { output: '', error: '', detail: '', busy: false };
export default function App() {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('encrypt');
  const [plaintextInput, setPlaintextInput] = useState('');
  const [ciphertextInput, setCiphertextInput] = useState('');
  const [computation, setComputation] = useState<Computation>(idle);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function calculate(nextPassword: string, text: string, nextMode: Mode) {
    clearTimeout(timer.current);
    if (nextPassword === '') { setComputation(idle); return; }
    function run() {
      try {
        if (nextMode === 'encrypt') {
          const result = encrypt(nextPassword, text);
          setComputation({ result, output: result.ciphertext, error: '', detail: '', busy: false });
        } else {
          const result = decrypt(nextPassword, text);
          setComputation({ result, output: result.plaintext, error: '', detail: '', busy: false });
        }
      } catch (error) {
        setComputation({ output: '', error: error instanceof Error ? error.message : 'Błąd przetwarzania.', detail: error instanceof DecryptionError ? error.detail : '', busy: false });
      }
    }
    // Only UI scheduling changes for large inputs; each run reconstructs V1.
    if (text.length > 16384) { setComputation({ ...idle, busy: true }); timer.current = setTimeout(run, 50); }
    else run();
  }
  function changePassword(value: string) { setPassword(value); calculate(value, mode === 'encrypt' ? plaintextInput : ciphertextInput, mode); }
  function changeInput(value: string) {
    if (mode === 'encrypt') setPlaintextInput(value); else setCiphertextInput(value);
    calculate(password, value, mode);
  }
  function changeMode(nextMode: Mode) {
    if (nextMode === mode) return;
    let text = nextMode === 'encrypt' ? plaintextInput : ciphertextInput;
    // First DECRYPT switch loads the generated ciphertext for immediate checking.
    if (nextMode === 'decrypt' && !text && computation.result) { text = computation.result.ciphertext; setCiphertextInput(text); }
    setMode(nextMode); calculate(password, text, nextMode);
  }
  return <div className="app-shell"><Header ready={password !== ''} /><main><div className="intro-line"><p>DETERMINISTIC. REVERSIBLE. CASCADING.</p><span>32 ROTORS <i>/</i> 05 DIFFUSION ROUNDS <i>/</i> V1</span></div><KeyPanel password={password} onChange={changePassword} /><RotorGrid rotors={computation.result?.rotorStates} /><Workspace mode={mode} input={mode === 'encrypt' ? plaintextInput : ciphertextInput} output={computation.output} available={Boolean(computation.result)} busy={computation.busy} error={computation.error} passwordPresent={password !== ''} onModeChange={changeMode} onInputChange={changeInput} /><StatsPanel result={computation.result} /><DiagnosticPanel result={computation.result} mode={mode} errorDetail={computation.detail} /></main><footer className="footer"><div className="footer-meta"><span>ULTRA ENIGMA <i>/</i> V1</span><span>EXPERIMENTAL ROTOR CIPHER</span></div><p>Ultra Enigma is an experimental custom cipher intended for personal and educational use. It has not undergone professional cryptographic review and must not be used to protect high-value secrets.</p></footer></div>;
}
