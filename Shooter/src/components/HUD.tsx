import { useGameStore } from '../store/gameStore'
import { weaponDefinitions, weaponOrder } from '../game/weapons'

function formatTime(seconds: number) {
  const whole = Math.ceil(seconds)
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`
}

export function HUD() {
  const phase = useGameStore((state) => state.phase)
  const health = useGameStore((state) => state.health)
  const selectedWeapon = useGameStore((state) => state.selectedWeapon)
  const magazines = useGameStore((state) => state.magazines)
  const reserves = useGameStore((state) => state.reserves)
  const reloading = useGameStore((state) => state.reloading)
  const timeLeft = useGameStore((state) => state.timeLeft)
  const kills = useGameStore((state) => state.kills)
  const score = useGameStore((state) => state.score)
  const message = useGameStore((state) => state.message)
  const hitSerial = useGameStore((state) => state.hitSerial)
  const aiming = useGameStore((state) => state.aiming)
  const weapon = weaponDefinitions[selectedWeapon]
  const ammo = magazines[selectedWeapon]
  const reserve = reserves[selectedWeapon]

  if (phase !== 'playing') return null

  return (
    <div className="hud" aria-live="polite">
      <div className="hud-top">
        <div className="team-badge"><span>CT</span> ODDZIAŁ ALFA</div>
        <div className="round-clock"><small>RUNDA 01</small><strong>{formatTime(timeLeft)}</strong></div>
        <div className="enemy-count">CELE <strong>{5 - kills}</strong></div>
      </div>
      <div className={`crosshair ${aiming ? 'aiming' : ''}`} aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="hit-marker" key={hitSerial} aria-hidden="true">×</div>
      <div className="status-message">{message}</div>
      <div className="hud-bottom">
        <div className={`health-block ${health < 30 ? 'critical' : ''}`}>
          <small>ZDROWIE</small>
          <strong>{Math.ceil(health)}</strong>
          <div className="health-line"><span style={{ width: `${health}%` }} /></div>
        </div>
        <div className="score-block"><small>WYNIK</small><strong>{score.toString().padStart(4, '0')}</strong></div>
        <div className="weapon-block">
          <div className="weapon-slots" aria-label="Dostępne bronie">
            {weaponOrder.map((id) => (
              <span key={id} className={id === selectedWeapon ? 'active' : ''}>
                <b>{weaponDefinitions[id].slot}</b>{weaponDefinitions[id].shortName}
              </span>
            ))}
          </div>
          <small>{reloading ? 'PRZEŁADOWANIE' : weapon.name.toUpperCase()}</small>
          <div><strong>{String(ammo).padStart(2, '0')}</strong><span>/ {reserve}</span></div>
        </div>
      </div>
    </div>
  )
}
