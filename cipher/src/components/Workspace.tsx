import { useRef, useState } from 'react';
export type Mode = 'encrypt' | 'decrypt';
interface Props {
  mode: Mode; input: string; output: string; available: boolean; busy: boolean; error: string; passwordPresent: boolean;
  onModeChange: (mode: Mode) => void; onInputChange: (value: string) => void;
}
export function Workspace({ mode, input, output, available, busy, error, passwordPresent, onModeChange, onInputChange }: Props) {
  const outputRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  async function copy() {
    setCopiedValue(output);
    try { await navigator.clipboard.writeText(output); setCopyStatus('Skopiowano wynik.'); }
    catch { outputRef.current?.focus(); outputRef.current?.select(); setCopyStatus('Zaznaczono wynik. Skopiuj go przez Ctrl+C lub Cmd+C.'); }
  }
  const status = !passwordPresent ? 'Wprowadź hasło, aby rozpocząć.' : busy ? 'Przeliczanie całej wiadomości…' : error || (mode === 'encrypt' ? 'Cała wiadomość przeliczana od początku przy każdej zmianie.' : 'Wynik udostępniany wyłącznie po pełnej weryfikacji.');
  return <section className="workspace" aria-label="Cipher workspace"><div className="workspace-heading"><h2><span>03</span> MESSAGE WORKSPACE</h2><div className="mode-switch" role="group" aria-label="Tryb maszyny"><button type="button" className={mode === 'encrypt' ? 'active' : ''} aria-pressed={mode === 'encrypt'} onClick={() => { setCopyStatus(''); onModeChange('encrypt'); }}>ENCRYPT <span>↗</span></button><button type="button" className={mode === 'decrypt' ? 'active' : ''} aria-pressed={mode === 'decrypt'} onClick={() => { setCopyStatus(''); onModeChange('decrypt'); }}>DECRYPT <span>↙</span></button></div></div><div className="editors"><div className="editor"><div className="editor-heading"><label htmlFor="message-input">{mode === 'encrypt' ? 'PLAINTEXT' : 'CIPHERTEXT'}</label><button type="button" className="quiet-button" onClick={() => { setCopyStatus(''); onInputChange(''); }} disabled={!input}>CLEAR</button></div><textarea id="message-input" value={input} onChange={event => { setCopyStatus(''); onInputChange(event.target.value); }} placeholder={mode === 'encrypt' ? 'Wpisz wiadomość. Każdy znak zmienia całą maszynę.' : 'Wklej szyfrogram Ultra Enigma V1…'} spellCheck={false} autoCapitalize="off" /><div className="editor-footer"><span>{input.length.toLocaleString('en-US')} CHARACTERS</span><span>INPUT / UTF-8</span></div></div><div className="editor output-editor"><div className="editor-heading"><label htmlFor="message-output">{mode === 'encrypt' ? 'CIPHERTEXT' : 'PLAINTEXT'}</label><button type="button" className="copy-button" onClick={copy} disabled={!available}>COPY <span aria-hidden="true">⧉</span></button></div><textarea ref={outputRef} id="message-output" value={output} readOnly placeholder={mode === 'encrypt' ? 'Oczekiwanie na zainicjalizowanie maszyny…' : 'Odszyfrowana wiadomość pojawi się tutaj.'} spellCheck={false} /><div className="editor-footer"><span>{output.length.toLocaleString('en-US')} CHARACTERS</span><span>OUTPUT / {mode === 'encrypt' ? 'CUSTOM BASE64' : 'UTF-8'}</span></div></div></div><div className={`workspace-status ${error ? 'error' : ''}`} role="status" aria-live="polite"><span className={`led ${passwordPresent && !error && !busy ? 'on' : ''}`} /><span>{copyStatus && copiedValue === output && available && !error && !busy ? copyStatus : status}</span><span className="live-badge">{busy ? 'PENDING' : 'LIVE PROCESSING'}</span></div></section>;
}

