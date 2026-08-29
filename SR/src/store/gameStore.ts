import { create } from 'zustand';
import {
  BOOST_DURATION,
  FALSE_START_PENALTY_MS,
  canShiftGear,
  clampContinuousSpeedIncrease,
  getGearForSpeed,
  getNaturalAcceleration,
  getShiftQuality,
  getShiftProgress,
  getShiftStallDuration,
  getSpeedAfterBoost,
  getSpeedAfterShift,
  resolveCollision,
} from '../game/raceRules.ts';
import type { CollisionImpact, CollisionResolution } from '../game/raceRules.ts';
import { buildTrackEvents } from '../game/trackDesign.ts';
import authoredTrackFile from '../game/trackLayouts.json' with { type: 'json' };
import { fetchSwoopLeaderboard, submitSwoopRun } from '../services/swoopApi.ts';
import { getInitialGameLanguage, normalizeGameLanguage } from '../i18n.ts';
import type { GameLanguage } from '../i18n.ts';

export type GamePhase = 'menu' | 'editor' | 'countdown' | 'starting' | 'racing' | 'coasting' | 'finished';
export type TrackId   = 'taris' | 'tatooine' | 'manaan' | 'korriban';
export type ShiftQuality = 'perfect' | 'good' | 'early' | 'late' | 'none';

// Shift indicator fills based on how close speed is to gear max
// Perfect window: 95–100%, Good: 80–94%, Early: 0–79%, Late: >100%

// ─── Track events ─────────────────────────────────────────────────────────────
export type ObstacleType =
  | 'boulder'        // głaz — omijaj bokiem
  | 'gate'           // bramka szczelinowa — przejedź środkiem
  | 'wall'           // ściana z przejściem — ustaw się wcześniej
  | 'lowBarrier'     // niska bariera — przeskocz lub omiń
  | 'mine'           // mina — silna kara
  | 'boost';         // pole przyspieszające

export interface TrackEvent {
  distance: number;
  type: ObstacleType;
  x: number;           // center x position
  width?: number;      // for gate gap / wall gap
  side?: 'left' | 'right' | 'center'; // for wall gap position
}

export interface TrackDef {
  id: TrackId;
  name: string;
  subtitle: string;
  length: number;
  color: string;
  record: number;     // best time in ms
  events: TrackEvent[];
}

export const TRACKS: Record<TrackId, TrackDef> = {
  taris: {
    id: 'taris',
    name: 'Taris',
    subtitle: 'Łatwa · 2650 m',
    length: 2650,
    color: '#4fa3e0',
    record: 43500,
    events: buildTrackEvents(12, 244, 0, 0),
  },
  tatooine: {
    id: 'tatooine',
    name: 'Tatooine',
    subtitle: 'Dużo przeszkód · 4200 m',
    length: 4200,
    color: '#e0a043',
    record: 59000,
    events: buildTrackEvents(17, 242, 2, 1),
  },
  manaan: {
    id: 'manaan',
    name: 'Manaan',
    subtitle: 'Wąski tunel · 5100 m',
    length: 5100,
    color: '#43b8e0',
    record: 68100,
    events: buildTrackEvents(21, 238, 4, 2),
  },
  korriban: {
    id: 'korriban',
    name: 'Korriban',
    subtitle: 'Szybka i niebezpieczna · 6000 m',
    length: 6000,
    color: '#c0392b',
    record: 77200,
    events: buildTrackEvents(25, 236, 6, 3),
  },
};

export type TrackLayouts = Record<TrackId, TrackEvent[]>;

const TRACK_LAYOUT_STORAGE_KEY = 'swoop-racer-track-layouts-v1';
const TRACK_IDS: TrackId[] = ['taris', 'tatooine', 'manaan', 'korriban'];
const EVENT_TYPES: ObstacleType[] = ['boulder', 'gate', 'wall', 'lowBarrier', 'mine', 'boost'];

function cloneEvents(events: TrackEvent[]): TrackEvent[] {
  return events.map((event) => ({ ...event }));
}

function defaultTrackLayouts(): TrackLayouts {
  return Object.fromEntries(
    TRACK_IDS.map((id) => [id, cloneEvents(TRACKS[id].events)]),
  ) as TrackLayouts;
}

function applyLayoutSource(layouts: TrackLayouts, source: unknown): void {
  if (!source || typeof source !== 'object') return;
  const records = source as Partial<Record<TrackId, unknown>>;
  for (const id of TRACK_IDS) {
    const sanitized = sanitizeTrackEvents(records[id], TRACKS[id].length);
    if (sanitized) layouts[id] = sanitized;
  }
}

export function sanitizeTrackEvents(value: unknown, trackLength: number): TrackEvent[] | null {
  if (!Array.isArray(value)) return null;
  const events: TrackEvent[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const event = raw as Partial<TrackEvent>;
    if (!EVENT_TYPES.includes(event.type as ObstacleType)) return null;
    if (!Number.isFinite(event.distance) || !Number.isFinite(event.x)) return null;

    const distance = Math.round(Math.max(1, Math.min(trackLength - 1, event.distance as number)));
    const x = Math.max(-2.6, Math.min(2.6, event.x as number));
    const clean: TrackEvent = { distance, type: event.type as ObstacleType, x };
    if (event.width !== undefined && Number.isFinite(event.width)) {
      clean.width = Math.max(1.4, Math.min(4.5, event.width));
    }
    if (event.side === 'left' || event.side === 'right' || event.side === 'center') {
      clean.side = event.side;
    }
    events.push(clean);
  }

  return events.sort((a, b) => a.distance - b.distance);
}

function loadTrackLayouts(): TrackLayouts {
  const defaults = defaultTrackLayouts();
  const file = authoredTrackFile as { tracks?: unknown };
  applyLayoutSource(defaults, file.tracks);

  // The project file is canonical. Remove the old browser-only copy so a stale
  // editor session cannot silently replace a shipped track layout.
  if (typeof localStorage === 'undefined') return defaults;
  try {
    localStorage.removeItem(TRACK_LAYOUT_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; the authored project file still works.
  }
  return defaults;
}

export async function persistTrackLayoutsToProject(layouts: TrackLayouts): Promise<string> {
  const response = await fetch('/api/track-layouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, tracks: layouts }),
  });
  const result = await response.json().catch(() => null) as { ok?: boolean; path?: string; error?: string } | null;
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error ?? 'Serwer tej wersji aplikacji nie obsługuje zapisu plikowego.');
  }

  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TRACK_LAYOUT_STORAGE_KEY);
  } catch {
    // The project file is already authoritative; stale legacy storage is harmless.
  }
  return result.path ?? 'src/game/trackLayouts.json';
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank?: number;
  userId?: string;
  nickname: string;
  trackId: TrackId;
  timeMs: number;
  collisions: number;
  updatedAt?: string;
}

export interface HostUser {
  id: string;
  username: string;
  displayName?: string;
  role?: string;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { nickname: 'DarthMarcin', trackId: 'taris',    timeMs: 43500, collisions: 0 },
  { nickname: 'RevanPL',     trackId: 'taris',    timeMs: 44500, collisions: 1 },
  { nickname: 'SwoopMaster', trackId: 'taris',    timeMs: 46200, collisions: 2 },
  { nickname: 'Malak',       trackId: 'tatooine', timeMs: 59000, collisions: 0 },
  { nickname: 'BastilaShan', trackId: 'tatooine', timeMs: 60350, collisions: 1 },
  { nickname: 'CandOrdo',    trackId: 'manaan',   timeMs: 68100, collisions: 0 },
  { nickname: 'JolieeB',     trackId: 'korriban', timeMs: 77200, collisions: 2 },
];

const LEADERBOARD_STORAGE_KEY = 'swoop-racer-leaderboard-v4';

function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof localStorage === 'undefined') return DEFAULT_LEADERBOARD;
  try {
    const stored = JSON.parse(localStorage.getItem(LEADERBOARD_STORAGE_KEY) ?? 'null');
    return Array.isArray(stored) ? stored : DEFAULT_LEADERBOARD;
  } catch {
    return DEFAULT_LEADERBOARD;
  }
}

function loadNickname(): string {
  if (typeof localStorage === 'undefined') return 'Racer';
  try {
    return localStorage.getItem('swoop-racer-nickname') || 'Racer';
  } catch {
    return 'Racer';
  }
}

// ─── Game State ───────────────────────────────────────────────────────────────
interface GameState {
  language: GameLanguage;
  phase: GamePhase;
  selectedTrack: TrackId;
  countdownValue: number;        // 3,2,1,0=GO
  countdownStartTime: number;    // when GO appeared
  falseStart: boolean;

  // Race live state
  startTime: number;
  raceTime: number;
  travelledDistance: number;
  collisions: number;
  speed: number;                 // current speed (internal units, ~km/h)
  currentGear: number;           // 0–5
  shiftProgress: number;         // 0–1 (fill of shift indicator)
  shiftQuality: ShiftQuality;
  shiftQualityTimer: number;     // seconds to display quality label
  engineStallTimer: number;
  cameraShake: number;
  damage: number;                // 0–100
  collisionBlocked: boolean;

  // Boost flash
  boostActive: boolean;
  boostTimer: number;
  jumpCooldown: number;

  // Player nick
  playerNickname: string;
  hostUser: HostUser | null;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  leaderboardSource: 'local' | 'online';
  leaderboardError: string | null;
  scoreSubmitted: boolean;

  // Moderator track layouts
  trackEvents: TrackLayouts;

  // Actions
  setLanguage: (language: unknown) => void;
  setPhase: (p: GamePhase) => void;
  selectTrack: (id: TrackId) => void;
  setCountdown: (v: number) => void;
  startRace: () => void;
  engageGear: () => void;           // LMB click
  updateRace: (dt: number, dist: number, speed: number, shiftProgress: number, jumpCooldown: number) => void;
  updateCoasting: (dt: number, dist: number, speed: number) => void;
  registerCollision: (impact: CollisionImpact) => CollisionResolution;
  registerBoost: () => void;
  finishRace: () => void;
  completeRace: () => void;
  resetRace: () => void;
  setCameraShake: (v: number) => void;
  setCollisionBlocked: (blocked: boolean) => void;
  setNickname: (n: string) => void;
  setHostUser: (user: HostUser | null) => void;
  syncLeaderboard: (trackId: TrackId) => Promise<void>;
  submitScore: () => Promise<void>;
  tickShiftQuality: (dt: number) => void;
  saveTrackEvents: (id: TrackId, events: TrackEvent[]) => boolean;
  resetTrackEvents: (id: TrackId) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  language: getInitialGameLanguage(),
  phase: 'menu',
  selectedTrack: 'taris',
  countdownValue: 3,
  countdownStartTime: 0,
  falseStart: false,

  startTime: 0,
  raceTime: 0,
  travelledDistance: 0,
  collisions: 0,
  speed: 0,
  currentGear: 0,
  shiftProgress: 0,
  shiftQuality: 'none',
  shiftQualityTimer: 0,
  engineStallTimer: 0,
  cameraShake: 0,
  damage: 0,
  collisionBlocked: false,

  boostActive: false,
  boostTimer: 0,
  jumpCooldown: 0,

  playerNickname: loadNickname(),
  hostUser: null,

  leaderboard: loadLeaderboard(),
  leaderboardSource: 'local',
  leaderboardError: null,
  scoreSubmitted: false,
  trackEvents: loadTrackLayouts(),

  setLanguage: (language) => set({ language: normalizeGameLanguage(language) }),
  setPhase: (p) => p === 'countdown'
    ? set({
        phase: p,
        countdownValue: 3,
        falseStart: false,
        scoreSubmitted: false,
        raceTime: 0,
        travelledDistance: 0,
        collisions: 0,
        speed: 0,
        currentGear: 0,
        shiftProgress: 0,
        shiftQuality: 'none',
        shiftQualityTimer: 0,
        engineStallTimer: 0,
        damage: 0,
        collisionBlocked: false,
        boostActive: false,
        boostTimer: 0,
        jumpCooldown: 0,
      })
    : set({ phase: p }),
  selectTrack: (id) => set({ selectedTrack: id }),
  setCountdown: (v) => set({ countdownValue: v }),
  setCameraShake: (v) => set({ cameraShake: v }),
  setCollisionBlocked: (blocked) => set({ collisionBlocked: blocked }),
  setNickname: (n) => {
    if (get().hostUser) return;
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('swoop-racer-nickname', n);
    } catch {
      // Storage can be unavailable in privacy-restricted contexts.
    }
    set({ playerNickname: n });
  },
  setHostUser: (user) => set({
    hostUser: user,
    playerNickname: user?.displayName || user?.username || get().playerNickname,
  }),
  syncLeaderboard: async (trackId) => {
    try {
      const onlineEntries = await fetchSwoopLeaderboard(trackId);
      set((state) => ({
        leaderboard: [
          ...state.leaderboard.filter((entry) => entry.trackId !== trackId),
          ...onlineEntries,
        ].sort((a, b) => a.timeMs - b.timeMs),
        leaderboardSource: 'online',
        leaderboardError: null,
      }));
    } catch {
      // Standalone Vite development intentionally keeps the local leaderboard.
      set({ leaderboardError: 'leaderboardUnavailable' });
    }
  },

  saveTrackEvents: (id, events) => {
    const sanitized = sanitizeTrackEvents(events, TRACKS[id].length);
    if (!sanitized) return false;
    const layouts = { ...get().trackEvents, [id]: sanitized };
    set({ trackEvents: layouts });
    return true;
  },

  resetTrackEvents: (id) => {
    const layouts = { ...get().trackEvents, [id]: loadTrackLayouts()[id] };
    set({ trackEvents: layouts });
  },

  startRace: () => set({
    phase: 'starting',           // waiting for first LMB
    startTime: 0,
    raceTime: 0,
    travelledDistance: 0,
    collisions: 0,
    speed: 0,
    currentGear: 0,
    shiftProgress: 0,
    shiftQuality: get().falseStart ? 'early' : 'none',
    shiftQualityTimer: get().falseStart ? 1.5 : 0,
    engineStallTimer: get().falseStart ? 1.2 : 0,
    cameraShake: 0,
    damage: 0,
    collisionBlocked: false,
    boostActive: false,
    boostTimer: 0,
    jumpCooldown: 0,
    countdownStartTime: performance.now(),
    scoreSubmitted: false,
  }),

  // LMB click — start or shift gear
  engageGear: () => {
    const { phase, currentGear, shiftProgress, countdownStartTime } = get();

    if (phase === 'countdown') {
      set({
        falseStart: true,
        shiftQuality: 'early',
        shiftQualityTimer: 1.5,
      });
      return;
    }

    if (phase === 'starting') {
      const elapsed = performance.now() - countdownStartTime;
      // elapsed is ms since countdownStartTime (set when GO appeared)
      let quality: ShiftQuality = 'good';
      if (get().falseStart)   { quality = 'early'; }
      else if (elapsed < 0)   { quality = 'early'; }
      else if (elapsed < 150) { quality = 'perfect'; }
      else if (elapsed < 400) { quality = 'good'; }
      else                    { quality = 'late'; }

      set({
        phase: 'racing',
        startTime: performance.now() - (get().falseStart ? FALSE_START_PENALTY_MS : 0),
        currentGear: 1,
        speed: quality === 'early' ? 5 : quality === 'perfect' ? 10 : 8,
        shiftProgress: 0,
        shiftQuality: quality,
        shiftQualityTimer: 1.5,
        engineStallTimer: getShiftStallDuration(quality),
      });
      return;
    }

    if (phase !== 'racing') return;

    const gear = currentGear;
    if (gear >= 5) return; // already max

    const { speed } = get();
    const currentProgress = Math.max(shiftProgress, getShiftProgress(speed, gear));
    const quality = getShiftQuality(currentProgress);

    // A collision may reduce the selected gear by several levels. Each of
    // those gears must be earned again at its own shift speed; repeated clicks
    // can never restore the previous high gear while the vehicle is still slow.
    if (!canShiftGear(speed, gear)) {
      set({
        shiftQuality: 'early',
        shiftQualityTimer: 1.5,
        engineStallTimer: getShiftStallDuration('early'),
      });
      return;
    }

    const nextGear = Math.min(gear + 1, 5);

    // A bad shift must never accelerate the vehicle to the next gear minimum.
    const newSpeed = getSpeedAfterShift(speed, quality);

    set({
      currentGear: nextGear,
      shiftProgress: 0,
      speed: newSpeed,
      shiftQuality: quality,
      shiftQualityTimer: 1.5,
      engineStallTimer: getShiftStallDuration(quality),
    });
  },

  updateRace: (dt, dist, speed, shiftProgress, jumpCooldown) => set((state) => ({
    raceTime: (performance.now() - state.startTime) / 1000,
    travelledDistance: dist,
    speed: clampContinuousSpeedIncrease(
      state.speed,
      speed,
      dt,
      state.engineStallTimer <= 0 && !state.collisionBlocked,
      getNaturalAcceleration(state.speed, state.currentGear),
    ),
    shiftProgress,
    engineStallTimer: Math.max(0, state.engineStallTimer - dt),
    boostTimer: Math.max(0, state.boostTimer - dt),
    boostActive: state.boostTimer - dt > 0,
    jumpCooldown: Math.max(0, jumpCooldown),
  })),

  updateCoasting: (dt, dist, speed) => set({
    travelledDistance: dist,
    speed,
    boostTimer: Math.max(0, get().boostTimer - dt),
    boostActive: get().boostTimer - dt > 0,
  }),

  tickShiftQuality: (dt) => {
    const { shiftQualityTimer } = get();
    if (shiftQualityTimer > 0) {
      set({ shiftQualityTimer: shiftQualityTimer - dt });
    }
  },

  registerCollision: (impact) => {
    const { speed, damage, collisions } = get();
    const resolution = resolveCollision(impact);
    const newSpeed = speed * resolution.speedRetention;
    const newGear = getGearForSpeed(newSpeed);
    const newDamage = Math.min(100, damage + resolution.damage);
    set({
      speed: newSpeed,
      currentGear: newGear,
      damage: newDamage,
      collisions: collisions + 1,
      cameraShake: resolution.cameraShake,
      shiftProgress: getShiftProgress(newSpeed, newGear),
      engineStallTimer: 0,
      boostActive: false,
      boostTimer: 0,
      collisionBlocked: resolution.immobilized,
    });
    if (newDamage >= 100) {
      get().completeRace();
    }
    return resolution;
  },

  registerBoost: () => {
    const { speed, currentGear } = get();
    set({
      speed: getSpeedAfterBoost(speed, currentGear),
      boostActive: true,
      boostTimer: BOOST_DURATION,
    });
  },

  finishRace: () => set({ phase: 'coasting', boostActive: false, boostTimer: 0, collisionBlocked: false }),
  completeRace: () => set({ phase: 'finished', speed: 0, boostActive: false, boostTimer: 0, collisionBlocked: false }),

  resetRace: () => set({
    phase: 'menu',
    travelledDistance: 0,
    collisions: 0,
    raceTime: 0,
    speed: 0,
    currentGear: 0,
    shiftProgress: 0,
    engineStallTimer: 0,
    damage: 0,
    collisionBlocked: false,
    falseStart: false,
    scoreSubmitted: false,
    boostActive: false,
    boostTimer: 0,
    jumpCooldown: 0,
  }),

  submitScore: async () => {
    const { playerNickname, selectedTrack, raceTime, collisions, leaderboard, damage, scoreSubmitted, hostUser } = get();
    if (damage >= 100 || scoreSubmitted) return;

    const entry: LeaderboardEntry = {
      nickname: playerNickname,
      trackId:  selectedTrack,
      timeMs:   Math.round(raceTime * 1000),
      collisions,
    };
    const updated = [...leaderboard, entry].sort((a, b) => a.timeMs - b.timeMs);
    set({ leaderboard: updated, scoreSubmitted: true });

    if (hostUser) {
      try {
        const onlineEntries = await submitSwoopRun(entry);
        set((state) => ({
          leaderboard: [
            ...state.leaderboard.filter((item) => item.trackId !== selectedTrack),
            ...onlineEntries,
          ].sort((a, b) => a.timeMs - b.timeMs),
          leaderboardSource: 'online',
          leaderboardError: null,
        }));
      } catch {
        set({ leaderboardError: 'scoreSaveFailed' });
      }
      return;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {
      // The in-memory result remains valid for the current session.
    }
  },
}));
