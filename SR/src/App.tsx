import { useEffect } from 'react';
import { GameScene } from './components/GameScene';
import { MainMenu, Countdown, StartingOverlay, HUD, FinishScreen } from './components/UI';
import { useGameStore } from './store/gameStore';
import { useGameAudio } from './hooks/useGameAudio';
import { TrackEditor } from './components/TrackEditor';

export default function App() {
  useGameAudio();
  const phase       = useGameStore((s) => s.phase);
  const engageGear  = useGameStore((s) => s.engageGear);
  const selectedTrack = useGameStore((s) => s.selectedTrack);
  const setHostUser = useGameStore((s) => s.setHostUser);
  const syncLeaderboard = useGameStore((s) => s.syncLeaderboard);

  useEffect(() => {
    const handleHostSession = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== 'geekfights:swoop-session') return;
      setHostUser(event.data.user ?? null);
    };
    window.addEventListener('message', handleHostSession);
    return () => window.removeEventListener('message', handleHostSession);
  }, [setHostUser]);

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
      {showScene && <GameScene />}
      <TrackEditor />
      <MainMenu />
      <Countdown />
      <StartingOverlay />
      <HUD />
      <FinishScreen />
    </div>
  );
}
