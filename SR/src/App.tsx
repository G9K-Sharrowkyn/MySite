import { lazy, Suspense, useEffect } from 'react';
import { MainMenu, Countdown, StartingOverlay, HUD, FinishScreen } from './components/UI';
import { useGameStore } from './store/gameStore';
import { useGameAudio } from './hooks/useGameAudio';

const GameScene = lazy(() => import('./components/GameScene').then((module) => ({
  default: module.GameScene,
})));
const TrackEditor = lazy(() => import('./components/TrackEditor').then((module) => ({
  default: module.TrackEditor,
})));

export default function App() {
  useGameAudio();
  const phase       = useGameStore((s) => s.phase);
  const language    = useGameStore((s) => s.language);
  const engageGear  = useGameStore((s) => s.engageGear);
  const selectedTrack = useGameStore((s) => s.selectedTrack);
  const setHostUser = useGameStore((s) => s.setHostUser);
  const setLanguage = useGameStore((s) => s.setLanguage);
  const syncLeaderboard = useGameStore((s) => s.syncLeaderboard);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleHostSession = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'geekfights:swoop-session') return;
      setHostUser(event.data.user ?? null);
      setLanguage(event.data.language);
    };
    window.addEventListener('message', handleHostSession);
    return () => window.removeEventListener('message', handleHostSession);
  }, [setHostUser, setLanguage]);

  useEffect(() => {
    void syncLeaderboard(selectedTrack);
  }, [selectedTrack, syncLeaderboard]);

  // LMB click handler — triggers gear shift or start
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // left click only
      const st = useGameStore.getState();
      if (st.phase === 'starting' || st.phase === 'racing' || st.phase === 'countdown') {
        engageGear();
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [engageGear]);

  const showScene = phase === 'racing' || phase === 'coasting' || phase === 'starting' || phase === 'countdown' || phase === 'finished';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      <Suspense fallback={null}>
        {showScene && <GameScene />}
        {phase === 'editor' && <TrackEditor />}
      </Suspense>
      <MainMenu />
      <Countdown />
      <StartingOverlay />
      <HUD />
      <FinishScreen />
    </div>
  );
}
