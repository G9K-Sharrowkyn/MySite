import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import * as BABYLON from '@babylonjs/core';
import { AuthContext } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { normalizeTronLanguage, tronMonthLabel, tronPhaseLabel, tronRoomError, tronText } from './tronI18n';
import './TronArenaPage.css';

const DEFAULT_ROOM_ID = 'public';
const FALLBACK_ARENA_SIZE = 72;
const TRAIL_MESH_VERSION = 4;
const BIKE_MODEL_VERSION = 4;
const TRAIL_REAR_OFFSET = 1.45;
const WHEEL_DIAMETER = 0.66;
const WHEEL_THICKNESS = 0.17;
const WHEEL_CENTER_Y = 0.64;
const SPEED_TO_KMH = 25;
const TRAIL_COLOR_OPTIONS = [
  { labelKey: 'colorBlue', value: '#00e5ff' },
  { labelKey: 'colorOrange', value: '#ff7a00' },
  { labelKey: 'colorYellow', value: '#ffd84a' },
  { labelKey: 'colorRed', value: '#ff3b4d' },
  { labelKey: 'colorGreen', value: '#58f56b' }
];

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const KEY_TO_TURN = {
  arrowleft: 'right',
  a: 'right',
  q: 'right',
  arrowright: 'left',
  d: 'left',
  e: 'left'
};

const initialArenaState = {
  roomId: DEFAULT_ROOM_ID,
  arenaSize: FALLBACK_ARENA_SIZE,
  tickMs: 50,
  baseSpeed: 12,
  maxSpeed: 20,
  phase: 'waiting',
  round: 0,
  countdownEndsAt: null,
  winner: null,
  players: [],
  trails: []
};

const sanitizeRoomId = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return normalized || DEFAULT_ROOM_ID;
};

const resolveTronSocketUrl = () => {
  const configuredUrl = String(process.env.REACT_APP_SOCKET_URL || '').trim();
  if (typeof window === 'undefined') return configuredUrl || 'http://localhost:5000';
  const { hostname, port, protocol, origin } = window.location;
  if (port === '3000') return `${protocol}//${hostname}:5000`;
  return configuredUrl || origin;
};

const getDirectionRotation = (direction) => {
  switch (direction) {
    case 'right': return -Math.PI / 2;
    case 'down': return Math.PI;
    case 'left': return Math.PI / 2;
    default: return 0;
  }
};

const getDirectionVector = (direction) => {
  switch (direction) {
    case 'right': return new BABYLON.Vector3(1, 0, 0);
    case 'down': return new BABYLON.Vector3(0, 0, 1);
    case 'left': return new BABYLON.Vector3(-1, 0, 0);
    default: return new BABYLON.Vector3(0, 0, -1);
  }
};

const lerpAngle = (current, target, alpha) => {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return current + difference * alpha;
};

const buildTrailRibbonPaths = (points) => {
  const halfWidth = WHEEL_THICKNESS / 2;
  const wheelBottom = WHEEL_CENTER_Y - WHEEL_DIAMETER / 2;
  const wheelTop = WHEEL_CENTER_Y + WHEEL_DIAMETER / 2;
  const leftBottom = [];
  const leftTop = [];
  const rightTop = [];
  const rightBottom = [];

  points.forEach((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.max(0.0001, Math.hypot(tangentX, tangentY));
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;
    const leftX = point.x + normalX * halfWidth;
    const leftY = point.y + normalY * halfWidth;
    const rightX = point.x - normalX * halfWidth;
    const rightY = point.y - normalY * halfWidth;

    leftBottom.push(new BABYLON.Vector3(leftX, wheelBottom, leftY));
    leftTop.push(new BABYLON.Vector3(leftX, wheelTop, leftY));
    rightTop.push(new BABYLON.Vector3(rightX, wheelTop, rightY));
    rightBottom.push(new BABYLON.Vector3(rightX, wheelBottom, rightY));
  });

  return [leftBottom, leftTop, rightTop, rightBottom];
};

const buildTrailBorderLines = (pathArray) => {
  const clonePath = (path) => path.map((point) => point.clone());
  const firstCap = pathArray.map((path) => path[0].clone());
  firstCap.push(pathArray[0][0].clone());
  const lastCap = pathArray.map((path) => path[path.length - 1].clone());
  lastCap.push(pathArray[0][pathArray[0].length - 1].clone());
  return [...pathArray.map(clonePath), firstCap, lastCap];
};

const colorFromHex = (value, fallback = '#ffffff') => {
  try {
    return BABYLON.Color3.FromHexString(value || fallback);
  } catch (_error) {
    return BABYLON.Color3.FromHexString(fallback);
  }
};

const TronArenaPage = () => {
  const { user, token } = useContext(AuthContext);
  const { currentLanguage } = useLanguage();
  const language = normalizeTronLanguage(currentLanguage);
  const t = useCallback((key, values) => tronText(language, key, values), [language]);
  const languageRef = useRef(language);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const cameraRef = useRef(null);
  const glowRef = useRef(null);
  const arenaMeshesRef = useRef([]);
  const arenaSizeRef = useRef(0);
  const trailMeshesRef = useRef(new Map());
  const trailMaterialsRef = useRef(new Map());
  const playerMeshesRef = useRef(new Map());
  const playerMaterialsRef = useRef(new Map());
  const arenaStateRef = useRef(initialArenaState);
  const socketIdRef = useRef('');
  const activeRoomIdRef = useRef(DEFAULT_ROOM_ID);
  const displayNameRef = useRef('');
  const pendingJoinRoomRef = useRef('');
  const pendingJoinPasswordRef = useRef('');
  const selectedColorRef = useRef(TRAIL_COLOR_OPTIONS[0].value);
  const guestNameRef = useRef(`Guest-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);

  const [socketId, setSocketId] = useState('');
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(DEFAULT_ROOM_ID);
  const [arenaState, setArenaState] = useState(initialArenaState);
  const [clockNow, setClockNow] = useState(Date.now());
  const [inGame, setInGame] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [selectedColor, setSelectedColor] = useState(TRAIL_COLOR_OPTIONS[0].value);
  const [lobbyRooms, setLobbyRooms] = useState([]);
  const [roomPasswords, setRoomPasswords] = useState({});
  const [createRoomName, setCreateRoomName] = useState('');
  const [createVisibility, setCreateVisibility] = useState('public');
  const [createPassword, setCreatePassword] = useState('');
  const [leaderboardMonth, setLeaderboardMonth] = useState(getCurrentMonthKey);
  const [leaderboardMonths, setLeaderboardMonths] = useState([getCurrentMonthKey()]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);

  displayNameRef.current =
    user?.displayName || user?.username || user?.email || guestNameRef.current;
  arenaStateRef.current = arenaState;
  socketIdRef.current = socketId;
  activeRoomIdRef.current = activeRoomId;
  selectedColorRef.current = selectedColor;
  languageRef.current = language;

  const disposeSceneObjects = useCallback(() => {
    for (const root of playerMeshesRef.current.values()) {
      root.metadata?.sparks?.dispose();
      root.dispose(false, true);
    }
    playerMeshesRef.current.clear();
    for (const materials of playerMaterialsRef.current.values()) {
      materials.forEach((material) => material.dispose());
    }
    playerMaterialsRef.current.clear();
    for (const mesh of trailMeshesRef.current.values()) {
      mesh.metadata?.borderMesh?.dispose();
      mesh.dispose();
    }
    trailMeshesRef.current.clear();
    for (const material of trailMaterialsRef.current.values()) material.dispose();
    trailMaterialsRef.current.clear();
  }, []);

  const createSparkTexture = useCallback((scene, playerId) => {
    const texture = new BABYLON.DynamicTexture(`spark-texture-${playerId}`, 32, scene, false);
    texture.hasAlpha = true;
    const context = texture.getContext();
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,225,80,1)');
    gradient.addColorStop(1, 'rgba(255,80,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    texture.update();
    return texture;
  }, []);

  const ensurePlayerMaterials = useCallback((scene, playerId, hexColor) => {
    const existing = playerMaterialsRef.current.get(playerId);
    if (existing) return existing;
    const color = colorFromHex(hexColor);
    const body = new BABYLON.StandardMaterial(`bike-body-${playerId}`, scene);
    body.diffuseColor = color.scale(0.22);
    body.emissiveColor = color.scale(0.34);
    body.specularColor = color.scale(0.58);
    const dark = new BABYLON.StandardMaterial(`bike-dark-${playerId}`, scene);
    dark.diffuseColor = new BABYLON.Color3(0.006, 0.012, 0.022);
    dark.emissiveColor = color.scale(0.1);
    dark.specularColor = color.scale(0.8);
    const light = new BABYLON.StandardMaterial(`bike-light-${playerId}`, scene);
    light.diffuseColor = color.scale(0.62);
    light.emissiveColor = color.scale(0.78);
    const wheel = new BABYLON.PBRMaterial(`bike-wheel-${playerId}`, scene);
    wheel.albedoColor = new BABYLON.Color3(0.006, 0.012, 0.02);
    wheel.metallic = 0.92;
    wheel.roughness = 0.16;
    wheel.emissiveColor = color.scale(0.025);
    wheel.clearCoat.isEnabled = true;
    wheel.clearCoat.intensity = 0.85;
    wheel.clearCoat.roughness = 0.12;
    wheel.anisotropy.isEnabled = true;
    wheel.anisotropy.intensity = 0.65;
    wheel.anisotropy.direction = new BABYLON.Vector2(0.8, 0.2);
    const materials = [body, dark, light, wheel];
    playerMaterialsRef.current.set(playerId, materials);
    return materials;
  }, []);

  const createBikeRoot = useCallback((scene, playerId, hexColor) => {
    const [
      bodyMaterial,
      darkMaterial,
      lightMaterial,
      wheelMaterial
    ] = ensurePlayerMaterials(
      scene, playerId, hexColor
    );
    const root = new BABYLON.TransformNode(`light-cycle-${playerId}`, scene);

    const body = BABYLON.MeshBuilder.CreateCapsule(
      `cycle-body-${playerId}`,
      { radius: 0.31, height: 2.72, tessellation: 18, subdivisions: 4 },
      scene
    );
    body.rotation.x = Math.PI / 2;
    body.scaling.x = 0.82;
    body.scaling.z = 0.78;
    body.position.y = 0.63;
    body.material = bodyMaterial;
    body.parent = root;

    const canopy = BABYLON.MeshBuilder.CreateSphere(
      `cycle-canopy-${playerId}`,
      { diameterX: 0.38, diameterY: 0.7, diameterZ: 1.04, segments: 14 },
      scene
    );
    canopy.position.set(0, 0.91, 0.12);
    canopy.material = darkMaterial;
    canopy.parent = root;

    const nose = BABYLON.MeshBuilder.CreateSphere(
      `cycle-nose-${playerId}`,
      { diameterX: 0.38, diameterY: 0.43, diameterZ: 0.94, segments: 16 },
      scene
    );
    nose.position.set(0, 0.57, -1.24);
    nose.material = bodyMaterial;
    nose.parent = root;

    [-0.25, 0.25].forEach((x, fairingIndex) => {
      const fairing = BABYLON.MeshBuilder.CreateSphere(
        `cycle-fairing-${playerId}-${fairingIndex}`,
        { diameterX: 0.16, diameterY: 0.43, diameterZ: 1.72, segments: 14 },
        scene
      );
      fairing.position.set(x, 0.57, 0.03);
      fairing.material = bodyMaterial;
      fairing.parent = root;
    });

    const wheelSpins = [];
    [-1.12, 1.12].forEach((z, wheelIndex) => {
      const wheelMount = new BABYLON.TransformNode(
        `cycle-wheel-mount-${playerId}-${wheelIndex}`,
        scene
      );
      wheelMount.rotation.z = Math.PI / 2;
      wheelMount.position.set(0, WHEEL_CENTER_Y, z);
      wheelMount.parent = root;
      const wheelSpin = new BABYLON.TransformNode(
        `cycle-wheel-spin-${playerId}-${wheelIndex}`,
        scene
      );
      wheelSpin.parent = wheelMount;
      wheelSpins.push(wheelSpin);

      const wheel = BABYLON.MeshBuilder.CreateCylinder(
        `cycle-wheel-${playerId}-${wheelIndex}`,
        { diameter: WHEEL_DIAMETER, height: WHEEL_THICKNESS, tessellation: 32 },
        scene
      );
      wheel.material = wheelMaterial;
      wheel.parent = wheelSpin;
      const ring = BABYLON.MeshBuilder.CreateTorus(
        `cycle-ring-${playerId}-${wheelIndex}`,
        { diameter: 0.52, thickness: 0.045, tessellation: 36 },
        scene
      );
      ring.material = lightMaterial;
      ring.parent = wheelSpin;
    });

    const sparkEmitter = new BABYLON.TransformNode(`spark-emitter-${playerId}`, scene);
    sparkEmitter.position.set(0, 0.28, 0.35);
    sparkEmitter.parent = root;
    const cameraAnchor = new BABYLON.TransformNode(`camera-anchor-${playerId}`, scene);
    cameraAnchor.position.set(0, 0.38, -2.65);
    cameraAnchor.parent = root;
    const sparks = new BABYLON.ParticleSystem(`wall-sparks-${playerId}`, 180, scene);
    sparks.particleTexture = createSparkTexture(scene, playerId);
    sparks.emitter = sparkEmitter;
    sparks.minEmitPower = 1.4;
    sparks.maxEmitPower = 4.6;
    sparks.minLifeTime = 0.12;
    sparks.maxLifeTime = 0.42;
    sparks.minSize = 0.035;
    sparks.maxSize = 0.12;
    sparks.gravity = new BABYLON.Vector3(0, -5, 0);
    sparks.direction1 = new BABYLON.Vector3(-1.2, 0.6, 0.7);
    sparks.direction2 = new BABYLON.Vector3(1.2, 2.1, 2.8);
    sparks.color1 = new BABYLON.Color4(1, 0.95, 0.45, 1);
    sparks.color2 = new BABYLON.Color4(1, 0.2, 0.02, 1);
    sparks.colorDead = new BABYLON.Color4(0.3, 0.02, 0, 0);
    sparks.emitRate = 0;
    sparks.start();
    root.metadata = {
      modelVersion: BIKE_MODEL_VERSION,
      sparks,
      sparkEmitter,
      cameraAnchor,
      wheelSpins
    };
    return root;
  }, [createSparkTexture, ensurePlayerMaterials]);

  const ensureTrailMaterial = useCallback((scene, ownerId, colorHex) => {
    const key = ownerId || colorHex || 'unknown';
    const color = colorFromHex(colorHex, '#00e5ff');
    let material = trailMaterialsRef.current.get(key);
    if (!material) {
      material = new BABYLON.StandardMaterial(`trail-material-${key}`, scene);
      trailMaterialsRef.current.set(key, material);
    }
    material.diffuseColor = color.scale(0.08);
    material.emissiveColor = color.scale(0.34);
    material.specularColor = BABYLON.Color3.White().scale(0.9);
    material.specularPower = 128;
    material.alpha = 0.24;
    material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    material.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    material.needDepthPrePass = false;
    material.disableDepthWrite = true;
    material.useSpecularOverAlpha = true;
    material.backFaceCulling = false;
    return material;
  }, []);

  const ensureArena = useCallback((scene, arenaSize) => {
    if (!scene || !Number.isFinite(arenaSize)) return;
    if (arenaSizeRef.current === arenaSize && arenaMeshesRef.current.length) return;
    arenaMeshesRef.current.forEach((mesh) => mesh.dispose(false, true));
    arenaMeshesRef.current = [];
    arenaSizeRef.current = arenaSize;
    disposeSceneObjects();

    const floor = BABYLON.MeshBuilder.CreateGround(
      'tron-floor', { width: arenaSize + 8, height: arenaSize + 8 }, scene
    );
    const floorMaterial = new BABYLON.StandardMaterial('tron-floor-material', scene);
    floorMaterial.diffuseColor = new BABYLON.Color3(0.001, 0.001, 0.002);
    floorMaterial.emissiveColor = BABYLON.Color3.Black();
    floorMaterial.specularColor = new BABYLON.Color3(0.16, 0.16, 0.18);
    floorMaterial.specularPower = 96;
    floor.material = floorMaterial;
    arenaMeshesRef.current.push(floor);

    const gridMaterial = new BABYLON.StandardMaterial('tron-grid-material', scene);
    gridMaterial.diffuseColor = new BABYLON.Color3(0.72, 0.74, 0.78);
    gridMaterial.emissiveColor = new BABYLON.Color3(0.48, 0.5, 0.54);
    gridMaterial.specularColor = BABYLON.Color3.White();
    for (let offset = -arenaSize / 2; offset <= arenaSize / 2; offset += 4) {
      const vertical = BABYLON.MeshBuilder.CreateBox(
        `grid-v-${offset}`, { width: 0.018, height: 0.012, depth: arenaSize }, scene
      );
      vertical.position.set(offset, 0.012, 0);
      vertical.material = gridMaterial;
      const horizontal = BABYLON.MeshBuilder.CreateBox(
        `grid-h-${offset}`, { width: arenaSize, height: 0.012, depth: 0.018 }, scene
      );
      horizontal.position.set(0, 0.012, offset);
      horizontal.material = gridMaterial;
      arenaMeshesRef.current.push(vertical, horizontal);
    }

    const wallMaterial = new BABYLON.StandardMaterial('tron-wall-material', scene);
    wallMaterial.diffuseColor = new BABYLON.Color3(0.001, 0.001, 0.002);
    wallMaterial.emissiveColor = BABYLON.Color3.Black();
    wallMaterial.specularColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    wallMaterial.specularPower = 96;
    const half = arenaSize / 2;
    [
      { x: 0, z: -half, width: arenaSize, depth: 0.34 },
      { x: 0, z: half, width: arenaSize, depth: 0.34 },
      { x: -half, z: 0, width: 0.34, depth: arenaSize },
      { x: half, z: 0, width: 0.34, depth: arenaSize }
    ].forEach((wall, index) => {
      const panel = BABYLON.MeshBuilder.CreateBox(
        `arena-wall-${index}`,
        { width: wall.width, depth: wall.depth, height: 2.7 },
        scene
      );
      panel.position.set(wall.x, 1.35, wall.z);
      panel.material = wallMaterial;
      arenaMeshesRef.current.push(panel);

      const runsAlongX = wall.width > wall.depth;
      const innerSurface = runsAlongX
        ? wall.z + (wall.z < 0 ? 0.18 : -0.18)
        : wall.x + (wall.x < 0 ? 0.18 : -0.18);
      for (let offset = -arenaSize / 2; offset <= arenaSize / 2; offset += 4) {
        const upright = BABYLON.MeshBuilder.CreateBox(
          `wall-grid-upright-${index}-${offset}`,
          { width: 0.018, height: 2.7, depth: 0.018 },
          scene
        );
        upright.position.set(
          runsAlongX ? offset : innerSurface,
          1.35,
          runsAlongX ? innerSurface : offset
        );
        upright.material = gridMaterial;
        arenaMeshesRef.current.push(upright);
      }
      for (let height = 0; height <= 2.7; height += 1.35) {
        const crossbar = BABYLON.MeshBuilder.CreateBox(
          `wall-grid-crossbar-${index}-${height}`,
          runsAlongX
            ? { width: arenaSize, height: 0.018, depth: 0.018 }
            : { width: 0.018, height: 0.018, depth: arenaSize },
          scene
        );
        crossbar.position.set(
          runsAlongX ? 0 : innerSurface,
          height,
          runsAlongX ? innerSurface : 0
        );
        crossbar.material = gridMaterial;
        arenaMeshesRef.current.push(crossbar);
      }
    });

    const platform = BABYLON.MeshBuilder.CreateBox(
      'arena-platform', { width: arenaSize + 5, height: 1.2, depth: arenaSize + 5 }, scene
    );
    platform.position.y = -0.65;
    const platformMaterial = new BABYLON.StandardMaterial('arena-platform-material', scene);
    platformMaterial.diffuseColor = new BABYLON.Color3(0.001, 0.001, 0.002);
    platformMaterial.emissiveColor = BABYLON.Color3.Black();
    platform.material = platformMaterial;
    arenaMeshesRef.current.push(platform);
  }, [disposeSceneObjects]);

  const syncTrailMesh = useCallback((scene, ownerId, ownerTrails) => {
    if (!ownerId || !ownerTrails.length) return;
    const points = [];
    const appendPoint = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const previous = points[points.length - 1];
      if (previous && Math.abs(previous.x - x) < 0.0001 && Math.abs(previous.y - y) < 0.0001) {
        return;
      }
      points.push({ x, y });
    };
    ownerTrails.forEach((trail) => {
      appendPoint(Number(trail.x1), Number(trail.y1));
      appendPoint(Number(trail.x2), Number(trail.y2));
    });
    if (points.length === 1) points.push({ x: points[0].x, y: points[0].y + 0.001 });
    if (points.length < 2) return;

    const pathArray = buildTrailRibbonPaths(points);
    const borderLines = buildTrailBorderLines(pathArray);
    let mesh = trailMeshesRef.current.get(ownerId);
    if (
      mesh &&
      (
        mesh.metadata?.pointCount !== points.length ||
        mesh.metadata?.geometryVersion !== TRAIL_MESH_VERSION
      )
    ) {
      mesh.metadata?.borderMesh?.dispose();
      mesh.dispose();
      trailMeshesRef.current.delete(ownerId);
      mesh = null;
    }
    if (mesh) {
      BABYLON.MeshBuilder.CreateRibbon(
        `light-wall-${ownerId}`,
        { pathArray, closeArray: true, instance: mesh },
        scene
      );
      BABYLON.MeshBuilder.CreateLineSystem(
        `light-wall-border-${ownerId}`,
        { lines: borderLines, instance: mesh.metadata.borderMesh },
        scene
      );
    } else {
      mesh = BABYLON.MeshBuilder.CreateRibbon(
        `light-wall-${ownerId}`,
        {
          pathArray,
          closeArray: true,
          updatable: true,
          sideOrientation: BABYLON.Mesh.FRONTSIDE
        },
        scene
      );
      const trailColor = colorFromHex(
        ownerTrails[ownerTrails.length - 1]?.color,
        '#00e5ff'
      );
      mesh.material = ensureTrailMaterial(
        scene,
        ownerId,
        ownerTrails[ownerTrails.length - 1]?.color
      );
      mesh.renderingGroupId = 1;
      const borderMesh = BABYLON.MeshBuilder.CreateLineSystem(
        `light-wall-border-${ownerId}`,
        { lines: borderLines, updatable: true },
        scene
      );
      borderMesh.color = trailColor;
      borderMesh.alpha = 0.96;
      borderMesh.renderingGroupId = 2;
      borderMesh.isPickable = false;
      glowRef.current?.addExcludedMesh(mesh);
      mesh.isPickable = false;
      mesh.metadata = { borderMesh };
      trailMeshesRef.current.set(ownerId, mesh);
    }
    mesh.metadata = {
      ...(mesh.metadata || {}),
      ownerId,
      pointCount: points.length,
      geometryVersion: TRAIL_MESH_VERSION,
      borderMesh: mesh.metadata?.borderMesh,
      pathPoints: points.map((point) => ({ ...point }))
    };
  }, [ensureTrailMaterial]);

  const syncScene = useCallback((state) => {
    const scene = sceneRef.current;
    if (!scene || !state) return;
    const arenaSize = Number(state.arenaSize || state.gridSize) || FALLBACK_ARENA_SIZE;
    ensureArena(scene, arenaSize);

    const trailsByOwner = new Map();
    for (const trail of Array.isArray(state.trails) ? state.trails : []) {
      const ownerId = String(trail?.ownerId || '');
      if (!ownerId) continue;
      if (!trailsByOwner.has(ownerId)) trailsByOwner.set(ownerId, []);
      trailsByOwner.get(ownerId).push(trail);
    }
    for (const [ownerId, ownerTrails] of trailsByOwner.entries()) {
      syncTrailMesh(scene, ownerId, ownerTrails);
    }
    for (const [ownerId, mesh] of trailMeshesRef.current.entries()) {
      if (trailsByOwner.has(ownerId)) continue;
      mesh.metadata?.borderMesh?.dispose();
      mesh.dispose();
      trailMeshesRef.current.delete(ownerId);
    }

    const nextPlayerIds = new Set();
    for (const player of Array.isArray(state.players) ? state.players : []) {
      const playerId = String(player?.socketId || '');
      if (!playerId) continue;
      nextPlayerIds.add(playerId);
      let root = playerMeshesRef.current.get(playerId);
      if (root && root.metadata?.modelVersion !== BIKE_MODEL_VERSION) {
        root.metadata?.sparks?.dispose();
        root.dispose(false, true);
        playerMeshesRef.current.delete(playerId);
        const staleMaterials = playerMaterialsRef.current.get(playerId) || [];
        staleMaterials.forEach((material) => material.dispose());
        playerMaterialsRef.current.delete(playerId);
        root = null;
      }
      if (!root) {
        root = createBikeRoot(scene, playerId, player.color);
        playerMeshesRef.current.set(playerId, root);
      }
      const hasPosition = Number.isFinite(player.x) && Number.isFinite(player.y);
      root.setEnabled(hasPosition);
      if (!hasPosition) continue;
      const targetPosition = new BABYLON.Vector3(player.x, player.alive ? 0.02 : -0.12, player.y);
      const targetRotationY = getDirectionRotation(player.dir);
      const hadTarget = Boolean(root.metadata?.targetPosition);
      root.metadata = {
        ...(root.metadata || {}),
        targetPosition,
        targetRotationY,
        targetReceivedAt: performance.now(),
        movementDirection: getDirectionVector(player.dir),
        movementSpeed:
          player.alive && state.phase === 'running'
            ? Number(player.speed || state.baseSpeed || 0)
            : 0,
        targetScale: player.alive ? 1 : 0.7,
        alive: player.alive,
        wallRiding: player.wallRiding,
        wallRideSide: player.wallRideSide,
        wallRideTime: player.wallRideTime || 0
      };
      root.metadata.sparkEmitter.position.x = player.wallRideSide === 'left' ? -0.52 : 0.52;
      root.metadata.sparks.emitRate = player.wallRiding && player.alive
        ? Math.min(220, 75 + (player.wallRideTime || 0) * 42)
        : 0;
      if (!hadTarget) {
        root.position.copyFrom(targetPosition);
        root.rotation.y = targetRotationY;
      }
    }
    for (const [playerId, root] of playerMeshesRef.current.entries()) {
      if (nextPlayerIds.has(playerId)) continue;
      root.metadata?.sparks?.dispose();
      root.dispose(false, true);
      playerMeshesRef.current.delete(playerId);
      const materials = playerMaterialsRef.current.get(playerId) || [];
      materials.forEach((material) => material.dispose());
      playerMaterialsRef.current.delete(playerId);
    }
  }, [createBikeRoot, ensureArena, syncTrailMesh]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = new BABYLON.Engine(canvasRef.current, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true
    });
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.001, 0.004, 0.012, 1);
    sceneRef.current = scene;
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.006;
    scene.fogColor = BABYLON.Color3.Black();

    const camera = new BABYLON.FollowCamera(
      'tron-follow-camera', new BABYLON.Vector3(0, 4.2, 12), scene
    );
    camera.radius = 12.4;
    camera.heightOffset = 3.7;
    camera.rotationOffset = 0;
    camera.cameraAcceleration = 0.16;
    camera.maxCameraSpeed = 18;
    camera.lowerRadiusLimit = 9.5;
    camera.upperRadiusLimit = 17;
    cameraRef.current = camera;

    const hemi = new BABYLON.HemisphericLight(
      'tron-hemi', new BABYLON.Vector3(0, 1, 0), scene
    );
    hemi.intensity = 0.48;
    const overhead = new BABYLON.PointLight(
      'tron-overhead', new BABYLON.Vector3(0, 32, 0), scene
    );
    overhead.diffuse = new BABYLON.Color3(0.72, 0.74, 0.78);
    overhead.intensity = 0.72;
    const glow = new BABYLON.GlowLayer('tron-glow', scene, { blurKernelSize: 48 });
    glow.intensity = 0.72;
    glowRef.current = glow;

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(0.05, scene.getEngine().getDeltaTime() / 1000);
      const positionAlpha = Math.min(1, dt * 18);
      const rotationAlpha = Math.min(1, dt * 22);
      for (const root of playerMeshesRef.current.values()) {
        const metadata = root.metadata || {};
        if (metadata.targetPosition) {
          const snapshotAge = Math.min(
            0.14,
            Math.max(0, (performance.now() - Number(metadata.targetReceivedAt || 0)) / 1000)
          );
          const predictedPosition = metadata.targetPosition.add(
            (metadata.movementDirection || BABYLON.Vector3.Zero()).scale(
              Number(metadata.movementSpeed || 0) * snapshotAge
            )
          );
          root.position = BABYLON.Vector3.Lerp(root.position, predictedPosition, positionAlpha);
        }
        if (Number.isFinite(metadata.targetRotationY)) {
          root.rotation.y = lerpAngle(root.rotation.y, metadata.targetRotationY, rotationAlpha);
        }
        const targetScale = Number(metadata.targetScale || 1);
        const nextScale = BABYLON.Scalar.Lerp(root.scaling.x || 1, targetScale, positionAlpha);
        root.scaling.setAll(nextScale);
        root.rotation.z = BABYLON.Scalar.Lerp(
          root.rotation.z,
          metadata.wallRiding
            ? metadata.wallRideSide === 'left' ? -0.09 : 0.09
            : 0,
          Math.min(1, dt * 8)
        );
        const wheelRotation = (Number(metadata.movementSpeed) || 0) * dt / 0.62;
        for (const wheelSpin of metadata.wheelSpins || []) {
          wheelSpin.rotation.y += wheelRotation;
        }
      }

      // Every player owns one ribbon. Its last vertex follows the smoothed bike
      // each rendered frame, so the wall is drawn continuously rather than in
      // visible network-tick-sized blocks.
      for (const [ownerId, trailMesh] of trailMeshesRef.current.entries()) {
        const ownerRoot = playerMeshesRef.current.get(ownerId);
        const pathPoints = trailMesh.metadata?.pathPoints;
        if (!ownerRoot?.metadata?.alive || !Array.isArray(pathPoints) || pathPoints.length < 2) {
          continue;
        }
        const lastPoint = pathPoints[pathPoints.length - 1];
        const movementDirection = ownerRoot.metadata.movementDirection || BABYLON.Vector3.Zero();
        const desiredTrailEnd = ownerRoot.position.subtract(
          movementDirection.scale(TRAIL_REAR_OFFSET)
        );
        const currentSegmentStart = pathPoints[pathPoints.length - 2];
        const distanceFromCorner =
          (desiredTrailEnd.x - currentSegmentStart.x) * movementDirection.x +
          (desiredTrailEnd.z - currentSegmentStart.y) * movementDirection.z;
        const visualTrailEndX = distanceFromCorner > 0
          ? desiredTrailEnd.x
          : currentSegmentStart.x;
        const visualTrailEndY = distanceFromCorner > 0
          ? desiredTrailEnd.z
          : currentSegmentStart.y;
        if (
          Math.abs(lastPoint.x - visualTrailEndX) < 0.002 &&
          Math.abs(lastPoint.y - visualTrailEndY) < 0.002
        ) {
          continue;
        }
        lastPoint.x = visualTrailEndX;
        lastPoint.y = visualTrailEndY;
        const renderedPathArray = buildTrailRibbonPaths(pathPoints);
        BABYLON.MeshBuilder.CreateRibbon(
          `light-wall-${ownerId}`,
          {
            pathArray: renderedPathArray,
            closeArray: true,
            instance: trailMesh
          },
          scene
        );
        BABYLON.MeshBuilder.CreateLineSystem(
          `light-wall-border-${ownerId}`,
          {
            lines: buildTrailBorderLines(renderedPathArray),
            instance: trailMesh.metadata.borderMesh
          },
          scene
        );
      }

      const state = arenaStateRef.current;
      const myPlayer = state.players.find((player) => player.socketId === socketIdRef.current);
      const myRoot = playerMeshesRef.current.get(socketIdRef.current);
      if (myPlayer && myRoot && Number.isFinite(myPlayer.x) && Number.isFinite(myPlayer.y)) {
        camera.lockedTarget = myRoot.metadata?.cameraAnchor || myRoot;
        camera.radius = BABYLON.Scalar.Lerp(
          camera.radius,
          12.4 + (Number(myPlayer.speedPercent) || 0) * 0.025,
          Math.min(1, dt * 2.5)
        );
      } else {
        camera.lockedTarget = null;
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.position.copyFromFloats(0, 48, 34);
      }
    });

    ensureArena(scene, FALLBACK_ARENA_SIZE);
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      disposeSceneObjects();
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
      engineRef.current = null;
      cameraRef.current = null;
      glowRef.current = null;
      arenaMeshesRef.current = [];
      arenaSizeRef.current = 0;
    };
  }, [disposeSceneObjects, ensureArena]);

  useEffect(() => syncScene(arenaState), [arenaState, syncScene]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (inGame) document.body.style.overflow = 'hidden';
    const resizeFrame = window.requestAnimationFrame(() => engineRef.current?.resize());
    return () => {
      window.cancelAnimationFrame(resizeFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [inGame]);

  useEffect(() => {
    const socket = io(`${resolveTronSocketUrl()}/tron`, {
      transports: ['polling', 'websocket'],
      auth: token ? { token } : {},
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      timeout: 8000
    });
    socketRef.current = socket;
    setError('');
    setConnectionState('connecting');
    socket.on('connect', () => {
      setConnectionState('connected');
      setSocketId(socket.id);
      setError('');
      if (pendingJoinRoomRef.current) {
        socket.emit('tron:join', {
          roomId: pendingJoinRoomRef.current,
          username: displayNameRef.current,
          color: selectedColorRef.current,
          password: pendingJoinPasswordRef.current
        });
      }
      socket.emit('tron:list');
    });
    socket.on('disconnect', () => {
      setConnectionState('disconnected');
      setSocketId('');
    });
    socket.on('connect_error', (connectError) => {
      setConnectionState('error');
      setJoinPending(false);
      setError(
        connectError?.message === 'timeout'
          ? tronText(languageRef.current, 'backendTimeout')
          : tronText(languageRef.current, 'connectionFailed')
      );
    });
    socket.on('tron:error', (payload) => {
      pendingJoinRoomRef.current = '';
      pendingJoinPasswordRef.current = '';
      setJoinPending(false);
      setError(tronRoomError(languageRef.current, payload));
    });
    socket.on('tron:lobby', (payload) => {
      setLobbyRooms(Array.isArray(payload?.rooms) ? payload.rooms : []);
    });
    socket.on('tron:created', (payload) => {
      const roomId = sanitizeRoomId(payload?.roomId);
      pendingJoinRoomRef.current = roomId;
      pendingJoinPasswordRef.current = '';
      setActiveRoomId(roomId);
    });
    socket.on('tron:leaderboard-updated', () => {
      setLeaderboardVersion((version) => version + 1);
    });
    socket.on('tron:state', (state) => {
      const nextState = { ...initialArenaState, ...state };
      setArenaState(nextState);
      const joinedPlayer = nextState.players.some((player) => player.socketId === socket.id);
      if (
        pendingJoinRoomRef.current &&
        nextState.roomId === pendingJoinRoomRef.current &&
        joinedPlayer
      ) {
        setActiveRoomId(nextState.roomId);
        activeRoomIdRef.current = nextState.roomId;
        pendingJoinRoomRef.current = '';
        pendingJoinPasswordRef.current = '';
        setJoinPending(false);
        setInGame(true);
      }
    });
    return () => {
      socket.emit('tron:leave');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      pendingJoinRoomRef.current = '';
      pendingJoinPasswordRef.current = '';
      setArenaState(initialArenaState);
    };
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setLeaderboardLoading(true);
    fetch(`/api/tron/leaderboard?month=${encodeURIComponent(leaderboardMonth)}`, {
      signal: controller.signal,
      credentials: 'include'
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(tronText(languageRef.current, 'leaderboardFailed'));
        setLeaderboard(Array.isArray(payload.leaderboard) ? payload.leaderboard : []);
        setLeaderboardMonths(
          Array.isArray(payload.availableMonths) && payload.availableMonths.length
            ? payload.availableMonths
            : [leaderboardMonth]
        );
      })
      .catch((fetchError) => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLeaderboardLoading(false);
      });
    return () => controller.abort();
  }, [leaderboardMonth, leaderboardVersion]);

  const sendTurn = useCallback((turn) => {
    if (turn !== 'left' && turn !== 'right') return;
    socketRef.current?.emit('tron:turn', { turn });
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const turn = KEY_TO_TURN[String(event.key || '').toLowerCase()];
      if (!turn || event.repeat) return;
      const targetTag = String(event.target?.tagName || '').toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;
      event.preventDefault();
      sendTurn(turn);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sendTurn]);

  useEffect(() => {
    if (arenaState.phase !== 'countdown') return undefined;
    const interval = window.setInterval(() => setClockNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, [arenaState.phase]);

  const joinRoom = useCallback((requestedRoomId, password = '') => {
    const nextRoomId = sanitizeRoomId(requestedRoomId);
    setError('');
    setJoinPending(true);
    pendingJoinRoomRef.current = nextRoomId;
    pendingJoinPasswordRef.current = password;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setJoinPending(false);
      pendingJoinRoomRef.current = '';
      pendingJoinPasswordRef.current = '';
      setError(tronText(languageRef.current, 'arenaNotConnected'));
      return;
    }
    socket.emit('tron:join', {
      roomId: nextRoomId,
      username: displayNameRef.current,
      color: selectedColorRef.current,
      password
    });
  }, []);

  const handleCreateRoom = useCallback((event) => {
    event.preventDefault();
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError(tronText(languageRef.current, 'arenaNotConnected'));
      return;
    }
    setError('');
    setJoinPending(true);
    pendingJoinRoomRef.current = '__creating__';
    socket.emit('tron:create', {
      name: createRoomName,
      visibility: createVisibility,
      password: createVisibility === 'private' ? createPassword : '',
      username: displayNameRef.current,
      color: selectedColorRef.current
    });
  }, [createPassword, createRoomName, createVisibility]);

  const handleSoloGame = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError(tronText(languageRef.current, 'arenaNotConnected'));
      return;
    }
    setError('');
    setJoinPending(true);
    pendingJoinRoomRef.current = '__creating__';
    socket.emit('tron:create', {
      mode: 'solo',
      username: displayNameRef.current,
      color: selectedColorRef.current
    });
  }, []);

  const handleLeaveGame = useCallback(() => {
    pendingJoinRoomRef.current = '';
    pendingJoinPasswordRef.current = '';
    socketRef.current?.emit('tron:leave');
    setJoinPending(false);
    setInGame(false);
    setArenaState(initialArenaState);
  }, []);

  const myPlayer = useMemo(
    () => arenaState.players.find((player) => player.socketId === socketId) || null,
    [arenaState.players, socketId]
  );
  const aliveCount = useMemo(
    () => arenaState.players.filter((player) => player.alive).length,
    [arenaState.players]
  );
  const countdown = arenaState.phase === 'countdown'
    ? Math.max(1, Math.ceil((Number(arenaState.countdownEndsAt) - clockNow) / 1000))
    : null;
  const speedPercent = Math.max(0, Math.min(100, Number(myPlayer?.speedPercent) || 0));
  const displaySpeed = Math.round(
    (Number(myPlayer?.speed) || arenaState.baseSpeed) * SPEED_TO_KMH
  );

  return (
    <div className={`tron-page ${inGame ? 'is-playing' : 'is-lobby'}`}>
      <main className="tron-stage">
        <section className="tron-canvas-panel">
          <canvas ref={canvasRef} className="tron-canvas" aria-label={t('arenaAria')} />

          {!inGame ? (
            <div className="tron-lobby-overlay">
              <section className="tron-lobby-card">
                <span className="tron-kicker">LIGHT CYCLE PROGRAM</span>
                <h1>TRON: NEON ARENA</h1>
                <p>{t('intro')}</p>

                <div className="tron-server-state">
                  <i className={`tron-connection ${connectionState}`} />
                  <span>
                    {connectionState === 'connected'
                      ? t('arenaReady')
                      : connectionState === 'connecting'
                        ? t('connecting')
                        : t('reconnecting')}
                  </span>
                </div>

                <fieldset className="tron-color-picker">
                  <legend>{t('trailColor')}</legend>
                  <div>
                    {TRAIL_COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={selectedColor === option.value ? 'is-selected' : ''}
                        style={{ '--trail-color': option.value }}
                        onClick={() => setSelectedColor(option.value)}
                        aria-label={t(option.labelKey)}
                        aria-pressed={selectedColor === option.value}
                        title={t(option.labelKey)}
                      >
                        <i />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  className="tron-solo-button"
                  onClick={handleSoloGame}
                  disabled={joinPending}
                >
                  <span>{t('trainingMode')}</span>
                  <strong>{joinPending ? t('joining') : t('playSolo')}</strong>
                  <small>{t('soloHint')}</small>
                </button>

                <div className="tron-menu-divider"><span>{t('multiplayer')}</span></div>

                <div className="tron-multiplayer-lobby">
                  <section className="tron-room-browser">
                    <header>
                      <div>
                        <span>{t('activeGames')}</span>
                        <strong>{lobbyRooms.length}</strong>
                      </div>
                      <button type="button" onClick={() => socketRef.current?.emit('tron:list')}>
                        {t('refresh')}
                      </button>
                    </header>
                    <div className="tron-room-list">
                      {lobbyRooms.length ? lobbyRooms.map((room) => (
                        <article key={room.roomId} className={room.isPrivate ? 'is-private' : ''}>
                          <div className="tron-room-summary">
                            <strong>{room.name}</strong>
                            <small>
                              {room.isPrivate ? `🔒 ${t('private')}` : t('public')} · {tronPhaseLabel(language, room.phase)}
                            </small>
                          </div>
                          <span className="tron-room-capacity">
                            {room.playerCount}/{room.maxPlayers}
                          </span>
                          {room.isPrivate ? (
                            <input
                              type="password"
                              value={roomPasswords[room.roomId] || ''}
                              onChange={(event) => setRoomPasswords((passwords) => ({
                                ...passwords,
                                [room.roomId]: event.target.value
                              }))}
                              placeholder={t('password')}
                              maxLength={72}
                              aria-label={t('roomPasswordAria', { room: room.name })}
                            />
                          ) : null}
                          <button
                            type="button"
                            disabled={joinPending || room.playerCount >= room.maxPlayers}
                            onClick={() => joinRoom(room.roomId, roomPasswords[room.roomId] || '')}
                          >
                            {room.playerCount >= room.maxPlayers ? t('full') : t('join')}
                          </button>
                        </article>
                      )) : (
                        <div className="tron-empty-state">
                          {t('noRooms')}
                        </div>
                      )}
                    </div>
                  </section>

                  <form className="tron-create-room" onSubmit={handleCreateRoom}>
                    <header>{t('createRoom')}</header>
                    <label htmlFor="tron-create-name">{t('gameName')}</label>
                    <input
                      id="tron-create-name"
                      value={createRoomName}
                      onChange={(event) => setCreateRoomName(event.target.value)}
                      placeholder={t('gameNamePlaceholder')}
                      minLength={3}
                      maxLength={36}
                      required
                    />
                    <div className="tron-visibility-switch">
                      <button
                        type="button"
                        className={createVisibility === 'public' ? 'is-active' : ''}
                        onClick={() => setCreateVisibility('public')}
                      >
                        {t('public')}
                      </button>
                      <button
                        type="button"
                        className={createVisibility === 'private' ? 'is-active' : ''}
                        onClick={() => setCreateVisibility('private')}
                      >
                        {t('private')}
                      </button>
                    </div>
                    {createVisibility === 'private' ? (
                      <>
                        <label htmlFor="tron-create-password">{t('password')}</label>
                        <input
                          id="tron-create-password"
                          type="password"
                          value={createPassword}
                          onChange={(event) => setCreatePassword(event.target.value)}
                          minLength={4}
                          maxLength={72}
                          required
                        />
                      </>
                    ) : null}
                    <button className="tron-create-submit" type="submit" disabled={joinPending}>
                      {joinPending ? t('creating') : t('createAndJoin')}
                    </button>
                  </form>
                </div>

                <section className="tron-leaderboard">
                  <header>
                    <div>
                      <span>{t('winsRanking')}</span>
                      <small>TOP 100</small>
                    </div>
                    <select
                      value={leaderboardMonth}
                      onChange={(event) => setLeaderboardMonth(event.target.value)}
                      aria-label={t('rankingMonth')}
                    >
                      {leaderboardMonths.map((month) => (
                        <option key={month} value={month}>{tronMonthLabel(language, month)}</option>
                      ))}
                    </select>
                  </header>
                  <ol>
                    {leaderboardLoading ? (
                      <li className="tron-empty-state">{t('loadingRanking')}</li>
                    ) : leaderboard.length ? leaderboard.map((entry) => (
                      <li key={entry.userId}>
                        <b>{String(entry.rank).padStart(2, '0')}</b>
                        <span>{entry.nickname}</span>
                        <strong>{entry.wins} {entry.wins === 1 ? t('win') : t('wins')}</strong>
                      </li>
                    )) : (
                      <li className="tron-empty-state">{t('noWins')}</li>
                    )}
                  </ol>
                  <p>
                    {user
                      ? t('winsAccount')
                      : t('winsLogin')}
                  </p>
                </section>

                {error ? <div className="tron-error">{error}</div> : null}
                <div className="tron-lobby-controls">{t('controls')}</div>
              </section>
            </div>
          ) : (
            <>
              <div className="tron-overlay tron-overlay-top">
                <div className="tron-round-block">
                  <span>{t('round')}</span>
                  <strong>{String(arenaState.round).padStart(2, '0')}</strong>
                </div>
                <div className="tron-phase-block">
                  <span>{tronPhaseLabel(language, arenaState.phase)}</span>
                  <strong>{aliveCount} / {arenaState.players.length}</strong>
                  <small>{t('activePrograms')}</small>
                </div>
                <div className="tron-room-block">
                  <span>{t('sector')}</span>
                  <strong>{arenaState.roomId || activeRoomId}</strong>
                </div>
                <button type="button" className="tron-exit-button" onClick={handleLeaveGame}>
                  {t('exit')}
                </button>
              </div>

              {countdown ? <div className="tron-countdown">{countdown}</div> : null}
              {arenaState.winner ? (
                <div className="tron-round-result">
                  <span>{t('roundWinner')}</span>
                  <strong style={{ color: arenaState.winner.color }}>{arenaState.winner.username}</strong>
                </div>
              ) : null}
              {myPlayer && !myPlayer.alive && !myPlayer.spectator && arenaState.phase === 'running' ? (
                <div className="tron-round-result tron-crashed">
                  <span>{t('programDeleted')}</span>
                  <strong>{t('spectating')}</strong>
                </div>
              ) : null}

              <div className="tron-speed-hud">
                <div className="tron-speed-readout">
                  <span>{t('speed')}</span>
                  <strong>{displaySpeed}</strong>
                  <small>km/h</small>
                </div>
                <div className="tron-energy">
                  <div className="tron-energy-label">
                    <span>{t('wallRideBoost')}</span>
                    <strong>{speedPercent}%</strong>
                  </div>
                  <div className="tron-energy-track">
                    <i style={{ width: `${speedPercent}%` }} />
                  </div>
                  <div className={`tron-slide-state ${myPlayer?.wallRiding ? 'is-active' : ''}`}>
                    {myPlayer?.wallRiding
                      ? t('wallRide', { side: t(myPlayer.wallRideSide === 'left' ? 'sideLeft' : 'sideRight') })
                      : t('hugWall')}
                  </div>
                </div>
              </div>

              <div className="tron-controls">
                <button type="button" onPointerDown={() => sendTurn('right')} aria-label={t('turnLeft')}>
                  <b>↶</b><span>A / ←</span>
                </button>
                <button type="button" onPointerDown={() => sendTurn('left')} aria-label={t('turnRight')}>
                  <b>↷</b><span>D / →</span>
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default TronArenaPage;
