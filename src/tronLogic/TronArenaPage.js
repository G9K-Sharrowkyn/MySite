import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as BABYLON from '@babylonjs/core';
import { AuthContext } from '../auth/AuthContext';
import './TronArenaPage.css';

const DEFAULT_ROOM_ID = 'public';
const FALLBACK_GRID_SIZE = 48;
const KEY_TO_DIRECTION = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right'
};

const sanitizeRoomId = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized || DEFAULT_ROOM_ID;
};

const getDirectionRotation = (direction) => {
  switch (direction) {
    case 'up':
      return 0;
    case 'right':
      return Math.PI / 2;
    case 'down':
      return Math.PI;
    case 'left':
      return -Math.PI / 2;
    default:
      return 0;
  }
};

const toWorldPos = (x, y, gridSize) => {
  const half = gridSize / 2;
  return {
    x: x + 0.5 - half,
    z: y + 0.5 - half
  };
};

const initialArenaState = {
  roomId: DEFAULT_ROOM_ID,
  gridSize: FALLBACK_GRID_SIZE,
  tickMs: 120,
  phase: 'waiting',
  round: 0,
  countdownEndsAt: null,
  winner: null,
  players: [],
  trails: []
};

const TronArenaPage = () => {
  const { user, token } = useContext(AuthContext);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const arenaMeshesRef = useRef([]);
  const arenaGridRef = useRef(0);
  const trailMeshesRef = useRef(new Map());
  const playerMeshesRef = useRef(new Map());
  const playerMaterialRef = useRef(new Map());
  const trailMaterialRef = useRef(null);
  const guestNameRef = useRef(
    `Guest-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  );

  const [socketId, setSocketId] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState('');
  const [roomInput, setRoomInput] = useState(DEFAULT_ROOM_ID);
  const [activeRoomId, setActiveRoomId] = useState(DEFAULT_ROOM_ID);
  const [arenaState, setArenaState] = useState(initialArenaState);

  const displayName =
    user?.displayName || user?.username || user?.email || guestNameRef.current;

  const clearSceneObjects = useCallback(() => {
    for (const mesh of trailMeshesRef.current.values()) {
      mesh.dispose();
    }
    trailMeshesRef.current.clear();

    for (const mesh of playerMeshesRef.current.values()) {
      mesh.dispose();
    }
    playerMeshesRef.current.clear();

    for (const material of playerMaterialRef.current.values()) {
      material.dispose();
    }
    playerMaterialRef.current.clear();

    if (trailMaterialRef.current) {
      trailMaterialRef.current.dispose();
      trailMaterialRef.current = null;
    }
  }, []);

  const ensureArena = useCallback((scene, gridSize) => {
    if (!scene || !Number.isFinite(gridSize)) return;
    if (arenaGridRef.current === gridSize && arenaMeshesRef.current.length > 0) {
      return;
    }

    arenaMeshesRef.current.forEach((mesh) => mesh.dispose());
    arenaMeshesRef.current = [];
    arenaGridRef.current = gridSize;
    clearSceneObjects();

    const wallThickness = 0.4;
    const roomSize = gridSize;

    const floor = BABYLON.MeshBuilder.CreateGround(
      'tron-floor',
      { width: roomSize, height: roomSize },
      scene
    );
    const floorMat = new BABYLON.StandardMaterial('tron-floor-mat', scene);
    floorMat.diffuseColor = new BABYLON.Color3(0.04, 0.07, 0.14);
    floorMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.07);
    floor.material = floorMat;
    arenaMeshesRef.current.push(floor);

    const wallMat = new BABYLON.StandardMaterial('tron-wall-mat', scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.09, 0.16, 0.25);
    wallMat.emissiveColor = new BABYLON.Color3(0.05, 0.12, 0.25);

    const half = roomSize / 2;
    const walls = [
      { x: 0, z: -half, width: roomSize + wallThickness * 2, depth: wallThickness },
      { x: 0, z: half, width: roomSize + wallThickness * 2, depth: wallThickness },
      { x: -half, z: 0, width: wallThickness, depth: roomSize },
      { x: half, z: 0, width: wallThickness, depth: roomSize }
    ];

    walls.forEach((wall, index) => {
      const mesh = BABYLON.MeshBuilder.CreateBox(
        `tron-wall-${index}`,
        { width: wall.width, depth: wall.depth, height: 2.8 },
        scene
      );
      mesh.position.set(wall.x, 1.4, wall.z);
      mesh.material = wallMat;
      arenaMeshesRef.current.push(mesh);
    });
  }, [clearSceneObjects]);

  const ensureTrailMaterial = useCallback((scene) => {
    if (trailMaterialRef.current) return trailMaterialRef.current;
    const mat = new BABYLON.StandardMaterial('tron-trail-mat', scene);
    mat.diffuseColor = new BABYLON.Color3(0, 0.85, 0.95);
    mat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.65);
    trailMaterialRef.current = mat;
    return mat;
  }, []);

  const ensurePlayerMaterial = useCallback((scene, socketPlayerId, hexColor) => {
    const existing = playerMaterialRef.current.get(socketPlayerId);
    if (existing) return existing;

    const material = new BABYLON.StandardMaterial(`tron-player-${socketPlayerId}`, scene);
    const color = BABYLON.Color3.FromHexString(hexColor || '#ffffff');
    material.diffuseColor = color.scale(0.8);
    material.emissiveColor = color.scale(0.45);
    playerMaterialRef.current.set(socketPlayerId, material);
    return material;
  }, []);

  const syncScene = useCallback((state) => {
    const scene = sceneRef.current;
    if (!scene || !state) return;

    const gridSize = Number(state.gridSize) || FALLBACK_GRID_SIZE;
    ensureArena(scene, gridSize);

    const trailMaterial = ensureTrailMaterial(scene);
    const nextTrailKeys = new Set();
    const trails = Array.isArray(state.trails) ? state.trails : [];

    for (const trail of trails) {
      const x = Number(trail?.x);
      const y = Number(trail?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const key = `${x}:${y}`;
      nextTrailKeys.add(key);
      if (trailMeshesRef.current.has(key)) continue;

      const mesh = BABYLON.MeshBuilder.CreateBox(
        `trail-${key}`,
        { width: 0.92, depth: 0.92, height: 0.88 },
        scene
      );
      const world = toWorldPos(x, y, gridSize);
      mesh.position.set(world.x, 0.44, world.z);
      mesh.material = trailMaterial;
      trailMeshesRef.current.set(key, mesh);
    }

    for (const [key, mesh] of trailMeshesRef.current.entries()) {
      if (nextTrailKeys.has(key)) continue;
      mesh.dispose();
      trailMeshesRef.current.delete(key);
    }

    const nextPlayers = new Set();
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      const playerId = String(player?.socketId || '');
      if (!playerId) continue;
      nextPlayers.add(playerId);

      let mesh = playerMeshesRef.current.get(playerId);
      if (!mesh) {
        mesh = BABYLON.MeshBuilder.CreateBox(
          `tron-rider-${playerId}`,
          { width: 0.74, depth: 0.74, height: 0.5 },
          scene
        );
        mesh.material = ensurePlayerMaterial(scene, playerId, player.color);
        playerMeshesRef.current.set(playerId, mesh);
      }

      const hasCoords = Number.isFinite(player?.x) && Number.isFinite(player?.y);
      mesh.isVisible = hasCoords;
      if (!hasCoords) continue;

      const world = toWorldPos(Number(player.x), Number(player.y), gridSize);
      mesh.position.set(world.x, player.alive ? 0.35 : 0.24, world.z);
      mesh.rotation.y = getDirectionRotation(player.dir);
      mesh.scaling.setAll(player.alive ? 1 : 0.76);
    }

    for (const [playerId, mesh] of playerMeshesRef.current.entries()) {
      if (nextPlayers.has(playerId)) continue;
      mesh.dispose();
      playerMeshesRef.current.delete(playerId);
      const mat = playerMaterialRef.current.get(playerId);
      if (mat) {
        mat.dispose();
        playerMaterialRef.current.delete(playerId);
      }
    }
  }, [ensureArena, ensurePlayerMaterial, ensureTrailMaterial]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const engine = new BABYLON.Engine(canvasRef.current, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true
    });
    engineRef.current = engine;

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.01, 0.015, 0.04, 1);
    sceneRef.current = scene;

    const camera = new BABYLON.ArcRotateCamera(
      'tron-camera',
      -Math.PI / 2,
      1.05,
      42,
      new BABYLON.Vector3(0, 0, 0),
      scene
    );
    camera.lowerRadiusLimit = 22;
    camera.upperRadiusLimit = 120;
    camera.wheelDeltaPercentage = 0.01;
    camera.attachControl(canvasRef.current, true);

    const hemi = new BABYLON.HemisphericLight(
      'tron-hemi',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    hemi.intensity = 0.65;

    const fill = new BABYLON.PointLight(
      'tron-point',
      new BABYLON.Vector3(0, 28, 0),
      scene
    );
    fill.intensity = 0.7;

    ensureArena(scene, FALLBACK_GRID_SIZE);

    engine.runRenderLoop(() => {
      scene.render();
    });

    const onResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearSceneObjects();
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
      engineRef.current = null;
      arenaMeshesRef.current = [];
      arenaGridRef.current = 0;
    };
  }, [clearSceneObjects, ensureArena]);

  useEffect(() => {
    syncScene(arenaState);
  }, [arenaState, syncScene]);

  useEffect(() => {
    const socket = io('/tron', {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {}
    });
    socketRef.current = socket;
    setError('');
    setConnectionState('connecting');

    socket.on('connect', () => {
      setConnectionState('connected');
      setSocketId(socket.id);
      socket.emit('tron:join', {
        roomId: activeRoomId,
        username: displayName
      });
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      setSocketId('');
    });

    socket.on('connect_error', (connectError) => {
      setConnectionState('error');
      setError(connectError?.message || 'Connection failed');
    });

    socket.on('tron:error', (payload) => {
      setError(String(payload?.message || 'Unknown TRON room error'));
    });

    socket.on('tron:state', (state) => {
      setArenaState({
        ...initialArenaState,
        ...state
      });
    });

    return () => {
      socket.emit('tron:leave');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setArenaState(initialArenaState);
    };
  }, [activeRoomId, displayName, token]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || '').toLowerCase();
      const direction = KEY_TO_DIRECTION[key];
      if (!direction) return;

      const targetTag = String(event.target?.tagName || '').toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      event.preventDefault();
      if (socketRef.current) {
        socketRef.current.emit('tron:turn', { direction });
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleJoinRoom = useCallback(
    (event) => {
      event.preventDefault();
      const nextRoomId = sanitizeRoomId(roomInput);
      setRoomInput(nextRoomId);
      setActiveRoomId(nextRoomId);
    },
    [roomInput]
  );

  const aliveCount = useMemo(
    () => arenaState.players.filter((player) => player.alive).length,
    [arenaState.players]
  );

  const myPlayer = useMemo(
    () => arenaState.players.find((player) => player.socketId === socketId) || null,
    [arenaState.players, socketId]
  );

  const sortedPlayers = useMemo(
    () =>
      [...arenaState.players].sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) {
          return (b.wins || 0) - (a.wins || 0);
        }
        return String(a.username || '').localeCompare(String(b.username || ''));
      }),
    [arenaState.players]
  );

  return (
    <div className="tron-page">
      <div className="tron-header">
        <h1>TRON Arena</h1>
        <p>Ruch: `WASD` lub strzalki. Ostatni zywy wygrywa runde.</p>
      </div>

      <div className="tron-layout">
        <section className="tron-canvas-panel">
          <canvas ref={canvasRef} className="tron-canvas" />
          <div className="tron-overlay">
            <div className="tron-pill">Room: {arenaState.roomId || activeRoomId}</div>
            <div className="tron-pill">Round: {arenaState.round}</div>
            <div className="tron-pill">Phase: {arenaState.phase}</div>
            <div className="tron-pill">Alive: {aliveCount}</div>
          </div>
        </section>

        <aside className="tron-sidebar">
          <form className="tron-room-form" onSubmit={handleJoinRoom}>
            <label htmlFor="tron-room-input">Pokoj</label>
            <div className="tron-room-row">
              <input
                id="tron-room-input"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="public"
                maxLength={24}
              />
              <button type="submit">Dolacz</button>
            </div>
          </form>

          <div className="tron-status">
            <div>
              <span>Status:</span>
              <strong>{connectionState}</strong>
            </div>
            {myPlayer ? (
              <div>
                <span>Ty:</span>
                <strong>{myPlayer.username}</strong>
              </div>
            ) : (
              <div>
                <span>Ty:</span>
                <strong>spectator</strong>
              </div>
            )}
          </div>

          {arenaState.winner ? (
            <div className="tron-winner">
              Winner: <strong>{arenaState.winner.username}</strong>
            </div>
          ) : null}

          {error ? <div className="tron-error">{error}</div> : null}

          <div className="tron-players">
            <h2>Players</h2>
            {sortedPlayers.length === 0 ? (
              <p>Brak graczy.</p>
            ) : (
              <ul>
                {sortedPlayers.map((player) => (
                  <li key={player.socketId} className={!player.alive ? 'is-dead' : ''}>
                    <span className="dot" style={{ background: player.color }} />
                    <span className="name">{player.username}</span>
                    <span className="wins">{player.wins || 0}W</span>
                    {player.socketId === socketId ? <span className="me">(You)</span> : null}
                    {!player.alive && player.spectator ? (
                      <span className="state">spectator</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TronArenaPage;
