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

const TYPE_LABELS: Record<ObstacleType, string> = {
  boost: 'Akcelerator',
  boulder: 'Głaz',
  gate: 'Brama',
  wall: 'Ściana',
  lowBarrier: 'Bariera do skoku',
  mine: 'Mina',
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
    setStatus('Dodano obiekt do wersji roboczej.');
  };

  const removeEvent = (index: number) => {
    setDraft((events) => events.filter((_, eventIndex) => eventIndex !== index));
    setStatus('Usunięto obiekt z wersji roboczej.');
  };

  const save = async () => {
    const sanitized = sanitizeTrackEvents(draft, track.length);
    if (!sanitized) {
      setStatus('Nie udało się zapisać układu: dane trasy są niepoprawne.');
      return;
    }

    setSaving(true);
    setStatus('Zapisywanie układu do pliku projektu…');
    try {
      const layouts = { ...trackLayouts, [trackId]: sanitized };
      const path = await persistTrackLayoutsToProject(layouts);
      saveTrackEvents(trackId, sanitized);
      setStatus(`Zapisano ${sanitized.length} obiektów w ${path}. Układ jest trwały i wejdzie do buildu.`);
    } catch (error) {
      setStatus(`Błąd zapisu plikowego: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm(`Przywrócić domyślny układ trasy ${track.name}?`)) return;
    setSaving(true);
    setStatus('Zapisywanie domyślnego układu do pliku projektu…');
    try {
      const defaults = TRACKS[trackId].events.map((event) => ({ ...event }));
      const layouts = { ...trackLayouts, [trackId]: defaults };
      const path = await persistTrackLayoutsToProject(layouts);
      resetTrackEvents(trackId);
      setStatus(`Przywrócono domyślny układ i zapisano go w ${path}.`);
    } catch (error) {
      setStatus(`Błąd zapisu plikowego: ${error instanceof Error ? error.message : 'nieznany błąd'}`);
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
    setStatus('Wyeksportowano kopię JSON.');
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { events?: unknown } | unknown[];
      const rawEvents = Array.isArray(parsed) ? parsed : parsed.events;
      const events = sanitizeTrackEvents(rawEvents, track.length);
      if (!events) throw new Error('invalid layout');
      setDraft(events);
      setStatus(`Wczytano ${events.length} obiektów. Kliknij ZAPISZ, aby zatwierdzić.`);
    } catch {
      setStatus('Plik nie zawiera poprawnego układu tej trasy.');
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
        <div className="editor-heading">EDYTOR TRASY</div>
        <div className="editor-track-tabs">
          {(Object.keys(TRACKS) as TrackId[]).map((id) => (
            <button key={id} className={id === trackId ? 'active' : ''} onClick={() => selectTrack(id)}>
              {TRACKS[id].name}
            </button>
          ))}
        </div>

        <label className="editor-label">Pozycja kursora</label>
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
        <div className="editor-help">Kółko/W–S: trasa · A/D: lewo/prawo · Shift: 25 m · Page Up/Down: 100 m</div>

        <label className="editor-label">Typ obiektu</label>
        <div className="editor-type-grid">
          {TYPE_ORDER.map((type) => (
            <button key={type} className={type === selectedType ? 'active' : ''} onClick={() => setSelectedType(type)}>
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <label className="editor-label">Pozycja w poprzek: {cursorX.toFixed(1)}</label>
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
          <button onClick={() => setCursorX(-2)}>LEWA</button>
          <button onClick={() => setCursorX(0)}>ŚRODEK</button>
          <button onClick={() => setCursorX(2)}>PRAWA</button>
        </div>

        <button className="editor-add" onClick={addEvent}>+ DODAJ NA {Math.round(cursorDistance)} m</button>

        <label className="editor-label">Obiekty ±18 m od kursora</label>
        <div className="editor-nearby">
          {nearby.length === 0 && <div className="editor-empty">Brak obiektów w pobliżu.</div>}
          {nearby.map(({ event, index }) => (
            <div className="editor-nearby-row" key={`${index}-${event.distance}-${event.type}`}>
              <span>{event.distance} m · {TYPE_LABELS[event.type]} · x {event.x.toFixed(1)}</span>
              <button onClick={() => removeEvent(index)}>USUŃ</button>
            </div>
          ))}
        </div>

        <div className="editor-stats">
          {draft.length} obiektów · {draft.filter((event) => event.type === 'boost').length} akceleratorów
        </div>
        {status && <div className="editor-status">{status}</div>}

        <div className="editor-actions">
          <button className="save" disabled={saving} onClick={() => void save()}>
            {saving ? 'ZAPISYWANIE…' : 'ZAPISZ TRASĘ DO PLIKU'}
          </button>
          <button onClick={exportJson}>EKSPORT JSON</button>
          <label className="editor-import">
            IMPORT JSON
            <input type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0])} />
          </label>
          <button disabled={saving} onClick={() => void reset()}>DOMYŚLNY UKŁAD</button>
          <button onClick={() => setPhase('menu')}>WRÓĆ DO MENU</button>
        </div>
      </aside>
    </div>
  );
}
