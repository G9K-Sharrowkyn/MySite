import React, { useEffect, useRef, useState, useCallback } from 'react';
import './SpeedRacingPage.css';
import * as BABYLON from '@babylonjs/core';

// Track configurations inspired by KOTOR
const TRACKS = {
  taris: {
    name: 'Taris Circuit',
    length: 800,
    targetTime: 28.5,
    boostPadCount: 25,
    obstacleCount: 20
  }
};

const SpeedRacingPage = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('ready'); // ready, countdown, racing, finished
  const [currentGear, setCurrentGear] = useState(1);
  const [gearMeter, setGearMeter] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [raceTime, setRaceTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [targetTime] = useState(TRACKS.taris.targetTime);
  const [shiftReady, setShiftReady] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  const [boostActive, setBoostActive] = useState(false);
  
  // Game refs
  const speedRef = useRef(0);
  const gearRef = useRef(1);
  const currentLaneRef = useRef(0); // -1, 0, 1
  const raceTimeRef = useRef(0);
  const isAcceleratingRef = useRef(false);
  const trackObjectsRef = useRef({ boostPads: [], obstacles: [] });
  
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new BABYLON.Engine(canvasRef.current, true, {
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

    // ===== BOOST PADS (glowing accelerators) =====
    const boostPads = [];
    const lanes = [-4, 0, 4]; // Left, Center, Right
    
    for (let i = 0; i < TRACKS.taris.boostPadCount; i++) {
      const zPos = 80 + i * 30 + Math.random() * 10;
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      
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
      
      boostPads.push({ mesh: pad, lane, zPos, collected: false });
    }

    // ===== OBSTACLES (debris/rocks) =====
    const obstacles = [];
    
    for (let i = 0; i < TRACKS.taris.obstacleCount; i++) {
      const zPos = 100 + i * 35 + Math.random() * 15;
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      
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
      
      obstacles.push({ mesh: obstacle, lane, zPos, hit: false });
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
    let currentSpeed = 0;
    let currentGear = 1;
    let gearHeat = 0;
    let currentLane = 0;
    let travelDistance = 0;
    let raceStartTime = 0;
    let isRacing = false;
    let isAccelerating = false;

    // Speed constants per gear
    const GEAR_MAX_SPEEDS = [0, 40, 80, 120, 160, 200]; // Gear 0 (unused), 1-5
    const GEAR_ACCELERATION = [0, 8, 6, 5, 4, 3]; // Acceleration rate per gear
    const MAX_GEAR = 5;

    // ===== KEYBOARD CONTROLS =====
    const keys = {};
    
    const handleKeyDown = (e) => {
      keys[e.key.toLowerCase()] = true;
      
      // Start race with ENTER
      if (e.key === 'Enter' && !isRacing) {
        isRacing = true;
        isAccelerating = true;
        isAcceleratingRef.current = true;
        raceStartTime = performance.now();
        setGameState('racing');
        
        // Reset
        currentSpeed = 0;
        currentGear = 1;
        gearHeat = 0;
        travelDistance = 0;
        swoop.position.z = 0;
        camera.position.z = 0;
        speedRef.current = 0;
        gearRef.current = 1;
        raceTimeRef.current = 0;
        
        // Reset boost pads and obstacles
        boostPads.forEach(pad => { pad.collected = false; });
        obstacles.forEach(obs => { obs.hit = false; });
      }
      
      // Lane changes
      if ((e.key === 'ArrowLeft' || e.key === 'a') && isRacing) {
        currentLane = Math.max(-1, currentLane - 1);
        currentLaneRef.current = currentLane;
      }
      if ((e.key === 'ArrowRight' || e.key === 'd') && isRacing) {
        currentLane = Math.min(1, currentLane + 1);
        currentLaneRef.current = currentLane;
      }
      
      // GEAR SHIFT (Space or W)
      if ((e.key === ' ' || e.key === 'w') && isRacing) {
        e.preventDefault();
        
        if (gearHeat >= 100 && currentGear < MAX_GEAR) {
          // Perfect shift!
          currentGear++;
          gearRef.current = currentGear;
          gearHeat = 0;
          setCurrentGear(currentGear);
          setShiftReady(false);
        }
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

      if (isRacing) {
        // Update race time
        const elapsed = (currentTime - raceStartTime) / 1000;
        raceTimeRef.current = elapsed;
        setRaceTime(elapsed);

        // ===== ACCELERATION & GEAR HEAT =====
        if (isAccelerating) {
          const maxSpeedForGear = GEAR_MAX_SPEEDS[currentGear];
          const accel = GEAR_ACCELERATION[currentGear];
          
          if (currentSpeed < maxSpeedForGear) {
            currentSpeed = Math.min(maxSpeedForGear, currentSpeed + accel * deltaTime * 10);
          }
          
          // Heat builds up as we approach max speed
          if (currentSpeed >= maxSpeedForGear * 0.8) {
            gearHeat = Math.min(100, gearHeat + deltaTime * 50);
            setGearMeter(gearHeat);
            
            if (gearHeat >= 100) {
              setShiftReady(true);
            }
          }
        } else {
          // Coasting/decelerating
          currentSpeed = Math.max(0, currentSpeed - deltaTime * 20);
        }

        speedRef.current = currentSpeed;
        setSpeed(currentSpeed.toFixed(0));

        // ===== MOVEMENT =====
        const moveSpeed = currentSpeed * deltaTime;
        travelDistance += moveSpeed;
        swoop.position.z += moveSpeed;
        
        setDistance(Math.floor(travelDistance));

        // Move to lane
        const targetX = currentLane * 4;
        swoop.position.x += (targetX - swoop.position.x) * deltaTime * 8;

        // ===== COLLISION DETECTION =====
        const swoopZ = swoop.position.z;
        const swoopX = swoop.position.x;
        
        // Check boost pads
        boostPads.forEach(pad => {
          if (!pad.collected && 
              Math.abs(swoopZ - pad.zPos) < 3 && 
              Math.abs(swoopX - pad.lane) < 2) {
            // HIT BOOST PAD!
            pad.collected = true;
            pad.mesh.isVisible = false;
            
            // Speed surge
            currentSpeed = Math.min(
              GEAR_MAX_SPEEDS[MAX_GEAR],
              currentSpeed + 30
            );
            
            setBoostActive(true);
            setTimeout(() => setBoostActive(false), 300);
          }
        });

        // Check obstacles
        obstacles.forEach(obs => {
          if (!obs.hit && 
              Math.abs(swoopZ - obs.zPos) < 2 && 
              Math.abs(swoopX - obs.lane) < 2) {
            // HIT OBSTACLE!
            obs.hit = true;
            
            // Slowdown
            currentSpeed = Math.max(0, currentSpeed * 0.6);
            
            // Visual feedback
            obs.mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
            setTimeout(() => {
              obs.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
            }, 500);
          }
        });

        // ===== FINISH LINE =====
        if (travelDistance >= TRACKS.taris.length) {
          isRacing = false;
          setGameState('finished');
          
          const finalTime = raceTimeRef.current;
          if (!bestTime || finalTime < bestTime) {
            setBestTime(finalTime);
          }
        }

        // ===== CAMERA EFFECTS =====
        // Slight head bob based on speed
        const bob = Math.sin(currentTime * 0.01 * currentSpeed) * 0.05;
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
      engine.dispose();
    };
  }, [bestTime]);

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
          </div>

          <div className="hud-top-right">
            <div className="hud-stat">
              <span className="stat-label">DISTANCE</span>
              <span className="stat-value">{distance}m</span>
            </div>
          </div>

          {/* Bottom - Speed & Gear Meter (KOTOR Style) */}
          <div className="hud-bottom">
            <div className="speed-display">
              <div className="speed-label">SPEED</div>
              <div className="speed-value">{speed}</div>
            </div>

            <div className="gear-meter-container">
              <div className="gear-label">
                GEAR {currentGear}
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
                {!shiftReady && gearMeter > 50 ? 'Building heat...' : ''}
                {shiftReady ? 'Press SPACE to shift!' : ''}
              </div>
            </div>
          </div>

          {/* Start Screen */}
          {gameState === 'ready' && (
            <div className="start-screen">
              <h1>SWOOP RACING</h1>
              <h2>Taris Circuit</h2>
              <div className="race-info">
                <p>Target Time: <span className="highlight">{formatTime(targetTime)}s</span></p>
                {bestTime && (
                  <p>Your Best: <span className="highlight best">{formatTime(bestTime)}s</span></p>
                )}
              </div>
              <div className="controls">
                <h3>CONTROLS</h3>
                <p><kbd>ENTER</kbd> START RACE</p>
                <p><kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd> CHANGE LANES</p>
                <p><kbd>SPACE</kbd> SHIFT GEAR (when meter full)</p>
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
