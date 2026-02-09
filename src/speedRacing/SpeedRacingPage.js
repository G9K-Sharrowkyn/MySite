import React, { useEffect, useRef, useState } from 'react';
import './SpeedRacingPage.css';
import * as BABYLON from '@babylonjs/core';

// Track configurations inspired by KOTOR
const TRACKS = {
  taris: {
    name: 'Taris Circuit',
    length: 8000,
    targetTime: 120,
    boostPadCount: 40,
    obstacleCount: 30
  }
};

// Game constants
const MAX_GEAR = 10;
const GEAR_MAX_SPEEDS = [5, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200]; // Gear 0 = 5 km/h idle

const SpeedRacingPage = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('ready'); // ready, countdown, racing, finished
  const [currentGear, setCurrentGear] = useState(0);
  const [gearMeter, setGearMeter] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [raceTime, setRaceTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [targetTime] = useState(TRACKS.taris.targetTime);
  const [shiftReady, setShiftReady] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [countdownLights, setCountdownLights] = useState(0); // 0-3
  const [isJumping, setIsJumping] = useState(false);
  
  // Game refs
  const speedRef = useRef(0);
  const gearRef = useRef(0);
  const currentXRef = useRef(0); // Full X position (-7 to +7)
  const raceTimeRef = useRef(0);
  const trackObjectsRef = useRef({ boostPads: [], obstacles: [] });
  const jumpHeightRef = useRef(0);
  const isJumpingRef = useRef(false);
  const gearHeatRef = useRef(0);
  const isRacingRef = useRef(false);
  const gameStateRef = useRef('ready'); // Track gameState for handlers
  
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current; // Store ref for cleanup

    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.01, 0.01, 0.05, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    scene.fogDensity = 0.008;
    scene.fogColor = new BABYLON.Color3(0.01, 0.01, 0.05);

    // ===== FIRST-PERSON CAMERA (KOTOR style from cockpit) =====
    const camera = new BABYLON.FreeCamera(
      'firstPersonCamera',
      new BABYLON.Vector3(0, 1.2, 0),
      scene
    );
    camera.rotation = new BABYLON.Vector3(0, 0, 0);
    camera.fov = 1.2; // Wider FOV for speed feeling
    camera.minZ = 0.1;
    camera.maxZ = 500;

    // ===== LIGHTING =====
    const ambientLight = new BABYLON.HemisphericLight(
      'ambient',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    ambientLight.intensity = 0.4;
    
    const directionalLight = new BABYLON.DirectionalLight(
      'sun',
      new BABYLON.Vector3(0.5, -1, 1),
      scene
    );
    directionalLight.intensity = 0.6;
    directionalLight.diffuse = new BABYLON.Color3(0.8, 0.85, 1);

    // ===== TRACK SURFACE (straight line) =====
    const trackLength = TRACKS.taris.length;
    const trackSegments = [];
    const segmentLength = 50;
    const segmentCount = Math.ceil(trackLength / segmentLength) + 10;

    for (let i = 0; i < segmentCount; i++) {
      const segment = BABYLON.MeshBuilder.CreateGround(
        `track_${i}`,
        { width: 15, height: segmentLength },
        scene
      );
      segment.position.z = i * segmentLength;
      
      const trackMat = new BABYLON.StandardMaterial(`trackMat_${i}`, scene);
      trackMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);
      trackMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.15);
      segment.material = trackMat;
      
      trackSegments.push(segment);
    }

    // ===== TRACK WALLS (side barriers) =====
    const wallHeight = 3;
    for (let i = 0; i < segmentCount; i++) {
      const leftWall = BABYLON.MeshBuilder.CreateBox(
        `leftWall_${i}`,
        { width: 1, height: wallHeight, depth: segmentLength },
        scene
      );
      leftWall.position = new BABYLON.Vector3(-8, wallHeight / 2, i * segmentLength);
      
      const rightWall = leftWall.clone(`rightWall_${i}`);
      rightWall.position.x = 8;
      
      const wallMat = new BABYLON.StandardMaterial(`wallMat_${i}`, scene);
      wallMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
      wallMat.emissiveColor = new BABYLON.Color3(0.05, 0.08, 0.15);
      leftWall.material = wallMat;
      rightWall.material = wallMat;
    }

    // ===== BOOST PADS (glowing accelerators) - STATYCZNE POZYCJE =====
    const boostPads = [];
    const lanes = [-6, -2, 2, 6]; // Four lanes spread across track
    
    // Statyczne pozycje boosterów (co ~200m)
    for (let i = 0; i < TRACKS.taris.boostPadCount; i++) {
      const zPos = 200 + i * 200;
      const lane = lanes[i % lanes.length];
      
      const pad = BABYLON.MeshBuilder.CreateBox(
        `boost_${i}`,
        { width: 3, height: 0.3, depth: 4 },
        scene
      );
      pad.position = new BABYLON.Vector3(lane, 0.15, zPos);
      
      const boostMat = new BABYLON.StandardMaterial(`boostMat_${i}`, scene);
      boostMat.emissiveColor = new BABYLON.Color3(0, 1, 0.8);
      boostMat.diffuseColor = new BABYLON.Color3(0, 0.5, 0.4);
      pad.material = boostMat;
      
      // Glow effect
      const glow = new BABYLON.PointLight(
        `boostLight_${i}`,
        new BABYLON.Vector3(lane, 1, zPos),
        scene
      );
      glow.diffuse = new BABYLON.Color3(0, 1, 0.8);
      glow.intensity = 5;
      glow.range = 15;
      
      boostPads.push({ mesh: pad, xPos: lane, zPos, collected: false });
    }

    // ===== OBSTACLES (debris/rocks) - STATYCZNE POZYCJE =====
    const obstacles = [];
    
    // Statyczne pozycje przeszkód (co ~250m, offsetowane od boosterów)
    for (let i = 0; i < TRACKS.taris.obstacleCount; i++) {
      const zPos = 350 + i * 250;
      const lane = lanes[(i + 2) % lanes.length]; // Offset from boosters
      
      const obstacle = BABYLON.MeshBuilder.CreateIcoSphere(
        `obstacle_${i}`,
        { radius: 1.2, subdivisions: 2 },
        scene
      );
      obstacle.position = new BABYLON.Vector3(lane, 1.2, zPos);
      
      const obsMat = new BABYLON.StandardMaterial(`obsMat_${i}`, scene);
      obsMat.diffuseColor = new BABYLON.Color3(0.3, 0.25, 0.2);
      obsMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      obstacle.material = obsMat;
      
      obstacles.push({ mesh: obstacle, xPos: lane, zPos, hit: false });
    }

    trackObjectsRef.current = { boostPads, obstacles };

    // ===== SWOOP BIKE (invisible, we're IN it - first person) =====
    // Just a reference point for position
    const swoop = new BABYLON.TransformNode('swoop', scene);
    swoop.position = new BABYLON.Vector3(0, 0, 0);

    // Camera follows swoop position
    camera.parent = swoop;

    // ===== ENGINE SOUND SIMULATION (visual feedback) =====
    const engineGlow = BABYLON.MeshBuilder.CreateSphere(
      'engineGlow',
      { diameter: 0.3 },
      scene
    );
    engineGlow.parent = camera;
    engineGlow.position = new BABYLON.Vector3(0, -0.5, 1);
    
    const glowMat = new BABYLON.StandardMaterial('glowMat', scene);
    glowMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    glowMat.disableLighting = true;
    engineGlow.material = glowMat;
    engineGlow.isVisible = false; // Hidden in first person

    // ===== GAME STATE =====
    let currentSpeed = 2; // Start from 2 km/h
    let currentGear = 0;
    let gearHeat = 0;
    let currentX = 0; // Full X position (-7 to +7)
    let travelDistance = 0;
    let raceStartTime = 0;
    let isRacing = false;
    let countdownStep = 0;
    let jumpHeight = 0;
    let isJumping = false;
    let jumpVelocity = 0;

    // Game constants (use globals defined above)
    const GEAR_ACCELERATION = [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]; // Gear 0 has slow accel
    const GEAR_HEAT_AUTO_RATE = 100 / 15; // 100% in 15 seconds
    const JUMP_STRENGTH = 8;
    const GRAVITY = 20;

    // ===== START COUNTDOWN SYSTEM =====
    const startCountdown = () => {
      if (countdownStep > 0) return; // Already started
      
      setGameState('countdown');
      gameStateRef.current = 'countdown';
      countdownStep = 1;
      setCountdownLights(1);
      
      setTimeout(() => {
        countdownStep = 2;
        setCountdownLights(2);
        
        setTimeout(() => {
          countdownStep = 3;
          setCountdownLights(3);
          
          setTimeout(() => {
            // GO!
            setGameState('racing');
            gameStateRef.current = 'racing';
            countdownStep = 0;
            isRacing = true;
            isRacingRef.current = true;
            raceStartTime = performance.now();
          }, 600);
        }, 600);
      }, 600);
    };

    // ===== MOUSE CONTROLS =====
    const handleMouseDown = (e) => {
      if (gameStateRef.current === 'ready') return;
      
      if (e.button === 0) { // LEFT CLICK - Shift gear
        // Gear 0 -> 1 always allowed (start), others need full heat
        const canShift = gearRef.current === 0 || gearHeatRef.current >= 100;
        
        if (isRacingRef.current && gearRef.current < MAX_GEAR && canShift) {
          currentGear++;
          gearRef.current = currentGear;
          gearHeat = 0;
          gearHeatRef.current = 0;
          setCurrentGear(currentGear);
          setShiftReady(false);
          setGearMeter(0);
        }
      } else if (e.button === 2) { // RIGHT CLICK - Jump
        e.preventDefault();
        if (isRacingRef.current && !isJumpingRef.current) {
          isJumping = true;
          jumpVelocity = JUMP_STRENGTH;
          isJumpingRef.current = true;
          setIsJumping(true);
        }
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    // ===== KEYBOARD CONTROLS =====
    const keys = {};
    
    const handleKeyDown = (e) => {
      keys[e.key.toLowerCase()] = true;
      
      // Start countdown with ENTER
      if (e.key === 'Enter' && gameStateRef.current === 'ready') {
        startCountdown();
        
        // Reset game state
        currentSpeed = 2;
        currentGear = 0;
        gearHeat = 0;
        travelDistance = 0;
        currentX = 0;
        jumpHeight = 0;
        jumpVelocity = 0;
        isJumping = false;
        swoop.position.set(0, 0, 0);
        speedRef.current = 2;
        gearRef.current = 0;
        gearHeatRef.current = 0;
        raceTimeRef.current = 0;
        currentXRef.current = 0;
        isJumpingRef.current = false;
        isRacingRef.current = false;
        gameStateRef.current = 'ready';
        setIsJumping(false);
        
        // Reset boost pads and obstacles
        boostPads.forEach(pad => { 
          pad.collected = false;
          pad.mesh.isVisible = true;
        });
        obstacles.forEach(obs => { 
          obs.hit = false;
          obs.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
        });
      }

      // Restart after finish
      if (e.key === 'Enter' && gameStateRef.current === 'finished') {
        setGameState('ready');
        gameStateRef.current = 'ready';
        setCountdownLights(0);
      }
      
      // GEAR SHIFT (Space or Shift or LMB)
      if ((e.key === ' ' || e.key === 'Shift') && isRacingRef.current) {
        e.preventDefault();
        
        // Gear 0 -> 1 always allowed (start), others need full heat
        const canShift = gearRef.current === 0 || gearHeatRef.current >= 100;
        
        if (gearRef.current < MAX_GEAR && canShift) {
          currentGear++;
          gearRef.current = currentGear;
          gearHeat = 0;
          gearHeatRef.current = 0;
          setCurrentGear(currentGear);
          setShiftReady(false);
          setGearMeter(0);
        }
      }

      // JUMP (Space or RMB)
      if (e.key === ' ' && isRacingRef.current && !isJumpingRef.current) {
        e.preventDefault();
        isJumping = true;
        jumpVelocity = JUMP_STRENGTH;
        isJumpingRef.current = true;
        setIsJumping(true);
      }
    };

    const handleKeyUp = (e) => {
      keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ===== GAME LOOP =====
    let lastTime = performance.now();
    
    engine.runRenderLoop(() => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isRacing && gameState === 'racing') {
        // Update race time
        const elapsed = (currentTime - raceStartTime) / 1000;
        raceTimeRef.current = elapsed;
        setRaceTime(elapsed);

        // ===== AUTO-GROWING GEAR HEAT =====
        if (currentGear > 0 && currentGear < MAX_GEAR) {
          gearHeat = Math.min(100, gearHeat + GEAR_HEAT_AUTO_RATE * deltaTime);
          gearHeatRef.current = gearHeat;
          setGearMeter(gearHeat);
          
          if (gearHeat >= 100) {
            setShiftReady(true);
          }
        }

        // ===== ACCELERATION =====
        const maxSpeedForGear = GEAR_MAX_SPEEDS[currentGear];
        const accel = GEAR_ACCELERATION[currentGear];
        
        if (currentSpeed < maxSpeedForGear) {
          currentSpeed = Math.min(maxSpeedForGear, currentSpeed + accel * deltaTime);
        } else if (currentSpeed > maxSpeedForGear) {
          // Gentle deceleration when over max speed
          currentSpeed = Math.max(maxSpeedForGear, currentSpeed - deltaTime * 15);
        }

        speedRef.current = currentSpeed;
        setSpeed(currentSpeed.toFixed(0));

        // ===== STEERING (Full X freedom: -7 to +7) =====
        const steerSpeed = 12;
        if (keys['arrowleft'] || keys['a']) {
          currentX = Math.max(-7, currentX - steerSpeed * deltaTime);
        }
        if (keys['arrowright'] || keys['d']) {
          currentX = Math.min(7, currentX + steerSpeed * deltaTime);
        }
        currentXRef.current = currentX;

        // ===== JUMP PHYSICS =====
        if (isJumping) {
          jumpVelocity -= GRAVITY * deltaTime;
          jumpHeight += jumpVelocity * deltaTime;
          
          if (jumpHeight <= 0) {
            jumpHeight = 0;
            isJumping = false;
            jumpVelocity = 0;
            isJumpingRef.current = false;
            setIsJumping(false);
          }
          
          jumpHeightRef.current = jumpHeight;
        }

        // ===== MOVEMENT =====
        const moveSpeed = currentSpeed * deltaTime * 0.28; // Convert km/h to m/s (~divide by 3.6)
        travelDistance += moveSpeed;
        swoop.position.z += moveSpeed;
        swoop.position.x = currentX;
        swoop.position.y = jumpHeight;
        
        setDistance(Math.floor(travelDistance));

        // ===== COLLISION DETECTION =====
        const swoopZ = swoop.position.z;
        const swoopX = swoop.position.x;
        const swoopY = swoop.position.y;
        
        // Check boost pads (only if not jumping)
        if (!isJumping || swoopY < 0.5) {
          boostPads.forEach(pad => {
            if (!pad.collected && 
                Math.abs(swoopZ - pad.zPos) < 3 && 
                Math.abs(swoopX - pad.xPos) < 2.5) {
              // HIT BOOST PAD!
              pad.collected = true;
              pad.mesh.isVisible = false;
              
              // Add 25% to gear heat
              gearHeat = Math.min(100, gearHeat + 25);
              setGearMeter(gearHeat);
              
              if(gearHeat >= 100) {
                setShiftReady(true);
              }
              
              setBoostActive(true);
              setTimeout(() => setBoostActive(false), 300);
            }
          });
        }

        // Check obstacles (only if not jumping over them)
        if (!isJumping || swoopY < 1.5) {
          obstacles.forEach(obs => {
            if (!obs.hit && 
                Math.abs(swoopZ - obs.zPos) < 2.5 && 
                Math.abs(swoopX - obs.xPos) < 2.5) {
              // HIT OBSTACLE!
              obs.hit = true;
              
              // 50% speed reduction
              currentSpeed = currentSpeed * 0.5;
              
              // Calculate new gear based on speed
              let newGear = 0;
              for (let g = 1; g <= MAX_GEAR; g++) {
                if (currentSpeed >= GEAR_MAX_SPEEDS[g - 1] && currentSpeed < GEAR_MAX_SPEEDS[g]) {
                  newGear = g - 1;
                  break;
                } else if (currentSpeed >= GEAR_MAX_SPEEDS[MAX_GEAR]) {
                  newGear = MAX_GEAR;
                  break;
                }
              }
              
              currentGear = newGear;
              gearRef.current = newGear;
              setCurrentGear(newGear);
              gearHeat = 0;
              setGearMeter(0);
              setShiftReady(false);
              
              // Visual feedback
              obs.mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
              setTimeout(() => {
                obs.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
              }, 500);
            }
          });
        }

        // ===== FINISH LINE =====
        if (travelDistance >= TRACKS.taris.length) {
          isRacing = false;
          isRacingRef.current = false;
          setGameState('finished');
          gameStateRef.current = 'finished';
          
          const finalTime = raceTimeRef.current;
          if (!bestTime || finalTime < bestTime) {
            setBestTime(finalTime);
          }
        }

        // ===== CAMERA EFFECTS =====
        // Slight head bob based on speed
        const bob = Math.sin(currentTime * 0.01 * currentSpeed) * 0.03;
        camera.position.y = 1.2 + bob;
      }

      scene.render();
    });

    // Window resize
    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      engine.dispose();
    };
  }, [bestTime, gameState]);

  const formatTime = (seconds) => {
    if (!seconds) return '0.00';
    return seconds.toFixed(2);
  };

  return (
    <div className="speed-racing-page">
      <div className="canvas-container">
        <canvas ref={canvasRef} />
        
        {/* KOTOR-Style HUD */}
        <div className="hud-overlay">
          
          {/* Top Stats */}
          <div className="hud-top-left">
            {/* START LIGHTS */}
            {(gameState === 'countdown' || gameState === 'ready') && (
              <div className="start-lights">
                <div className={`light ${countdownLights >= 1 ? 'green' : 'red'}`}></div>
                <div className={`light ${countdownLights >= 2 ? 'green' : 'red'}`}></div>
                <div className={`light ${countdownLights >= 3 ? 'green' : 'red'}`}></div>
              </div>
            )}
            
            {gameState === 'racing' && (
              <>
                <div className="hud-stat">
                  <span className="stat-label">TIME</span>
                  <span className="stat-value">{formatTime(raceTime)}</span>
                </div>
                <div className="hud-stat">
                  <span className="stat-label">TARGET</span>
                  <span className="stat-value target">{formatTime(targetTime)}</span>
                </div>
                {bestTime && (
                  <div className="hud-stat">
                    <span className="stat-label">BEST</span>
                    <span className="stat-value best">{formatTime(bestTime)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="hud-top-right">
            {gameState === 'racing' && (
              <div className="hud-stat">
                <span className="stat-label">DISTANCE</span>
                <span className="stat-value">{distance}m</span>
              </div>
            )}
          </div>

          {/* Bottom - Speed & Gear Meter (KOTOR Style) */}
          {gameState === 'racing' && (
            <div className="hud-bottom">
              <div className="speed-display">
                <div className="speed-label">SPEED</div>
                <div className="speed-value">{speed}</div>
              </div>

              <div className="gear-meter-container">
                <div className="gear-label">
                  GEAR {currentGear}/{MAX_GEAR}
                  {shiftReady && <span className="shift-indicator">▲ SHIFT! ▲</span>}
                </div>
                <div className="gear-meter">
                  <div 
                    className={`gear-fill ${shiftReady ? 'ready' : ''} ${boostActive ? 'boost' : ''}`}
                    style={{ width: `${gearMeter}%` }}
                  />
                  {shiftReady && <div className="shift-zone" />}
                </div>
                <div className="gear-hint">
                  {currentGear === 0 ? 'Press SHIFT or LMB to start!' : ''}
                  {currentGear > 0 && !shiftReady && gearMeter < 100 ? 'Building power...' : ''}
                  {shiftReady && currentGear < MAX_GEAR ? 'Press SHIFT or LMB!' : ''}
                  {currentGear === MAX_GEAR ? 'MAX GEAR!' : ''}
                </div>
                {isJumping && (
                  <div className="jump-indicator">⬆ JUMPING ⬆</div>
                )}
              </div>
            </div>
          )}

          {/* Start Screen */}
          {gameState === 'ready' && (
            <div className="start-screen">
              <h1>SWOOP RACING</h1>
              <h2>Taris Circuit</h2>
              <div className="race-info">
                <p>Distance: <span className="highlight">8000m</span></p>
                <p>Target Time: <span className="highlight">{formatTime(targetTime)}s</span></p>
                {bestTime && (
                  <p>Your Best: <span className="highlight best">{formatTime(bestTime)}s</span></p>
                )}
              </div>
              <div className="controls">
                <h3>CONTROLS</h3>
                <p><kbd>ENTER</kbd> START COUNTDOWN (Watch the lights!)</p>
                <p><kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> STEER (Full freedom)</p>
                <p><kbd>SHIFT</kbd> or <kbd>LMB</kbd> SHIFT GEAR (when meter full)</p>
                <p><kbd>SPACE</kbd> or <kbd>RMB</kbd> JUMP (avoid obstacles!)</p>
              </div>
              <div className="race-tips">
                <h3>RACING TIPS</h3>
                <p>• Start in gear 0 (2 km/h), shift when meter fills</p>
                <p>• 10 gears total: 0 → 200 km/h (20 km/h per gear)</p>
                <p>• Boosters add +25% to your gear meter</p>
                <p>• Obstacles cut your speed in HALF</p>
                <p>• Jump over obstacles to avoid slowdown</p>
                <p>• Gear meter fills automatically in 15 seconds</p>
              </div>
              <div className="press-start">Press ENTER to begin</div>
            </div>
          )}

          {/* Finish Screen */}
          {gameState === 'finished' && (
            <div className="finish-screen">
              <h1>RACE COMPLETE!</h1>
              <div className="final-stats">
                <div className="final-time">
                  <span className="label">Your Time:</span>
                  <span className="value">{formatTime(raceTime)}s</span>
                </div>
                <div className="final-target">
                  <span className="label">Target:</span>
                  <span className="value">{formatTime(targetTime)}s</span>
                </div>
                {raceTime <= targetTime ? (
                  <div className="result-message victory">
                    ★ VICTORY! TARGET BEATEN! ★
                  </div>
                ) : (
                  <div className="result-message">
                    Try again to beat the target time
                  </div>
                )}
              </div>
              <div className="press-start">Press ENTER to race again</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeedRacingPage;
