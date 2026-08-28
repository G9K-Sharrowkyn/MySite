import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { MAX_SPEED } from '../game/raceRules';

interface AudioRig {
  context: AudioContext;
  engine: OscillatorNode;
  engineGain: GainNode;
  filter: BiquadFilterNode;
}

function playTone(context: AudioContext, frequency: number, duration: number, volume: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function useGameAudio() {
  const rigRef = useRef<AudioRig | null>(null);

  useEffect(() => {
    const activate = () => {
      if (rigRef.current) {
        void rigRef.current.context.resume();
        return;
      }

      const context = new AudioContext();
      const engine = context.createOscillator();
      const filter = context.createBiquadFilter();
      const engineGain = context.createGain();

      engine.type = 'sawtooth';
      engine.frequency.value = 45;
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 2.5;
      engineGain.gain.value = 0.0001;
      engine.connect(filter).connect(engineGain).connect(context.destination);
      engine.start();
      rigRef.current = { context, engine, engineGain, filter };
    };

    window.addEventListener('pointerdown', activate, { passive: true });
    window.addEventListener('keydown', activate);

    const unsubscribe = useGameStore.subscribe((state, previous) => {
      const rig = rigRef.current;
      if (!rig) return;

      const now = rig.context.currentTime;
      const running = state.phase === 'racing' || state.phase === 'coasting';
      const normalizedSpeed = Math.min(1.2, state.speed / MAX_SPEED);
      rig.engine.frequency.setTargetAtTime(48 + normalizedSpeed * 150 + state.currentGear * 12, now, 0.045);
      rig.filter.frequency.setTargetAtTime(380 + normalizedSpeed * 1500, now, 0.06);
      rig.engineGain.gain.setTargetAtTime(running ? 0.022 + normalizedSpeed * 0.028 : 0.0001, now, 0.08);

      if (state.currentGear !== previous.currentGear && state.phase === 'racing') {
        const qualityFrequency = state.shiftQuality === 'perfect' ? 760 : state.shiftQuality === 'good' ? 560 : 210;
        playTone(rig.context, qualityFrequency, 0.11, 0.045);
      }
      if (state.boostActive && !previous.boostActive) {
        playTone(rig.context, 420, 0.22, 0.055);
      }
      if (state.collisions > previous.collisions) {
        playTone(rig.context, 95, 0.28, 0.075);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      const rig = rigRef.current;
      rigRef.current = null;
      if (rig) void rig.context.close();
    };
  }, []);
}
