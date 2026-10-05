import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { RotorPublicState } from '../engine/types';
import { rotorRole } from '../engine/rotor';
const pad = (value: number | undefined) => value === undefined ? '---' : String(value).padStart(3, '0');
export function RotorCard({ index, rotor }: { index: number; rotor?: RotorPublicState }) {
  const previousPosition = useRef(0);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (!rotor) { previousPosition.current = 0; setAngle(0); return; }
    const delta = rotor.position - previousPosition.current;
    const shortDelta = ((delta + 384) % 256) - 128;
    setAngle(previous => previous + shortDelta * 360 / 256 + (Math.abs(delta) > 80 ? rotor.direction * 360 : 0));
    previousPosition.current = rotor.position;
  }, [rotor?.position, rotor?.direction]);
  return <article className={`rotor-card role-${rotorRole(index).toLowerCase()} ${rotor ? 'initialized' : ''}`} aria-label={`R${String(index).padStart(2, '0')} ${rotorRole(index)}`}><div className="rotor-title"><span>R{String(index).padStart(2, '0')}</span><span className="rotor-wheel" style={{ '--rotation': `${angle}deg` } as CSSProperties} aria-hidden="true"><i /></span></div><span className="rotor-role">{rotorRole(index)}</span><div className="rotor-position"><span>POS</span><strong>{pad(rotor?.position)}</strong></div><div className="rotor-details"><span>STEP <b>{pad(rotor?.step)}</b></span><span>DIR <b>{rotor ? rotor.direction === 1 ? '→' : '←' : '—'}</b></span><span>MUT <b>{rotor?.mutations ?? '—'}</b></span></div></article>;
}
