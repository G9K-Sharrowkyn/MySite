import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { FinishLine } from './Player';
import { Obstacles } from './Obstacles';
import { EnvironmentAtmosphere, TrackEnvironment } from './TrackEnvironment';
import {
  TRACKS,
  persistTrackLayoutsToProject,
  sanitizeTrackEvents,
  useGameStore,
} from '../store/gameStore';
import type { ObstacleType, TrackEvent, TrackId } from '../store/gameStore';
import { swoopText } from '../i18n';
import type { SwoopTranslationKey } from '../i18n';

const TYPE_LABEL_KEYS: Record<ObstacleType, SwoopTranslationKey> = {
  boost: 'typeBoost',
  boulder: 'typeBoulder',
  gate: 'typeGate',
  wall: 'typeWall',
  lowBarrier: 'typeLowBarrier',
  mine: 'typeMine',
};

const TYPE_ORDER: ObstacleType[] = ['boost', 'boulder', 'gate', 'wall', 'lowBarrier', 'mine'];
const CURSOR_AHEAD = 12;

function EditorMarker({ x }: { x: number }) {
  return (
    <group position={[x, 0, -CURSOR_AHEAD]}>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.94, 32]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 3, 8]} />
        <meshBasicMaterial color="#00ffcc" transparent opacity={0.65} />
      </mesh>
      <pointLight position={[0, 0.35, 0]} color="#00ffcc" intensity={3} distance={5} />
    </group>
  );
}

function EditorScene({
  distance,
  cursorX,
  events,
}: {
  distance: number;
  cursorX: number;
  events: TrackEvent[];
}) {
  const trackId = useGameStore((state) => state.selectedTrack);
  const track = TRACKS[trackId];
  const distanceRef = useRef(distance);
  const playerPositionRef = useRef(new THREE.Vector3(99, 99, 99));
  const solidContactRef = useRef(false);
  distanceRef.current = distance;

  return (
    <>
      <EnvironmentAtmosphere trackId={trackId} />

      <TrackEnvironment trackId={trackId} distanceRef={distanceRef} />
      <FinishLine distanceRef={distanceRef} trackLength={track.length} />
      <Obstacles
        distanceRef={distanceRef}
        playerPositionRef={playerPositionRef}
        solidContactRef={solidContactRef}
        onCollision={() => undefined}
        onBoost={() => undefined}
        eventsOverride={events}
      />
      <EditorMarker x={cursorX} />
    </>
  );
}

export function TrackEditor() {
  const language = useGameStore((state) => state.language);
  const phase = useGameStore((state) => state.phase);
  const trackId = useGameStore((state) => state.selectedTrack);
  const savedEvents = useGameStore((state) => state.trackEvents[trackId]);
  const trackLayouts = useGameStore((state) => state.trackEvents);
  const selectTrack = useGameStore((state) => state.selectTrack);
  const setPhase = useGameStore((state) => state.setPhase);
  const saveTrackEvents = useGameStore((state) => state.saveTrackEvents);
  const resetTrackEvents = useGameStore((state) => state.resetTrackEvents);
  const track = TRACKS[trackId];

  const [draft, setDraft] = useState<TrackEvent[]>(() => savedEvents.map((event) => ({ ...event })));
  const [cursorDistance, setCursorDistance] = useState(50);
  const [cursorX, setCursorX] = useState(0);
  const [selectedType, setSelectedType] = useState<ObstacleType>('boost');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const t = (key: SwoopTranslationKey, values: Record<string, string | number> = {}) => swoopText(language, key, values);

  useEffect(() => {
    setDraft(savedEvents.map((event) => ({ ...event })));
    setCursorDistance((value) => Math.min(value, track.length - 1));
    setStatus('');
  }, [savedEvents, track.length, trackId]);

  useEffect(() => {
    if (phase !== 'editor') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      const step = event.shiftKey ? 25 : 5;
      if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        event.preventDefault();
        setCursorDistance((value) => Math.min(track.length - 1, value + step));
      }
      if (event.key === 's' || event.key === 'S' || event.key === 'ArrowDown') {
        event.preventDefault();
        setCursorDistance((value) => Math.max(1, value - step));
      }
      if (event.key === 'a' || event.key === 'A' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setCursorX((value) => Math.max(-2.4, Number((value - 0.2).toFixed(1))));
      }
      if (event.key === 'd' || event.key === 'D' || event.key === 'ArrowRight') {
        event.preventDefault();
        setCursorX((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))));
      }
      if (event.key === 'PageUp') {
        event.preventDefault();
        setCursorDistance((value) => Math.min(track.length - 1, value + 100));
      }
      if (event.key === 'PageDown') {
        event.preventDefault();
        setCursorDistance((value) => Math.max(1, value - 100));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, track.length]);

  const viewDistance = cursorDistance - CURSOR_AHEAD;
  const nearby = useMemo(
    () => draft
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => Math.abs(event.distance - cursorDistance) <= 18),
    [cursorDistance, draft],
  );

  if (phase !== 'editor') return null;

  const moveCursor = (delta: number) => {
    setCursorDistance((value) => Math.max(1, Math.min(track.length - 1, value + delta)));
  };

  const addEvent = () => {
    const event: TrackEvent = {
      distance: Math.round(cursorDistance),
      type: selectedType,
      x: selectedType === 'lowBarrier' || selectedType === 'wall' ? 0 : cursorX,
    };
    if (selectedType === 'gate') event.width = 2.2;
    if (selectedType === 'wall') {
      event.side = cursorX < -0.7 ? 'left' : cursorX > 0.7 ? 'right' : 'center';
    }
    setDraft((events) => [...events, event].sort((a, b) => a.distance - b.distance));
    setStatus(t('addedDraft'));
  };

  const removeEvent = (index: number) => {
    setDraft((events) => events.filter((_, eventIndex) => eventIndex !== index));
    setStatus(t('removedDraft'));
  };

  const save = async () => {
    const sanitized = sanitizeTrackEvents(draft, track.length);
    if (!sanitized) {
      setStatus(t('invalidLayout'));
      return;
    }

    setSaving(true);
    setStatus(t('savingProject'));
    try {
      const layouts = { ...trackLayouts, [trackId]: sanitized };
      const path = await persistTrackLayoutsToProject(layouts);
      saveTrackEvents(trackId, sanitized);
      setStatus(t('savedProject', { count: sanitized.length, path }));
    } catch (error) {
      setStatus(t('fileSaveError', { error: error instanceof Error ? error.message : t('unknownError') }));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(t('confirmReset', { track: track.name }))) return;
    setSaving(true);
    setStatus(t('savingDefault'));
    try {
      const defaults = TRACKS[trackId].events.map((event) => ({ ...event }));
      const layouts = { ...trackLayouts, [trackId]: defaults };
      const path = await persistTrackLayoutsToProject(layouts);
      resetTrackEvents(trackId);
      setStatus(t('restoredDefault', { path }));
    } catch (error) {
      setStatus(t('fileSaveError', { error: error instanceof Error ? error.message : t('unknownError') }));
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    const payload = JSON.stringify({ version: 1, trackId, length: track.length, events: draft }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `swoop-${trackId}-layout.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t('exportedJson'));
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { events?: unknown } | unknown[];
      const rawEvents = Array.isArray(parsed) ? parsed : parsed.events;
      const events = sanitizeTrackEvents(rawEvents, track.length);
      if (!events) throw new Error('invalid layout');
      setDraft(events);
      setStatus(t('importedJson', { count: events.length }));
    } catch {
      setStatus(t('invalidJson'));
    }
  };

  return (
    <div
      className="track-editor"
      onWheel={(event) => {
        if ((event.target as HTMLElement).closest('.track-editor-panel')) return;
        moveCursor(Math.sign(event.deltaY) * (event.shiftKey ? 25 : 5));
      }}
    >
      <Canvas
        camera={{ position: [0, 3.2, 8], fov: 68, near: 0.1, far: 400 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        dpr={[1, 1.5]}
      >
        <EditorScene
          distance={viewDistance}
          cursorX={cursorX}
          events={draft}
        />
      </Canvas>

      <aside className="track-editor-panel">
        <div className="editor-heading">{t('editorTitle')}</div>
        <div className="editor-track-tabs">
          {(Object.keys(TRACKS) as TrackId[]).map((id) => (
            <button key={id} className={id === trackId ? 'active' : ''} onClick={() => selectTrack(id)}>
              {TRACKS[id].name}
            </button>
          ))}
        </div>

        <label className="editor-label">{t('cursorPosition')}</label>
        <div className="editor-position-row">
          <button onClick={() => moveCursor(-50)}>−50</button>
          <input
            type="number"
            min={1}
            max={track.length - 1}
            value={cursorDistance}
            onChange={(event) => setCursorDistance(Math.max(1, Math.min(track.length - 1, Number(event.target.value))))}
          />
          <span>m</span>
          <button onClick={() => moveCursor(50)}>+50</button>
        </div>
        <input
          className="editor-route-slider"
          type="range"
          min={1}
          max={track.length - 1}
          value={cursorDistance}
          onChange={(event) => setCursorDistance(Number(event.target.value))}
        />
        <div className="editor-help">{t('editorHelp')}</div>

        <label className="editor-label">{t('objectType')}</label>
        <div className="editor-type-grid">
          {TYPE_ORDER.map((type) => (
            <button key={type} className={type === selectedType ? 'active' : ''} onClick={() => setSelectedType(type)}>
              {t(TYPE_LABEL_KEYS[type])}
            </button>
          ))}
        </div>

        <label className="editor-label">{t('crossPosition', { value: cursorX.toFixed(1) })}</label>
        <input
          className="editor-route-slider"
          type="range"
          min={-2.4}
          max={2.4}
          step={0.2}
          value={cursorX}
          onChange={(event) => setCursorX(Number(event.target.value))}
        />
        <div className="editor-lane-buttons">
          <button onClick={() => setCursorX(-2)}>{t('left')}</button>
          <button onClick={() => setCursorX(0)}>{t('center')}</button>
          <button onClick={() => setCursorX(2)}>{t('right')}</button>
        </div>

        <button className="editor-add" onClick={addEvent}>{t('addAt', { distance: Math.round(cursorDistance) })}</button>

        <label className="editor-label">{t('nearby')}</label>
        <div className="editor-nearby">
          {nearby.length === 0 && <div className="editor-empty">{t('noNearby')}</div>}
          {nearby.map(({ event, index }) => (
            <div className="editor-nearby-row" key={`${index}-${event.distance}-${event.type}`}>
              <span>{event.distance} m · {t(TYPE_LABEL_KEYS[event.type])} · x {event.x.toFixed(1)}</span>
              <button onClick={() => removeEvent(index)}>{t('remove')}</button>
            </div>
          ))}
        </div>

        <div className="editor-stats">
          {t('editorStats', { objects: draft.length, boosts: draft.filter((event) => event.type === 'boost').length })}
        </div>
        {status && <div className="editor-status">{status}</div>}

        <div className="editor-actions">
          <button className="save" disabled={saving} onClick={() => void save()}>
            {saving ? t('saving') : t('saveTrack')}
          </button>
          <button onClick={exportJson}>{t('exportJson')}</button>
          <label className="editor-import">
            {t('importJson')}
            <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0])} />
          </label>
          <button disabled={saving} onClick={() => void reset()}>{t('defaultLayout')}</button>
          <button onClick={() => setPhase('menu')}>{t('backToMenu')}</button>
        </div>
      </aside>
    </div>
  );
}
