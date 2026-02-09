import React, { useEffect, useRef, useState } from 'react';
import './SpeedRacingPage.css';
import * as BABYLON from '@babylonjs/core';

const SpeedRacingPage = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('ready'); // ready, racing
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create Babylon.js engine
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    // Create scene
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.08, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    scene.fogDensity = 0.01;
    scene.fogColor = new BABYLON.Color3(0.02, 0.02, 0.08);

    // Create camera following the speeder
    const camera = new BABYLON.FollowCamera(
      'followCamera',
      new BABYLON.Vector3(0, 5, -15),
      scene
    );
    camera.radius = 15;
    camera.heightOffset = 5;
    camera.rotationOffset = 0;
    camera.cameraAcceleration = 0.05;
    camera.maxCameraSpeed = 10;

    // Lighting setup
    const ambientLight = new BABYLON.HemisphericLight(
      'ambient',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    ambientLight.intensity = 0.3;
    ambientLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.2);

    // Directional light for shadows
    const mainLight = new BABYLON.DirectionalLight(
      'mainLight',
      new BABYLON.Vector3(0.5, -1, 0.8),
      scene
    );
    mainLight.intensity = 0.8;
    mainLight.diffuse = new BABYLON.Color3(0.8, 0.9, 1);

    // Create speeder vehicle (simple box for now)
    const speeder = BABYLON.MeshBuilder.CreateBox(
      'speeder',
      { width: 2, height: 0.8, depth: 4 },
      scene
    );
    speeder.position = new BABYLON.Vector3(0, 1, 0);

    // Speeder material with glow
    const speederMat = new BABYLON.StandardMaterial('speederMat', scene);
    speederMat.diffuseColor = new BABYLON.Color3(0.1, 0.3, 0.5);
    speederMat.specularColor = new BABYLON.Color3(0.5, 0.7, 1);
    speederMat.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.4);
    speederMat.specularPower = 128;
    speeder.material = speederMat;

    // Add engine glow lights to speeder
    const leftEngine = BABYLON.MeshBuilder.CreateSphere(
      'leftEngine',
      { diameter: 0.5 },
      scene
    );
    leftEngine.parent = speeder;
    leftEngine.position = new BABYLON.Vector3(-1, -0.2, -1.5);
    
    const rightEngine = leftEngine.clone('rightEngine');
    rightEngine.position = new BABYLON.Vector3(1, -0.2, -1.5);

    const engineGlowMat = new BABYLON.StandardMaterial('engineGlow', scene);
    engineGlowMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    engineGlowMat.disableLighting = true;
    leftEngine.material = engineGlowMat;
    rightEngine.material = engineGlowMat;

    // Point lights for engines
    const leftLight = new BABYLON.PointLight(
      'leftEngineLight',
      new BABYLON.Vector3(-1, 0.5, -1.5),
      scene
    );
    leftLight.parent = speeder;
    leftLight.diffuse = new BABYLON.Color3(0, 0.8, 1);
    leftLight.intensity = 2;
    leftLight.range = 10;

    const rightLight = leftLight.clone('rightEngineLight');
    rightLight.parent = speeder;
    rightLight.position = new BABYLON.Vector3(1, 0.5, -1.5);

    // Set camera target
    camera.lockedTarget = speeder;

    // Create tunnel segments
    const tunnelSegments = [];
    const SEGMENT_LENGTH = 20;
    const TUNNEL_RADIUS = 8;
    const SEGMENTS_COUNT = 30;

    for (let i = 0; i < SEGMENTS_COUNT; i++) {
      const segment = BABYLON.MeshBuilder.CreateTorus(
        `tunnel_${i}`,
        {
          diameter: TUNNEL_RADIUS * 2,
          thickness: 0.5,
          tessellation: 32
        },
        scene
      );
      
      segment.position.z = i * SEGMENT_LENGTH;
      segment.rotation.x = Math.PI / 2;

      // Tunnel material with neon glow
      const tunnelMat = new BABYLON.StandardMaterial(`tunnelMat_${i}`, scene);
      const hue = (i * 0.1) % 1;
      tunnelMat.emissiveColor = new BABYLON.Color3(
        0.2 + hue * 0.3,
        0.4 + Math.sin(hue * Math.PI) * 0.3,
        0.8
      );
      tunnelMat.alpha = 0.7;
      tunnelMat.wireframe = true;
      segment.material = tunnelMat;

      tunnelSegments.push(segment);
    }

    // Create obstacles (rocks)
    const obstacles = [];
    for (let i = 0; i < 20; i++) {
      const rock = BABYLON.MeshBuilder.CreateIcoSphere(
        `rock_${i}`,
        { radius: 1, subdivisions: 2 },
        scene
      );
      
      const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
      rock.position = new BABYLON.Vector3(
        lane * 3,
        1,
        (i + 3) * 15 + Math.random() * 10
      );
      
      rock.rotation = new BABYLON.Vector3(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      const rockMat = new BABYLON.StandardMaterial(`rockMat_${i}`, scene);
      rockMat.diffuseColor = new BABYLON.Color3(0.3, 0.25, 0.2);
      rockMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      rock.material = rockMat;

      obstacles.push(rock);
    }

    // Create boost pads
    const boostPads = [];
    for (let i = 0; i < 15; i++) {
      const pad = BABYLON.MeshBuilder.CreateBox(
        `boost_${i}`,
        { width: 3, height: 0.2, depth: 2 },
        scene
      );
      
      const lane = Math.floor(Math.random() * 3) - 1;
      pad.position = new BABYLON.Vector3(
        lane * 3,
        0.1,
        (i + 2) * 20 + Math.random() * 15
      );

      const boostMat = new BABYLON.StandardMaterial(`boostMat_${i}`, scene);
      boostMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
      boostMat.alpha = 0.8;
      pad.material = boostMat;

      boostPads.push(pad);
    }

    // Game state
    let currentSpeed = 0;
    let targetSpeed = 0;
    let currentLane = 0; // -1 left, 0 center, 1 right
    let travelDistance = 0;
    let isRacing = false;

    // Keyboard controls
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      
      if (e.key === 'Enter' && !isRacing) {
        isRacing = true;
        targetSpeed = 1;
        setGameState('racing');
      }
      
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        currentLane = Math.max(-1, currentLane - 1);
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        currentLane = Math.min(1, currentLane + 1);
      }
      if (e.key === ' ') {
        e.preventDefault();
        targetSpeed = Math.min(2, targetSpeed + 0.5);
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });

    // Particle system for engine trail
    const particleSystem = new BABYLON.ParticleSystem('particles', 2000, scene);
    particleSystem.particleTexture = new BABYLON.Texture(
      'https://www.babylonjs-playground.com/textures/flare.png',
      scene
    );
    particleSystem.emitter = speeder;
    particleSystem.minEmitBox = new BABYLON.Vector3(-1, -0.5, -2);
    particleSystem.maxEmitBox = new BABYLON.Vector3(1, -0.5, -2);
    particleSystem.color1 = new BABYLON.Color4(0, 0.8, 1, 1);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1, 1);
    particleSystem.colorDead = new BABYLON.Color4(0, 0.2, 0.5, 0);
    particleSystem.minSize = 0.3;
    particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.6;
    particleSystem.emitRate = 100;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    particleSystem.gravity = new BABYLON.Vector3(0, -1, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, 0, -2);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, 0, -2);
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;
    particleSystem.minEmitPower = 2;
    particleSystem.maxEmitPower = 4;
    particleSystem.updateSpeed = 0.01;

    // Render loop
    let lastTime = performance.now();
    engine.runRenderLoop(() => {
      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isRacing) {
        // Smooth speed change
        currentSpeed += (targetSpeed - currentSpeed) * deltaTime * 3;
        
        // Update distance
        travelDistance += currentSpeed * deltaTime * 50;
        setDistance(Math.floor(travelDistance));
        setSpeed(currentSpeed.toFixed(2));

        // Move speeder horizontally to lane
        const targetX = currentLane * 3;
        speeder.position.x += (targetX - speeder.position.x) * deltaTime * 5;

        // Move tunnel segments
        tunnelSegments.forEach((segment, index) => {
          segment.position.z -= currentSpeed * deltaTime * 50;
          
          // Recycle segments
          if (segment.position.z < speeder.position.z - 50) {
            segment.position.z = speeder.position.z + 
              (SEGMENTS_COUNT - 1) * SEGMENT_LENGTH;
          }

          // Pulse effect
          const dist = Math.abs(segment.position.z - speeder.position.z);
          const scale = 1 + Math.max(0, (20 - dist) / 50) * 0.2;
          segment.scaling.set(scale, scale, 1);
        });

        // Move obstacles
        obstacles.forEach((rock) => {
          rock.position.z -= currentSpeed * deltaTime * 50;
          rock.rotation.x += deltaTime;
          rock.rotation.y += deltaTime * 0.5;
          
          // Recycle obstacles
          if (rock.position.z < speeder.position.z - 30) {
            rock.position.z = speeder.position.z + 200 + Math.random() * 100;
            const lane = Math.floor(Math.random() * 3) - 1;
            rock.position.x = lane * 3;
          }
        });

        // Move boost pads
        boostPads.forEach((pad) => {
          pad.position.z -= currentSpeed * deltaTime * 50;
          pad.rotation.y += deltaTime * 2;
          
          // Recycle pads
          if (pad.position.z < speeder.position.z - 30) {
            pad.position.z = speeder.position.z + 250 + Math.random() * 100;
            const lane = Math.floor(Math.random() * 3) - 1;
            pad.position.x = lane * 3;
          }
        });

        // Update particle system intensity
        particleSystem.emitRate = 50 + currentSpeed * 100;
        
        if (!particleSystem.isStarted()) {
          particleSystem.start();
        }

        // Engine light pulse
        const pulse = 0.8 + Math.sin(currentTime * 0.01) * 0.2;
        leftLight.intensity = 2 + currentSpeed * pulse;
        rightLight.intensity = 2 + currentSpeed * pulse;
      }

      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', null);
      window.removeEventListener('keyup', null);
      particleSystem.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="speed-racing-page">
      <div className="canvas-container">
        <canvas ref={canvasRef} />
        
        {/* HUD Overlay */}
        <div className="hud-overlay">
          <div className="hud-top">
            <div className="hud-panel">
              <div className="hud-label">SPEED</div>
              <div className="hud-value">{speed}x</div>
            </div>
            <div className="hud-panel">
              <div className="hud-label">DISTANCE</div>
              <div className="hud-value">{distance}m</div>
            </div>
          </div>
          
          {gameState === 'ready' && (
            <div className="start-prompt">
              <h2>🏎️ SPEED RACING 3D</h2>
              <p>Press ENTER to start</p>
              <div className="controls-info">
                <div>← → or A D - Change lanes</div>
                <div>SPACE - Boost</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeedRacingPage;
