import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './SpeedRacingPage.css';
import roadTexture from './assets/road.png';
import rockTexture from './assets/rock.png';
import speederSprite from './assets/speeder.png';

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

  // Spatial partitioning: bin items into 50m segments for O(1) collision detection
  const SEGMENT_SIZE = 50;
  const segments = {};
  
  [...obstacles, ...boosts, ...powerups].forEach(item => {
    const segmentId = Math.floor(item.position / SEGMENT_SIZE);
    if (!segments[segmentId]) segments[segmentId] = { obstacles: [], boosts: [], powerups: [] };
    
    if (item.id.startsWith('ob-')) segments[segmentId].obstacles.push(item);
    else if (item.id.startsWith('bo-')) segments[segmentId].boosts.push(item);
    else if (item.id.startsWith('pw-')) segments[segmentId].powerups.push(item);
  });

  return { obstacles, boosts, powerups, segments };
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
  
  // Particle effects
  const [particles, setParticles] = useState([]);
  const particleIdRef = useRef(0);
  const particlePoolRef = useRef([]); // Object pool for reuse
  
  // Environmental effects
  const [envParticles, setEnvParticles] = useState([]);
  const envParticleIdRef = useRef(0);
  
  // Screen effects
  const [boostWarp, setBoostWarp] = useState(false);
  const [collisionRipple, setCollisionRipple] = useState(null);

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
    
    // FOV zoom effect at high speeds
    const speedRatio = speed / track.maxSpeed;
    const fovScale = 1.0 + (speedRatio * 0.15); // 1.0 to 1.15

    return {
      laneShiftPct,
      fovScale
    };
  }, [playerLane, speed, track.maxSpeed]);

  const trackStyle = useMemo(() => {
    const { laneShiftPct, fovScale } = corridorMetrics;
    const motionBlurPx = Math.min(8, blurAmount).toFixed(2);
    
    // Floor scrolling based on distance (seamless loop every 200m)
    const scrollOffset = (distance * 0.8) % 200;
    const scrollPct = (scrollOffset / 200) * 100;
    
    return {
      '--lane-shift-pct': `${laneShiftPct}%`,
      '--motion-blur': `${motionBlurPx}px`,
      '--fov-scale': fovScale.toFixed(3),
      '--scroll-offset': `${scrollPct.toFixed(2)}%`,
      '--road-texture': `url(${roadTexture})`,
      '--rock-texture': `url(${rockTexture})`,
      '--speeder-sprite': `url(${speederSprite})`
    };
  }, [corridorMetrics, blurAmount, distance]);

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

  const laneGuides = useMemo(() => {
    const { laneShiftPct } = corridorMetrics;
    return LANE_POSITIONS.map((lanePct, index) => ({
      id: `lane-guide-${index}`,
      x2: lanePct + laneShiftPct
    }));
  }, [corridorMetrics]);

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

  const spawnParticles = useCallback((type, count, fromLane) => {
    const newParticles = [];
    const baseLeft = LANE_POSITIONS[fromLane];
    
    for (let i = 0; i < count; i++) {
      // Try to reuse from pool first
      let particle = particlePoolRef.current.pop();
      
      if (!particle) {
        // Create new if pool empty
        particle = {
          id: `particle-${type}-${particleIdRef.current++}`,
          type,
          left: 0,
          top: 0,
          angle: 0,
          speed: 1,
          size: 8,
          lifetime: 0
        };
      }
      
      // Reset properties
      particle.type = type;
      particle.left = baseLeft + (Math.random() - 0.5) * 10;
      particle.top = 85;
      particle.angle = (Math.random() - 0.5) * 120;
      particle.speed = 0.5 + Math.random() * 1.5;
      particle.size = type === 'boost' ? 8 + Math.random() * 8 : 6 + Math.random() * 6;
      particle.lifetime = 0;
      
      newParticles.push(particle);
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    // Return to pool after animation
    setTimeout(() => {
      setParticles(prev => {
        const remaining = prev.filter(p => !newParticles.find(np => np.id === p.id));
        // Add used particles back to pool
        particlePoolRef.current.push(...newParticles.slice(0, Math.min(20 - particlePoolRef.current.length, newParticles.length)));
        return remaining;
      });
    }, 1000);
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
    
    // Spawn collision debris particles
    spawnParticles('debris', 8, playerLane);
    
    // Trigger collision ripple effect
    setCollisionRipple({ x: 50, y: 85, timestamp: performance.now() });
    setTimeout(() => setCollisionRipple(null), 800);
    
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
  }, [track.baseSpeed, activePowerups, resetCombo, spawnParticles, playerLane]);

  const handleBoostPickup = useCallback(() => {
    // Spawn boost trail particles
    spawnParticles('boost', 6, playerLane);
    
    // Trigger fisheye warp effect
    setBoostWarp(true);
    setTimeout(() => setBoostWarp(false), 300);
    
    const comboBonus = combo > 0 ? combo * 1.5 : 0;
    setSpeed((prev) => {
      const surged = Math.min(track.maxSpeed, prev + 7 + comboBonus);
      speedRef.current = surged;
      return surged;
    });
    setStatus('Pad boost! Repulsors flare.');
    addComboAction('boost');
  }, [track.maxSpeed, combo, addComboAction, spawnParticles, playerLane]);

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

      // Spatial partitioning: check only relevant segments (O(1) instead of O(n))
      const SEGMENT_SIZE = 50;
      const currentSegment = Math.floor(prevDistance / SEGMENT_SIZE);
      const nextSegment = Math.floor(nextDistance / SEGMENT_SIZE);
      
      let obstacleHit = null;
      let boostHit = null;
      let powerupHit = null;
      
      // Check current and next segments only
      for (let seg = currentSegment; seg <= nextSegment + 1; seg++) {
        const segment = items.segments?.[seg];
        if (!segment) continue;
        
        // Check obstacles
        if (!obstacleHit) {
          obstacleHit = segment.obstacles.find(
            (item) =>
              item.lane === playerLaneRef.current &&
              item.position >= segmentStart &&
              item.position < segmentEnd
          );
        }
        
        // Check boosts (with magnet power-up range)
        if (!boostHit) {
          const hasMagnet = activePowerups.find(p => p.type === 'magnet');
          boostHit = segment.boosts.find(
            (item) => {
              const inLane = hasMagnet ? 
                Math.abs(item.lane - playerLaneRef.current) <= 1 : 
                item.lane === playerLaneRef.current;
              return inLane &&
                item.position >= segmentStart &&
                item.position < segmentEnd;
            }
          );
        }
        
        // Check power-ups
        if (!powerupHit) {
          powerupHit = segment.powerups.find(
            (item) =>
              item.lane === playerLaneRef.current &&
              item.position >= segmentStart &&
              item.position < segmentEnd &&
              !collectedPowerups.includes(item.id)
          );
        }
      }

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

  // Environmental particle effects based on track theme
  useEffect(() => {
    if (gameState !== 'running') return;
    
    const interval = setInterval(() => {
      const id = envParticleIdRef.current++;
      let particle;
      
      if (track.theme === 'dune') {
        // Sand particles drifting across
        particle = {
          id: `env-${id}`,
          type: 'sand',
          left: -5,
          top: 20 + Math.random() * 60,
          size: 3 + Math.random() * 5,
          speed: 0.5 + Math.random() * 1,
          opacity: 0.3 + Math.random() * 0.4
        };
      } else if (track.theme === 'cave') {
        // Bubbles rising
        particle = {
          id: `env-${id}`,
          type: 'bubble',
          left: 10 + Math.random() * 80,
          top: 110,
          size: 4 + Math.random() * 8,
          speed: 0.3 + Math.random() * 0.7,
          opacity: 0.2 + Math.random() * 0.3
        };
      }
      
      if (particle) {
        setEnvParticles(prev => [...prev, particle]);
        
        // Remove after crossing screen
        setTimeout(() => {
          setEnvParticles(prev => prev.filter(p => p.id !== particle.id));
        }, 8000);
      }
    }, 1500); // Spawn every 1.5s
    
    return () => clearInterval(interval);
  }, [gameState, track.theme]);

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
          className={`speed-track theme-${track.theme} ${screenShake ? 'shake' : ''} ${boostWarp ? 'boost-warp' : ''}`}
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

        <div className="corridor">
          <div className="corridor-wall ceiling-wall" />
          <div className="corridor-wall floor-wall" />
          <div className="corridor-wall left-wall" />
          <div className="corridor-wall right-wall" />
        </div>
        <svg className="lane-guides" viewBox="0 0 100 100" preserveAspectRatio="none">
          {laneGuides.map((guide) => (
            <line key={guide.id} x1="50" y1="50" x2={guide.x2} y2="100" />
          ))}
        </svg>
        <div className="track-overlay" />
        <div className="vanish-point" />
        
        {/* Collision ripple effect */}
        {collisionRipple && (
          <div
            className="collision-ripple"
            style={{
              left: `${collisionRipple.x}%`,
              top: `${collisionRipple.y}%`
            }}
          />
        )}
        
        {/* Environmental particles */}
        {envParticles.map((particle) => (
          <div
            key={particle.id}
            className={`env-particle ${particle.type}`}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity
            }}
          />
        ))}
        
        <div 
          className={`racer${isDrifting ? ' drifting' : ''}${driftDirection < 0 ? ' drift-left' : driftDirection > 0 ? ' drift-right' : ''}`} 
          style={{ left: `${LANE_POSITIONS[playerLane]}%` }}
        >
          <div className="racer-body" />
        </div>
        
        {/* Boost and collision particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`particle ${particle.type}`}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              '--angle': `${particle.angle}deg`,
              '--speed': particle.speed
            }}
          />
        ))}
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
