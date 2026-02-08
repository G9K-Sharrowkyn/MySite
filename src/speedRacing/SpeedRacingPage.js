import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './SpeedRacingPage.css';

const TRACKS = [
  {
    id: 'taris',
    name: 'Taris Canyon',
    length: 620,
    baseSpeed: 24,
    maxSpeed: 44,
    targetTime: 22.6,
    obstacleSpacing: 80,
    boostSpacing: 88,
    theme: 'canyon',
    blurb: 'Rocky straight shot; boosts hang closer to the middle lane.'
  },
  {
    id: 'tatooine',
    name: 'Tatooine Drift',
    length: 640,
    baseSpeed: 23,
    maxSpeed: 43,
    targetTime: 22.8,
    obstacleSpacing: 72,
    boostSpacing: 92,
    theme: 'dune',
    blurb: 'Sand-carved bends with junk piles and wide-angled boost pads.'
  },
  {
    id: 'manaan',
    name: 'Manaan Cavern',
    length: 610,
    baseSpeed: 25,
    maxSpeed: 45,
    targetTime: 22.2,
    obstacleSpacing: 78,
    boostSpacing: 84,
    theme: 'cave',
    blurb: 'Underwater tunnels with tight glow markers and shimmering walls.'
  }
];

const LANES = [0, 1, 2];
const LANE_POSITIONS = [20, 50, 80];
const TICK_MS = 50;
const TICK_SECONDS = TICK_MS / 1000;
const VIEW_DISTANCE = 140;

const POWERUP_TYPES = ['shield', 'magnet', 'hyper'];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const generateItems = (track) => {
  const obstacles = [];
  const boosts = [];
  const powerups = [];

  for (let pos = 70; pos < track.length - 40; ) {
    pos += randomBetween(track.obstacleSpacing * 0.65, track.obstacleSpacing * 1.15);
    const lane = Math.floor(randomBetween(0, LANES.length));
    obstacles.push({
      id: `ob-${lane}-${pos.toFixed(2)}`,
      lane,
      position: pos
    });
  }

  for (let pos = 40; pos < track.length - 30; ) {
    pos += randomBetween(track.boostSpacing * 0.7, track.boostSpacing * 1.25);
    const lane = Math.min(2, Math.max(0, Math.round(randomBetween(0, 2))));
    boosts.push({
      id: `bo-${lane}-${pos.toFixed(2)}`,
      lane,
      position: pos
    });
  }

  // Power-ups every 150-200m
  for (let pos = 100; pos < track.length - 50; pos += randomBetween(150, 200)) {
    const lane = Math.floor(randomBetween(0, LANES.length));
    const type = POWERUP_TYPES[Math.floor(randomBetween(0, POWERUP_TYPES.length))];
    powerups.push({
      id: `pw-${lane}-${pos.toFixed(2)}`,
      lane,
      position: pos,
      type
    });
  }

  return { obstacles, boosts, powerups };
};

const SpeedRacingPage = () => {
  const { t } = useLanguage();
  const [track, setTrack] = useState(TRACKS[0]);
  const [items, setItems] = useState({ obstacles: [], boosts: [], powerups: [] });
  const [gameState, setGameState] = useState('idle'); // idle | lights | running | finished
  const [countdownStage, setCountdownStage] = useState('red');
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(TRACKS[0].baseSpeed);
  const [gearMeter, setGearMeter] = useState(12);
  const [shiftReady, setShiftReady] = useState(false);
  const [status, setStatus] = useState(t('speedRacingReady'));
  const [playerLane, setPlayerLane] = useState(1);
  const [screenShake, setScreenShake] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0);
  
  // Drift mechanics
  const [isDrifting, setIsDrifting] = useState(false);
  const [driftCharge, setDriftCharge] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [driftDirection, setDriftDirection] = useState(0); // -1 left, 1 right (future: racer rotation)
  
  // Combo system
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  const [lastActionTime, setLastActionTime] = useState(0);
  
  // Power-ups
  const [activePowerups, setActivePowerups] = useState([]);
  const [collectedPowerups, setCollectedPowerups] = useState([]);

  const speedRef = useRef(speed);
  const lastSpeedRef = useRef(speed);
  const rafIdRef = useRef(null);
  const distanceRef = useRef(distance);
  const elapsedRef = useRef(elapsed);
  const playerLaneRef = useRef(playerLane);
  const shiftReadyRef = useRef(shiftReady);
  const gameStateRef = useRef(gameState);
  const timeoutsRef = useRef([]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    distanceRef.current = distance;
  }, [distance]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    playerLaneRef.current = playerLane;
  }, [playerLane]);

  useEffect(() => {
    shiftReadyRef.current = shiftReady;
  }, [shiftReady]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  const corridorMetrics = useMemo(() => {
    const laneOffset = playerLane - 1;
    const laneShiftPct = laneOffset * 6;

    return {
      laneShiftPct
    };
  }, [playerLane]);

  const trackStyle = useMemo(() => {
    const { laneShiftPct } = corridorMetrics;
    const motionBlurPx = Math.min(8, blurAmount).toFixed(2);
    return {
      '--lane-shift-pct': `${laneShiftPct}%`,
      '--motion-blur': `${motionBlurPx}px`
    };
  }, [corridorMetrics, blurAmount]);

  const visibleItems = useMemo(() => {
    const start = Math.max(0, distance - 10);
    const end = distance + VIEW_DISTANCE;
    const { laneShiftPct } = corridorMetrics;
    const vanishX = 50;
    const vanishY = 50;

    const mapItem = (item, type) => {
      if (item.position < start || item.position > end) return null;
      const depth = (item.position - distance) / VIEW_DISTANCE;
      const t = Math.max(0, Math.min(1, 1 - depth));
      const curve = t * t;
      const lanePct = LANE_POSITIONS[item.lane] + laneShiftPct;
      const left = vanishX + (lanePct - vanishX) * curve;
      const top = vanishY + (100 - vanishY) * curve;
      const scale = 0.3 + curve * 1.1;
      const opacity = 0.2 + curve * 0.8;

      return {
        ...item,
        type,
        scale,
        top,
        left,
        opacity
      };
    };

    return [
      ...items.obstacles.map((item) => mapItem(item, 'obstacle')),
      ...items.boosts.map((item) => mapItem(item, 'boost')),
      ...items.powerups.map((item) => mapItem({ ...item, powerupType: item.type }, 'powerup'))
    ].filter(Boolean);
  }, [corridorMetrics, distance, items]);

  const floorLines = useMemo(() => {
    const { laneShiftPct } = corridorMetrics;
    const vanishX = 50;
    const vanishY = 50;
    const frontLeft = laneShiftPct;
    const frontRight = 100 + laneShiftPct;
    const lineCount = 16;
    const scroll = (distance * 0.06) % 1;
    const lines = [];

    for (let i = 0; i < lineCount; i += 1) {
      const t = (i / lineCount + scroll) % 1;
      const depth = t * t;
      const left = vanishX + (frontLeft - vanishX) * depth;
      const right = vanishX + (frontRight - vanishX) * depth;
      const top = vanishY + (100 - vanishY) * depth;
      const opacity = 0.1 + depth * 0.45;

      lines.push({
        id: `line-${i}`,
        left: `${left}%`,
        width: `${right - left}%`,
        top: `${top}%`,
        opacity
      });
    }

    return lines;
  }, [corridorMetrics, distance]);

  const laneGuides = useMemo(() => {
    const { laneShiftPct } = corridorMetrics;
    return LANE_POSITIONS.map((lanePct, index) => ({
      id: `lane-guide-${index}`,
      x2: lanePct + laneShiftPct
    }));
  }, [corridorMetrics]);

  // Speed lines for motion effect
  const speedLines = useMemo(() => {
    if (gameState !== 'running') return [];
    
    const speedRatio = speed / track.maxSpeed;
    if (speedRatio < 0.3) return []; // Only show at 30%+ speed
    
    const lineCount = Math.floor(20 + speedRatio * 10); // 20-30 lines
    const scroll = (distance * 0.15) % 1;
    const lines = [];
    
    for (let i = 0; i < lineCount; i++) {
      const angle = (i / lineCount) * 360;
      const lifecycle = ((i / lineCount) + scroll) % 1;
      const length = 40 + lifecycle * 40; // 40-80px
      const opacity = (1 - lifecycle) * speedRatio * 0.6;
      
      if (opacity < 0.05) continue;
      
      lines.push({
        id: `speed-line-${i}`,
        angle,
        length,
        opacity,
        width: 2 + speedRatio * 2 // 2-4px
      });
    }
    
    return lines;
  }, [distance, speed, track.maxSpeed, gameState]);

  const addComboAction = useCallback((actionType) => {
    const now = performance.now();
    if (now - lastActionTime < 5000) {
      setCombo(prev => Math.min(5, prev + 1));
      setComboTimer(5);
    } else {
      setCombo(1);
      setComboTimer(5);
    }
    setLastActionTime(now);
  }, [lastActionTime]);

  const resetCombo = useCallback(() => {
    setCombo(0);
    setComboTimer(0);
  }, []);

  const handleLaneChange = useCallback((direction) => {
    setPlayerLane((prev) => {
      const next = Math.min(2, Math.max(0, prev + direction));
      playerLaneRef.current = next;
      return next;
    });
    
    if (isDrifting) {
      setDriftDirection(direction);
    }
    
    setStatus(direction < 0 ? 'Edge left through the canyon.' : 'Slide right toward the open lane.');
  }, [isDrifting]);

  const startDrift = useCallback((direction) => {
    setIsDrifting(true);
    setDriftDirection(direction);
    setDriftCharge(0);
  }, []);

  const endDrift = useCallback(() => {
    if (!isDrifting) return;
    
    setIsDrifting(false);
    
    // Drift boost based on charge
    if (driftCharge >= 70) {
      setSpeed((prev) => {
        const boosted = Math.min(track.maxSpeed, prev + 8);
        speedRef.current = boosted;
        return boosted;
      });
      setStatus('Perfect drift! Massive boost!');
      addComboAction('drift');
    } else if (driftCharge >= 40) {
      setSpeed((prev) => {
        const boosted = Math.min(track.maxSpeed, prev + 4);
        speedRef.current = boosted;
        return boosted;
      });
      setStatus('Good drift! Nice boost.');
    }
    
    setDriftCharge(0);
    setDriftDirection(0);
  }, [isDrifting, driftCharge, track.maxSpeed, addComboAction]);

  const handleShift = useCallback(() => {
    if (gameStateRef.current !== 'running') return;

    if (shiftReadyRef.current) {
      const comboBonus = combo > 0 ? combo * 1.5 : 0;
      setSpeed((prev) => {
        const boosted = Math.min(track.maxSpeed, prev + 6 + comboBonus);
        speedRef.current = boosted;
        return boosted;
      });
      setGearMeter(10);
      setShiftReady(false);
      setStatus('Perfect shift! Engine howls.');
      addComboAction('shift');
    } else {
      setSpeed((prev) => {
        const dipped = Math.max(track.baseSpeed - 6, prev - 4);
        speedRef.current = dipped;
        return dipped;
      });
      setStatus('Late shift. Power droops.');
      resetCombo();
    }
  }, [track.baseSpeed, track.maxSpeed, combo, addComboAction, resetCombo]);

  const handleCollision = useCallback(() => {
    // Check for shield power-up
    const hasShield = activePowerups.find(p => p.type === 'shield');
    if (hasShield) {
      setActivePowerups(prev => prev.filter(p => p.type !== 'shield'));
      setStatus('Shield absorbed impact!');
      return;
    }
    
    setSpeed((prev) => {
      const slowed = Math.max(track.baseSpeed - 6, prev * 0.65);
      speedRef.current = slowed;
      return slowed;
    });
    setStatus('Rock hit! Frame rattles.');
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 220);
    resetCombo();
    setIsDrifting(false);
    setDriftCharge(0);
  }, [track.baseSpeed, activePowerups, resetCombo]);

  const handleBoostPickup = useCallback(() => {
    const comboBonus = combo > 0 ? combo * 1.5 : 0;
    setSpeed((prev) => {
      const surged = Math.min(track.maxSpeed, prev + 7 + comboBonus);
      speedRef.current = surged;
      return surged;
    });
    setStatus('Pad boost! Repulsors flare.');
    addComboAction('boost');
  }, [track.maxSpeed, combo, addComboAction]);

  const handlePowerupPickup = useCallback((powerupType) => {
    setCollectedPowerups(prev => [...prev, powerupType]);
    const startTime = performance.now();
    
    switch(powerupType) {
      case 'shield':
        setActivePowerups(prev => [...prev, { type: 'shield', duration: 10000, startTime }]);
        setStatus('Shield active! Immune to next hit.');
        break;
      case 'magnet':
        setActivePowerups(prev => [...prev, { type: 'magnet', duration: 8000, startTime }]);
        setStatus('Magnet active! Auto-collecting boosts.');
        break;
      case 'hyper':
        setActivePowerups(prev => [...prev, { type: 'hyper', duration: 5000, startTime }]);
        setSpeed(() => {
          speedRef.current = track.maxSpeed;
          return track.maxSpeed;
        });
        setStatus('HYPER BOOST! Maximum velocity!');
        break;
      default:
        break;
    }
  }, [track.maxSpeed]);

  const finishRace = useCallback(() => {
    if (gameStateRef.current !== 'running') return;
    setGameState('finished');
    setStatus(elapsedRef.current <= track.targetTime ? 'Tier Three Winner!' : 'Finish line crossed.');
  }, [track.targetTime]);

  const tick = useCallback(() => {
    if (gameStateRef.current !== 'running') return;

    setElapsed((prev) => {
      const next = prev + TICK_SECONDS;
      elapsedRef.current = next;
      return next;
    });

    // Drift charge accumulation
    if (isDrifting) {
      setDriftCharge(prev => Math.min(100, prev + 5));
    }

    // Combo timer countdown
    if (comboTimer > 0) {
      setComboTimer(prev => Math.max(0, prev - TICK_SECONDS));
      if (comboTimer - TICK_SECONDS <= 0) {
        resetCombo();
      }
    }

    // Power-up expiration
    const now = performance.now();
    setActivePowerups(prev => prev.filter(p => (now - p.startTime) < p.duration));

    setGearMeter((prev) => {
      const next = prev + 3;
      if (next >= 100) {
        if (!shiftReadyRef.current) {
          setShiftReady(true);
          setStatus('Shift now! Hit accelerate.');
        }
        return 100;
      }
      return next;
    });

    setDistance((prevDistance) => {
      if (gameStateRef.current !== 'running') return prevDistance;

      const nextDistance = prevDistance + speedRef.current * TICK_SECONDS;
      const segmentStart = prevDistance;
      const segmentEnd = nextDistance;

      // Check collisions
      const obstacleHit = items.obstacles.find(
        (item) =>
          item.lane === playerLaneRef.current &&
          item.position >= segmentStart &&
          item.position < segmentEnd
      );

      // Check boosts (with magnet power-up range)
      const hasMagnet = activePowerups.find(p => p.type === 'magnet');
      const boostHit = items.boosts.find(
        (item) => {
          const inLane = hasMagnet ? 
            Math.abs(item.lane - playerLaneRef.current) <= 1 : 
            item.lane === playerLaneRef.current;
          return inLane &&
            item.position >= segmentStart &&
            item.position < segmentEnd;
        }
      );

      // Check power-ups
      const powerupHit = items.powerups.find(
        (item) =>
          item.lane === playerLaneRef.current &&
          item.position >= segmentStart &&
          item.position < segmentEnd &&
          !collectedPowerups.includes(item.id)
      );

      if (obstacleHit) {
        handleCollision();
      } else if (boostHit) {
        handleBoostPickup();
      } else if (powerupHit) {
        handlePowerupPickup(powerupHit.type);
      }

      if (nextDistance >= track.length) {
        distanceRef.current = track.length;
        finishRace();
        return track.length;
      }

      distanceRef.current = nextDistance;
      return nextDistance;
    });
  }, [finishRace, handleBoostPickup, handleCollision, handlePowerupPickup, items, track.length, isDrifting, comboTimer, resetCombo, activePowerups, collectedPowerups]);

  // Calculate motion blur based on speed delta
  const calculateMotionBlur = useCallback(() => {
    const currentSpeed = speedRef.current;
    const delta = currentSpeed - lastSpeedRef.current;
    lastSpeedRef.current = currentSpeed;
    
    // Blur intensity: 0-8px based on speed and acceleration
    const speedFactor = (currentSpeed / track.maxSpeed) * 4;
    const accelFactor = Math.abs(delta) * 2;
    const totalBlur = Math.min(8, speedFactor + accelFactor);
    setBlurAmount(totalBlur);
  }, [track.maxSpeed]);

  // RAF game loop - 60 FPS render, 20 TPS physics
  useEffect(() => {
    if (gameState !== 'running') {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return undefined;
    }

    let lastPhysicsTick = performance.now();

    const gameLoop = (currentTime) => {
      if (gameStateRef.current !== 'running') return;

      // Physics tick at 50ms intervals
      if (currentTime - lastPhysicsTick >= TICK_MS) {
        tick();
        calculateMotionBlur();
        lastPhysicsTick = currentTime;
      }

      rafIdRef.current = requestAnimationFrame(gameLoop);
    };

    rafIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [gameState, tick, calculateMotionBlur]);

  const startRace = useCallback(() => {
    if (gameStateRef.current === 'lights') return;

    const preset = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    const generated = generateItems(preset);

    setTrack(preset);
    setItems(generated);
    setDistance(0);
    setElapsed(0);
    setSpeed(preset.baseSpeed);
    setGearMeter(12);
    setShiftReady(false);
    setPlayerLane(1);
    setStatus(t('speedRacingReady'));
    setCountdownStage('red');
    setGameState('lights');
    speedRef.current = preset.baseSpeed;
    distanceRef.current = 0;
    elapsedRef.current = 0;
    gameStateRef.current = 'lights';
    shiftReadyRef.current = false;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const toYellow = setTimeout(() => setCountdownStage('yellow'), 750);
    const toGreen = setTimeout(() => {
      setCountdownStage('green');
      setGameState('running');
      gameStateRef.current = 'running';
      setStatus('Go! Tunnel incoming.');
    }, 1500);

    timeoutsRef.current.push(toYellow, toGreen);
  }, [t]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'a' || event.key === 'ArrowLeft') {
        event.preventDefault();
        if (!isDrifting && gameStateRef.current === 'running') {
          startDrift(-1);
        } else {
          handleLaneChange(-1);
        }
      }
      if (event.key === 'd' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (!isDrifting && gameStateRef.current === 'running') {
          startDrift(1);
        } else {
          handleLaneChange(1);
        }
      }
      if (event.code === 'Space' || event.key === 'w' || event.key === 'W') {
        event.preventDefault();
        handleShift();
      }
      if (event.key === 'Enter' && (gameStateRef.current === 'idle' || gameStateRef.current === 'finished')) {
        event.preventDefault();
        startRace();
      }
    };

    const handleKeyUp = (event) => {
      if ((event.key === 'a' || event.key === 'ArrowLeft' || event.key === 'd' || event.key === 'ArrowRight') && isDrifting) {
        event.preventDefault();
        endDrift();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleLaneChange, handleShift, startRace, isDrifting, startDrift, endDrift]);

  const handleTrackClick = useCallback(() => {
    if (gameStateRef.current === 'idle' || gameStateRef.current === 'finished') {
      startRace();
    }
  }, [startRace]);

  return (
    <div className="speed-racing-page">
      <div className="meters">
        <div className="meter">
          <div className="meter-label">{t('speedRacingSpeed') || 'Speed'}</div>
          <div className={`meter-bar ${shiftReady ? 'ready' : ''}`}>
            <div
              className="meter-fill speed"
              style={{ width: `${Math.min(100, (speed / track.maxSpeed) * 100)}%` }}
            />
          </div>
          <div className="meter-value">{speed.toFixed(1)}</div>
        </div>
        <div className="meter">
          <div className="meter-label">{t('speedRacingGear') || 'Gear'}</div>
          <div className={`meter-bar ${shiftReady ? 'ready' : ''}`}>
            <div
              className="meter-fill gear"
              style={{ width: `${Math.min(100, gearMeter)}%` }}
            />
          </div>
          <div className="meter-value">{Math.round(gearMeter)}%</div>
        </div>
        <div className="meter">
          <div className="meter-label">{t('speedRacingDistance') || 'Distance'}</div>
          <div className="meter-bar">
            <div
              className="meter-fill distance"
              style={{ width: `${Math.min(100, (distance / track.length) * 100)}%` }}
            />
          </div>
          <div className="meter-value">
            {Math.min(distance, track.length).toFixed(0)} / {track.length}m
          </div>
        </div>
      </div>
      <div className="speed-racing-stage">
        <div
          className={`speed-track theme-${track.theme} ${screenShake ? 'shake' : ''}`}
          style={trackStyle}
          onClick={handleTrackClick}
        >
          <div className="track-hud">
            <div className="lights">
              {['red', 'yellow', 'green'].map((color) => (
                <span
                  key={color}
                  className={`light ${color} ${countdownStage === color || (color === 'green' && gameState === 'running') ? 'on' : ''}`}
                />
              ))}
            </div>
            <div className="status-text">{status}</div>
          </div>

          {/* Combo display */}
          {combo > 0 && (
            <div className="combo-display">
              <div className={`combo-text combo-level-${Math.min(combo, 5)}`}>
                COMBO x{combo}!
              </div>
            </div>
          )}

          {/* Drift charge indicator */}
          {isDrifting && (
            <div className="drift-indicator">
              <div className="drift-label">DRIFT</div>
              <div className="drift-bar">
                <div 
                  className={`drift-fill ${driftCharge >= 70 ? 'perfect' : driftCharge >= 40 ? 'good' : ''}`}
                  style={{ width: `${driftCharge}%` }}
                />
              </div>
              <div className="drift-value">{Math.round(driftCharge)}%</div>
            </div>
          )}

          {/* Power-up HUD */}
          {activePowerups.length > 0 && (
            <div className="powerup-hud">
              {activePowerups.map((powerup, idx) => {
                const elapsed = performance.now() - powerup.startTime;
                const remaining = Math.max(0, (powerup.duration - elapsed) / 1000);
                return (
                  <div 
                    key={`${powerup.type}-${idx}`} 
                    className={`powerup-icon ${powerup.type} ${remaining < 2 ? 'expiring' : ''}`}
                  >
                    <div className="powerup-timer">{remaining.toFixed(1)}s</div>
                  </div>
                );
              })}
            </div>
          )}

        {/* Parallax depth layers */}
        <div className={`parallax layer background theme-${track.theme}`} />
        <div className="parallax layer stars" />
        <div className={`parallax layer texture theme-${track.theme}`} />
        <div className={`parallax layer foreground theme-${track.theme}`} />
        
        {/* Speed lines for motion sensation */}
        <div className="speed-lines">
          {speedLines.map((line) => (
            <div
              key={line.id}
              className="speed-line"
              style={{
                transform: `rotate(${line.angle}deg) translateX(-50%)`,
                height: `${line.length}px`,
                width: `${line.width}px`,
                opacity: line.opacity
              }}
            />
          ))}
        </div>
        
        <div className="corridor">
          <div className="corridor-wall ceiling-wall" />
          <div className="corridor-wall floor-wall" />
          <div className="corridor-wall left-wall" />
          <div className="corridor-wall right-wall" />
          <div className="floor-motion">
            {floorLines.map((line) => (
              <div
                key={line.id}
                className="floor-line"
                style={{
                  top: line.top,
                  left: line.left,
                  width: line.width,
                  opacity: line.opacity
                }}
              />
            ))}
          </div>
        </div>
        <svg className="lane-guides" viewBox="0 0 100 100" preserveAspectRatio="none">
          {laneGuides.map((guide) => (
            <line key={guide.id} x1="50" y1="50" x2={guide.x2} y2="100" />
          ))}
        </svg>
        <div className="track-overlay" />
        <div className="vanish-point" />
        <div className="racer" style={{ left: `${LANE_POSITIONS[playerLane]}%` }}>
          <div className="racer-body">
            <span className="racer-glow" />
          </div>
        </div>
        <div className="track-items">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className={`track-item ${item.type}${item.powerupType ? ` ${item.powerupType}` : ''}`}
              style={{
                left: `${item.left}%`,
                top: `${item.top}%`,
                transform: `translate(-50%, -50%) scale(${item.scale})`,
                opacity: item.opacity
              }}
            />
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};

export default SpeedRacingPage;
