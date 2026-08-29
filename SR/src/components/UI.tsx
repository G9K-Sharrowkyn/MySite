import { useEffect, useRef } from 'react';
import { useGameStore, TRACKS } from '../store/gameStore';
import type { TrackId } from '../store/gameStore';
import { MAX_SPEED, getReferenceTimeMs, getSpeedEffectIntensity } from '../game/raceRules';
import { swoopText, trackSubtitle } from '../i18n';

function formatTime(ms: number): string {
  const totalS = ms / 1000;
  const m = Math.floor(totalS / 60);
  const s = totalS % 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6,'0')}` : `${s.toFixed(3)}`;
}

function formatDiff(diffMs: number): string {
  const sign = diffMs >= 0 ? '+' : '-';
  return `${sign}${formatTime(Math.abs(diffMs))}`;
}

function formatCockpitTime(ms: number): string {
  const safe = Math.max(0, ms);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const milliseconds = Math.floor(safe % 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

function RaceTopConsole({ stage }: { stage: 'countdown' | 'starting' | 'racing' }) {
  const raceTime = useGameStore((state) => state.raceTime);
  const countdownValue = useGameStore((state) => state.countdownValue);
  const distance = useGameStore((state) => state.travelledDistance);
  const trackId = useGameStore((state) => state.selectedTrack);
  const language = useGameStore((state) => state.language);
  const t = (key: Parameters<typeof swoopText>[1]) => swoopText(language, key);
  const track = TRACKS[trackId];
  const progress = Math.min(distance / track.length, 1);
  const referenceTime = getReferenceTimeMs(progress, track.record);
  const diff = raceTime * 1000 - referenceTime;
  const yellowOn = stage !== 'countdown' || countdownValue <= 2;
  const greenOn = stage === 'starting' || stage === 'racing';

  return (
    <div className={`race-console-top stage-${stage}`}>
      <div className="race-console-cap left" />
      <div className="start-lights" aria-label={t('startLights')}>
        <span className="start-light red active" />
        <span className={`start-light yellow ${yellowOn ? 'active' : ''}`} />
        <span className={`start-light green ${greenOn ? 'active' : ''}`} />
      </div>
      <div className="race-clock-panel">
        <span className="race-clock-track">{track.name.toUpperCase()}</span>
        <strong className="race-clock">{formatCockpitTime(raceTime * 1000)}</strong>
      </div>
      <div className="race-console-readout">
        {stage === 'countdown' ? (
          <>
            <span>{t('start')}</span>
            <strong>{countdownValue === 3 ? t('red') : t('warning')}</strong>
          </>
        ) : stage === 'starting' ? (
          <>
            <span>{t('signal')}</span>
            <strong className="go-readout">{t('start')}</strong>
          </>
        ) : (
          <>
            <span>{t('vsRecord')}</span>
            <strong className={diff < 0 ? 'ahead' : 'behind'}>{formatDiff(diff)}</strong>
          </>
        )}
      </div>
      <div className="race-console-cap right" />
      <div className="race-route-progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
export function HUD() {
  const language     = useGameStore((s) => s.language);
  const phase        = useGameStore((s) => s.phase);
  const speed        = useGameStore((s) => s.speed);
  const gear         = useGameStore((s) => s.currentGear);
  const shiftProg    = useGameStore((s) => s.shiftProgress);
  const shiftQuality = useGameStore((s) => s.shiftQuality);
  const shiftTimer   = useGameStore((s) => s.shiftQualityTimer);
  const damage       = useGameStore((s) => s.damage);
  const boostActive  = useGameStore((s) => s.boostActive);
  const jumpCooldown = useGameStore((s) => s.jumpCooldown);
  const collisionBlocked = useGameStore((s) => s.collisionBlocked);
  const speedEffect  = getSpeedEffectIntensity(speed);
  const t = (key: Parameters<typeof swoopText>[1], values: Record<string, string | number> = {}) => swoopText(language, key, values);

  if (phase !== 'racing' && phase !== 'coasting') return null;

  const coasting = phase === 'coasting';

  const isReady  = shiftProg >= 0.8 && gear < 5;
  const isPerfect = shiftProg >= 0.95;
  const normalChevronCount = 10;
  const meterProgress = coasting
    ? Math.min(1, speed / MAX_SPEED)
    : gear === 5
      ? Math.min(1, speed / MAX_SPEED)
      : Math.min(1, shiftProg / 0.8);

  const shiftLabel =
    shiftQuality === 'perfect' ? t('perfectShift') :
    shiftQuality === 'good'    ? t('goodShift')   :
    shiftQuality === 'early'   ? t('tooEarly')    :
    shiftQuality === 'late'    ? t('tooLate')     : '';

  const shiftLabelColor =
    shiftQuality === 'perfect' ? '#00ff88' :
    shiftQuality === 'good'    ? '#88ff00' :
    shiftQuality === 'early'   ? '#ff8800' :
    shiftQuality === 'late'    ? '#ff4400' : '';

  return (
    <div className="hud">
      <div className="speed-vignette" style={{ opacity: speedEffect * 0.62 }} />
      {collisionBlocked && (
        <div className="collision-blocked-alert">
          <span>{t('vehicleBlocked')}</span>
          <strong>{t('avoidObstacle')}</strong>
        </div>
      )}
      <RaceTopConsole stage="racing" />

      <div className="swoop-bottom-hud">
        <div className="swoop-gear-pod">
          <span>{t('gear')}</span>
          <strong>{gear || '–'}</strong>
          <small>{Math.round(speed)} km/h</small>
        </div>

        <div className="swoop-shift-console">
          <div className="swoop-shift-message">
            {coasting ? (
              <span className="coasting-label">{t('finishCoasting')}</span>
            ) : shiftTimer > 0 && shiftLabel ? (
              <span className="shift-quality-flash" style={{ color: shiftLabelColor }}>{shiftLabel}</span>
            ) : isPerfect ? (
              <span className="swoop-shift-now">{t('changeGear')}</span>
            ) : isReady ? (
              <span className="swoop-shift-armed">{t('prepareShift')}</span>
            ) : gear === 5 ? (
              <span className="shift-max">{t('maxGear')}</span>
            ) : (
              <span>{t('engineSpeed')}</span>
            )}
          </div>

          <div className="swoop-chevron-track">
            {Array.from({ length: normalChevronCount }, (_, index) => {
              const threshold = (index + 1) / normalChevronCount;
              return (
                <span
                  key={index}
                  className={`swoop-chevron ${meterProgress >= threshold ? 'filled' : ''}`}
                >
                  <i />
                </span>
              );
            })}
            <span className={`swoop-chevron terminal ${isReady ? 'armed' : ''} ${isPerfect ? 'shift-now' : ''} ${gear === 5 ? 'maxed' : ''}`}>
              <i />
            </span>
          </div>

          <div className="swoop-console-caption">
            <span>{coasting ? t('autoBraking') : t('changeGear')}</span>
            {boostActive && <strong>BOOST +15</strong>}
          </div>
        </div>

        <div className="swoop-status-dial" style={{ '--hull-level': `${Math.max(0, 100 - damage) * 3.6}deg` } as React.CSSProperties}>
          <div className="swoop-dial-inner">
            <span>{t('speed')}</span>
            <strong>{Math.round(speed)}</strong>
            <small>km/h</small>
            <div className={`dial-jump ${jumpCooldown <= 0 ? 'ready' : ''}`}>
              {jumpCooldown <= 0 ? t('jumpReady') : t('jumpCooldown', { seconds: jumpCooldown.toFixed(1) })}
            </div>
            <div className="dial-hull">{t('hull', { percent: 100 - damage })}</div>
          </div>
        </div>
      </div>

      {/* Controls hint */}
      {!coasting && (
        <div className="controls-hint">
          {t('controlsAll')}
        </div>
      )}
    </div>
  );
}

// ─── Starting Screen (waiting for first click) ─────────────────────────────
export function StartingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const falseStart = useGameStore((s) => s.falseStart);
  const language = useGameStore((s) => s.language);
  if (phase !== 'starting') return null;
  return (
    <div className="countdown-overlay starting-overlay" onClick={(e) => e.preventDefault()}>
      <RaceTopConsole stage="starting" />
      <div className="start-signal-wrap compact">
        <div className={`start-instruction ${falseStart ? 'false-start' : ''}`}>
          {swoopText(language, falseStart ? 'falseStart' : 'greenStart')}
        </div>
      </div>
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────
export function Countdown() {
  const phase      = useGameStore((s) => s.phase);
  const value      = useGameStore((s) => s.countdownValue);
  const setVal     = useGameStore((s) => s.setCountdown);
  const startRace  = useGameStore((s) => s.startRace);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const language   = useGameStore((s) => s.language);

  useEffect(() => {
    if (phase !== 'countdown') return;
    setVal(3);

    timerRef.current = setTimeout(() => {
      if (useGameStore.getState().phase !== 'countdown') return;
      setVal(2);
      timerRef.current = setTimeout(() => {
        if (useGameStore.getState().phase === 'countdown') startRace();
      }, 1000);
    }, 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, setVal, startRace]);

  if (phase !== 'countdown') return null;

  return (
    <div className="countdown-overlay cockpit-countdown">
      <RaceTopConsole stage="countdown" />
      <div className="start-signal-wrap compact">
        <div className="prestart-instruction">
          {swoopText(language, value === 3 ? 'getReady' : 'warning')}
        </div>
      </div>
    </div>
  );
}

// ─── Finish Screen ────────────────────────────────────────────────────────────
export function FinishScreen() {
  const language     = useGameStore((s) => s.language);
  const phase        = useGameStore((s) => s.phase);
  const raceTime     = useGameStore((s) => s.raceTime);
  const collisions   = useGameStore((s) => s.collisions);
  const trackId      = useGameStore((s) => s.selectedTrack);
  const track        = TRACKS[trackId];
  const nickname     = useGameStore((s) => s.playerNickname);
  const resetRace    = useGameStore((s) => s.resetRace);
  const startCountdown = useGameStore((s) => s.setPhase);
  const submitScore  = useGameStore((s) => s.submitScore);
  const leaderboard  = useGameStore((s) => s.leaderboard);
  const damage       = useGameStore((s) => s.damage);

  useEffect(() => {
    if (phase === 'finished') submitScore();
  }, [phase, submitScore]);

  if (phase !== 'finished') return null;

  const trackBoard = leaderboard.filter((e) => e.trackId === trackId).slice(0, 5);
  const myTimeMs   = Math.round(raceTime * 1000);
  const diff       = myTimeMs - track.record;
  const isDestroyed = damage >= 100;
  const isRecord   = !isDestroyed && diff < 0;
  const t = (key: Parameters<typeof swoopText>[1]) => swoopText(language, key);

  return (
    <div className="finish-overlay">
      <div className="finish-card">
        <div className="finish-title" style={{ color: isDestroyed ? '#ff4444' : '' }}>
          {isDestroyed ? t('destroyed') : t('finish')}
        </div>
        <div className="finish-track">{track.name}</div>

        <div className="finish-stats">
          <div className="stat-row">
            <span>{t('yourTime')}</span>
            <span className="stat-value highlight">{formatTime(myTimeMs)}</span>
          </div>
          <div className="stat-row">
            <span>{t('trackRecord')}</span>
            <span className="stat-value">{formatTime(track.record)}</span>
          </div>
          <div className="stat-row">
            <span>{t('difference')}</span>
            <span className="stat-value" style={{ color: isRecord ? '#00ff88' : '#ff6644' }}>
              {formatDiff(diff)}
            </span>
          </div>
          <div className="stat-row">
            <span>{t('collisions')}</span>
            <span className="stat-value" style={{ color: collisions > 0 ? '#ff4444' : '#00ff88' }}>
              {collisions}
            </span>
          </div>
        </div>

        {isRecord && (
          <div className="new-record-banner">{t('newRecord')}</div>
        )}

        <div className="finish-leaderboard">
          <div className="lb-title">TOP 5 — {track.name}</div>
          {trackBoard.map((e, i) => (
            <div key={i} className={`lb-row ${e.nickname === nickname && e.timeMs === myTimeMs ? 'lb-mine' : ''}`}>
              <span className="lb-pos">{i + 1}.</span>
              <span className="lb-name">{e.nickname}</span>
              <span className="lb-time">{formatTime(e.timeMs)}</span>
            </div>
          ))}
        </div>

        <div className="finish-actions">
          <button className="btn btn-primary" onClick={() => startCountdown('countdown')}>
            {t('again')}
          </button>
          <button className="btn btn-secondary" onClick={resetRace}>
            {t('menu')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Menu ────────────────────────────────────────────────────────────────
export function MainMenu() {
  const language       = useGameStore((s) => s.language);
  const phase          = useGameStore((s) => s.phase);
  const selected       = useGameStore((s) => s.selectedTrack);
  const selectTrack    = useGameStore((s) => s.selectTrack);
  const setPhase       = useGameStore((s) => s.setPhase);
  const nickname       = useGameStore((s) => s.playerNickname);
  const setNickname    = useGameStore((s) => s.setNickname);
  const leaderboard    = useGameStore((s) => s.leaderboard);
  const leaderboardSource = useGameStore((s) => s.leaderboardSource);
  const leaderboardError = useGameStore((s) => s.leaderboardError);
  const hostUser       = useGameStore((s) => s.hostUser);
  const t = (key: Parameters<typeof swoopText>[1]) => swoopText(language, key);

  if (phase !== 'menu') return null;

  const tracks = Object.values(TRACKS);

  return (
    <div className="menu-overlay">
      <div className="menu-container">
        <div className="menu-title">
          <span className="title-swoop">SWOOP</span>
          <span className="title-racer">RACER</span>
        </div>
        <div className="menu-subtitle">{t('gameSubtitle')}</div>

        <div className="nickname-section">
          <label className="form-label">{hostUser ? t('geekfightsAccount') : t('nickname')}</label>
          <input
            className="form-input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            readOnly={Boolean(hostUser)}
            maxLength={20}
            placeholder={t('nicknamePlaceholder')}
          />
        </div>

        <div className="track-section">
          <div className="section-label">{t('chooseTrack')}</div>
          <div className="track-grid">
            {tracks.map((track) => (
              <button
                key={track.id}
                className={`track-card ${selected === track.id ? 'selected' : ''}`}
                onClick={() => selectTrack(track.id as TrackId)}
                style={{ '--track-color': track.color } as React.CSSProperties}
              >
                <div className="track-name">{track.name}</div>
                <div className="track-sub">{trackSubtitle(language, track.id)}</div>
                <div className="track-record">⏱ {formatTime(track.record)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="menu-leaderboard">
          <div className="section-label">
            TOP 100 {leaderboardSource === 'online' ? t('online') : t('local')} — {TRACKS[selected].name}
          </div>
          <div className="lb-table">
            {leaderboard
              .filter((e) => e.trackId === selected)
              .slice(0, 100)
              .map((e, i) => (
                <div key={i} className="lb-row">
                  <span className="lb-pos">{i + 1}.</span>
                  <span className="lb-name">{e.nickname}</span>
                  <span className="lb-time">{formatTime(e.timeMs)}</span>
                  <span className="lb-col" style={{ color: e.collisions > 0 ? '#ff6666' : '#00ff88' }}>
                    {e.collisions === 0 ? '✓' : `${e.collisions}💥`}
                  </span>
                </div>
              ))}
            {leaderboard.filter((e) => e.trackId === selected).length === 0 && (
              <div className="lb-empty">{t('noResults')}</div>
            )}
          </div>
          {leaderboardError && <div className="lb-error">{t(leaderboardError as Parameters<typeof swoopText>[1])}</div>}
        </div>

        <button className="btn btn-start" onClick={() => setPhase('countdown')}>
          {t('race')}
        </button>

        {(!hostUser || hostUser.role === 'moderator' || hostUser.role === 'admin') && (
          <button className="btn btn-editor" onClick={() => setPhase('editor')}>
            {t('trackEditor')}
          </button>
        )}

        <div className="menu-controls">
          <span>{t('steer')}</span>
          <span>{t('jumpControl')}</span>
          <span>{t('shiftControl')}</span>
        </div>
      </div>
    </div>
  );
}
