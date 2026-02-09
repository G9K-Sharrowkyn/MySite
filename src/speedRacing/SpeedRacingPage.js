import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import './SpeedRacingPage.css';
import * as BABYLON from '@babylonjs/core';

const SpeedRacingPage = () => {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create Babylon.js engine
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    // Create scene
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.12, 1);

    // Create camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 3,
      10,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvasRef.current, true);

    // Create light
    const light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 0.7;

    // Create a simple sphere as placeholder
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      'sphere',
      { diameter: 2 },
      scene
    );

    // Create material with glow
    const material = new BABYLON.StandardMaterial('sphereMat', scene);
    material.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
    sphere.material = material;

    // Render loop
    engine.runRenderLoop(() => {
      sphere.rotation.y += 0.01;
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
      engine.dispose();
    };
  }, []);

  return (
    <div className="speed-racing-page">
      <div className="canvas-container">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default SpeedRacingPage;
