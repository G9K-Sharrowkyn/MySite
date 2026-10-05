import { GameScene } from './components/GameScene'
import { HUD } from './components/HUD'
import { gameAudio } from './game/audio'
import { useGameStore } from './store/gameStore'

function lockPointer() {
  const canvas = document.querySelector('canvas')
  void canvas?.requestPointerLock()
}

function startGame() {
  gameAudio.preload()
  useGameStore.getState().startRound()
  window.setTimeout(lockPointer, 40)
}

function Menu() {
  return (
    <div className="menu-shell">
      <div className="menu-panel">
        <p className="eyebrow">OPERACJA // 01</p>
        <h1>BREACH<span>POINT</span></h1>
        <p className="lead">Oczyść teren treningowy. Pięć celów, jeden magazynek na start, dziewięćdziesiąt sekund.</p>
        <button type="button" onClick={startGame}>ROZPOCZNIJ MISJĘ</button>
        <div className="controls-grid">
          <span><kbd>WASD</kbd> ruch</span>
          <span><kbd>MYSZ</kbd> celowanie</span>
          <span><kbd>LPM</kbd> strzał</span>
          <span><kbd>PPM</kbd> przyrządy</span>
          <span><kbd>1–3</kbd> zmiana broni</span>
          <span><kbd>R</kbd> przeładuj</span>
          <span><kbd>ALT</kbd> chód</span>
          <span><kbd>SHIFT</kbd> sprint</span>
          <span><kbd>SPACJA</kbd> skok</span>
        </div>
      </div>
      <div className="briefing-card">
        <span>STREFA</span><strong>MAGAZYN 17</strong><small>TRYB: ELIMINACJA</small>
      </div>
    </div>
  )
}

function PauseOverlay() {
  return (
    <button type="button" className="pause-overlay" onClick={lockPointer}>
      <span>GRA WSTRZYMANA</span>
      <strong>KLIKNIJ, ABY WRÓCIĆ</strong>
      <small>ESC zwalnia kursor</small>
    </button>
  )
}

function ResultScreen({ won }: { won: boolean }) {
  const kills = useGameStore((state) => state.kills)
  const score = useGameStore((state) => state.score)
  const shots = useGameStore((state) => state.shots)
  const hits = useGameStore((state) => state.hits)
  const accuracy = shots ? Math.min(100, Math.round(hits / shots * 100)) : 0

  return (
    <div className={`result-screen ${won ? 'victory' : 'defeat'}`}>
      <p>{won ? 'MISJA WYKONANA' : 'MISJA NIEUDANA'}</p>
      <h2>{won ? 'TEREN CZYSTY' : 'ODDZIAŁ UTRACONY'}</h2>
      <div className="result-stats">
        <span><small>ELIMINACJE</small><strong>{kills}/5</strong></span>
        <span><small>CELNOŚĆ</small><strong>{accuracy}%</strong></span>
        <span><small>WYNIK</small><strong>{score}</strong></span>
      </div>
      <button type="button" onClick={startGame}>ZAGRAJ PONOWNIE</button>
    </div>
  )
}

export default function App() {
  const phase = useGameStore((state) => state.phase)
  const pointerLocked = useGameStore((state) => state.pointerLocked)

  return (
    <main className="game-app">
      <GameScene />
      <div className="screen-grain" aria-hidden="true" />
      {phase === 'menu' && <Menu />}
      {phase === 'playing' && !pointerLocked && <PauseOverlay />}
      {phase === 'won' && <ResultScreen won />}
      {phase === 'lost' && <ResultScreen won={false} />}
      <HUD />
      <div className="desktop-note">Gra wymaga klawiatury i myszy</div>
    </main>
  )
}
