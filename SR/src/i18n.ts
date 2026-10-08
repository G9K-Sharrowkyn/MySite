export type GameLanguage = 'en' | 'pl' | 'es';

const en = {
  startLights: 'Start lights', start: 'START', red: 'RED', warning: 'READY', signal: 'SIGNAL', vsRecord: 'VS RECORD',
  perfectShift: 'PERFECT SHIFT', goodShift: 'GOOD SHIFT', tooEarly: 'TOO EARLY', tooLate: 'TOO LATE',
  vehicleBlocked: 'VEHICLE BLOCKED', avoidObstacle: 'USE A / D TO CLEAR THE OBSTACLE', gear: 'GEAR',
  finishCoasting: 'FINISH · SLOWING DOWN', changeGear: 'LMB · SHIFT GEAR', prepareShift: 'PREPARE TO SHIFT',
  maxGear: 'MAXIMUM GEAR', engineSpeed: 'ENGINE SPEED', autoBraking: 'AUTOMATIC BRAKING', speed: 'SPEED',
  jumpReady: 'JUMP READY', jumpCooldown: 'JUMP {seconds} s', hull: 'HULL {percent}%',
  controlsAll: 'A/D · ← → — steer | Space — jump | LMB — shift gear',
  falseStart: 'FALSE START · ENGINE STALLED · CLICK LMB', greenStart: 'GREEN · CLICK LMB — START',
  getReady: 'GET READY', destroyed: '💥 VEHICLE DESTROYED!', finish: '🏁 FINISH!', yourTime: 'Your time',
  trackRecord: 'Track record', difference: 'Difference', collisions: 'Collisions', newRecord: '🏆 NEW TRACK RECORD!',
  again: '🔄 Race again', menu: '← Menu', gameSubtitle: 'Galactic racing · KOTOR Edition',
  geekfightsAccount: 'GeekFights account', nickname: 'Nickname', nicknamePlaceholder: 'Your nickname…',
  chooseTrack: 'Choose a track', online: 'ONLINE', local: 'LOCAL', noResults: 'No results yet. Set the first record!',
  race: '▶ RACE', trackEditor: '⚙ TRACK EDITOR', steer: '← A/D → — steer', jumpControl: 'Space — jump', shiftControl: 'LMB — shift gear',
  leaderboardUnavailable: 'The online leaderboard is temporarily unavailable.', scoreSaveFailed: 'Could not save the online result.',
  trackTaris: 'Easy · 2650 m', trackTatooine: 'Many obstacles · 4200 m', trackManaan: 'Narrow tunnel · 5100 m',
  trackKorriban: 'Fast and dangerous · 6000 m', trackTaris2: 'Cityscape test · 2650 m',
  editorTitle: 'TRACK EDITOR', cursorPosition: 'Cursor position', editorHelp: 'Wheel/W–S: route · A/D: left/right · Shift: 25 m · Page Up/Down: 100 m',
  objectType: 'Object type', crossPosition: 'Lateral position: {value}', left: 'LEFT', center: 'CENTER', right: 'RIGHT',
  addAt: '+ ADD AT {distance} m', nearby: 'Objects within ±18 m of cursor', noNearby: 'No nearby objects.', remove: 'REMOVE',
  editorStats: '{objects} objects · {boosts} accelerators', saving: 'SAVING…', saveTrack: 'SAVE TRACK TO FILE',
  exportJson: 'EXPORT JSON', importJson: 'IMPORT JSON', defaultLayout: 'DEFAULT LAYOUT', backToMenu: 'BACK TO MENU',
  typeBoost: 'Accelerator', typeBoulder: 'Boulder', typeGate: 'Gate', typeWall: 'Wall', typeLowBarrier: 'Jump barrier', typeMine: 'Mine',
  addedDraft: 'Object added to draft.', removedDraft: 'Object removed from draft.', invalidLayout: 'Could not save layout: track data is invalid.',
  savingProject: 'Saving layout to the project file…', savedProject: 'Saved {count} objects to {path}. The layout is permanent and will be included in the build.',
  fileSaveError: 'File save error: {error}', unknownError: 'unknown error', confirmReset: 'Restore the default layout for {track}?',
  savingDefault: 'Saving the default layout to the project file…', restoredDefault: 'Restored the default layout and saved it to {path}.',
  exportedJson: 'Exported a JSON copy.', importedJson: 'Loaded {count} objects. Click SAVE to confirm.', invalidJson: 'The file does not contain a valid layout for this track.'
} as const;

type TranslationKey = keyof typeof en;
type TranslationTable = Record<TranslationKey, string>;

const pl: TranslationTable = {
  startLights: 'Sygnalizacja startowa', start: 'START', red: 'CZERWONE', warning: 'UWAGA', signal: 'SYGNAŁ', vsRecord: 'VS REKORD',
  perfectShift: 'IDEALNA ZMIANA', goodShift: 'DOBRA ZMIANA', tooEarly: 'ZA WCZEŚNIE', tooLate: 'ZA PÓŹNO',
  vehicleBlocked: 'POJAZD ZABLOKOWANY', avoidObstacle: 'UŻYJ A / D, ABY OMINĄĆ PRZESZKODĘ', gear: 'BIEG',
  finishCoasting: 'META · WYTRACANIE PRĘDKOŚCI', changeGear: 'LPM · ZMIEŃ BIEG', prepareShift: 'PRZYGOTUJ ZMIANĘ',
  maxGear: 'MAKSYMALNY BIEG', engineSpeed: 'PRĘDKOŚĆ SILNIKA', autoBraking: 'HAMOWANIE AUTOMATYCZNE', speed: 'PRĘDKOŚĆ',
  jumpReady: 'SKOK GOTOWY', jumpCooldown: 'SKOK {seconds} s', hull: 'KADŁUB {percent}%',
  controlsAll: 'A/D · ← → — skręt | Spacja — skok | LPM — zmiana biegu',
  falseStart: 'FALSTART · SILNIK ZDŁAWIONY · KLIKNIJ LPM', greenStart: 'ZIELONE · KLIKNIJ LPM — START',
  getReady: 'PRZYGOTUJ SIĘ', destroyed: '💥 POJAZD ZNISZCZONY!', finish: '🏁 META!', yourTime: 'Twój czas',
  trackRecord: 'Rekord trasy', difference: 'Różnica', collisions: 'Kolizje', newRecord: '🏆 NOWY REKORD TRASY!',
  again: '🔄 Jeszcze raz', menu: '← Menu', gameSubtitle: 'Galaktyczne wyścigi · KOTOR Edition',
  geekfightsAccount: 'Konto GeekFights', nickname: 'Pseudonim', nicknamePlaceholder: 'Twój pseudonim…',
  chooseTrack: 'Wybierz trasę', online: 'ONLINE', local: 'LOKALNIE', noResults: 'Brak wyników. Ustaw pierwszy rekord!',
  race: '▶ STARTUJ', trackEditor: '⚙ EDYTOR TRASY', steer: '← A/D → — skręt', jumpControl: 'Spacja — skok', shiftControl: 'LPM — zmień bieg',
  leaderboardUnavailable: 'Ranking online jest chwilowo niedostępny.', scoreSaveFailed: 'Nie udało się zapisać wyniku online.',
  trackTaris: 'Łatwa · 2650 m', trackTatooine: 'Dużo przeszkód · 4200 m', trackManaan: 'Wąski tunel · 5100 m',
  trackKorriban: 'Szybka i niebezpieczna · 6000 m', trackTaris2: 'Test miejskiej trasy · 2650 m',
  editorTitle: 'EDYTOR TRASY', cursorPosition: 'Pozycja kursora', editorHelp: 'Kółko/W–S: trasa · A/D: lewo/prawo · Shift: 25 m · Page Up/Down: 100 m',
  objectType: 'Typ obiektu', crossPosition: 'Pozycja w poprzek: {value}', left: 'LEWA', center: 'ŚRODEK', right: 'PRAWA',
  addAt: '+ DODAJ NA {distance} m', nearby: 'Obiekty ±18 m od kursora', noNearby: 'Brak obiektów w pobliżu.', remove: 'USUŃ',
  editorStats: '{objects} obiektów · {boosts} akceleratorów', saving: 'ZAPISYWANIE…', saveTrack: 'ZAPISZ TRASĘ DO PLIKU',
  exportJson: 'EKSPORT JSON', importJson: 'IMPORT JSON', defaultLayout: 'DOMYŚLNY UKŁAD', backToMenu: 'WRÓĆ DO MENU',
  typeBoost: 'Akcelerator', typeBoulder: 'Głaz', typeGate: 'Brama', typeWall: 'Ściana', typeLowBarrier: 'Bariera do skoku', typeMine: 'Mina',
  addedDraft: 'Dodano obiekt do wersji roboczej.', removedDraft: 'Usunięto obiekt z wersji roboczej.', invalidLayout: 'Nie udało się zapisać układu: dane trasy są niepoprawne.',
  savingProject: 'Zapisywanie układu do pliku projektu…', savedProject: 'Zapisano {count} obiektów w {path}. Układ jest trwały i wejdzie do buildu.',
  fileSaveError: 'Błąd zapisu plikowego: {error}', unknownError: 'nieznany błąd', confirmReset: 'Przywrócić domyślny układ trasy {track}?',
  savingDefault: 'Zapisywanie domyślnego układu do pliku projektu…', restoredDefault: 'Przywrócono domyślny układ i zapisano go w {path}.',
  exportedJson: 'Wyeksportowano kopię JSON.', importedJson: 'Wczytano {count} obiektów. Kliknij ZAPISZ, aby zatwierdzić.', invalidJson: 'Plik nie zawiera poprawnego układu tej trasy.'
};

const es: TranslationTable = {
  startLights: 'Semáforo de salida', start: 'SALIDA', red: 'ROJO', warning: 'ATENCIÓN', signal: 'SEÑAL', vsRecord: 'VS RÉCORD',
  perfectShift: 'CAMBIO PERFECTO', goodShift: 'BUEN CAMBIO', tooEarly: 'DEMASIADO PRONTO', tooLate: 'DEMASIADO TARDE',
  vehicleBlocked: 'VEHÍCULO BLOQUEADO', avoidObstacle: 'USA A / D PARA ESQUIVAR EL OBSTÁCULO', gear: 'MARCHA',
  finishCoasting: 'META · REDUCIENDO VELOCIDAD', changeGear: 'Clic izq. · CAMBIAR MARCHA', prepareShift: 'PREPARA EL CAMBIO',
  maxGear: 'MARCHA MÁXIMA', engineSpeed: 'VELOCIDAD DEL MOTOR', autoBraking: 'FRENADO AUTOMÁTICO', speed: 'VELOCIDAD',
  jumpReady: 'SALTO LISTO', jumpCooldown: 'SALTO {seconds} s', hull: 'CASCO {percent}%',
  controlsAll: 'A/D · ← → — girar | Espacio — saltar | Clic izq. — cambiar marcha',
  falseStart: 'SALIDA FALSA · MOTOR CALADO · CLIC IZQ.', greenStart: 'VERDE · CLIC IZQ. — SALIDA',
  getReady: 'PREPÁRATE', destroyed: '💥 ¡VEHÍCULO DESTRUIDO!', finish: '🏁 ¡META!', yourTime: 'Tu tiempo',
  trackRecord: 'Récord de pista', difference: 'Diferencia', collisions: 'Colisiones', newRecord: '🏆 ¡NUEVO RÉCORD DE PISTA!',
  again: '🔄 Otra vez', menu: '← Menú', gameSubtitle: 'Carreras galácticas · Edición KOTOR',
  geekfightsAccount: 'Cuenta de GeekFights', nickname: 'Apodo', nicknamePlaceholder: 'Tu apodo…',
  chooseTrack: 'Elige una pista', online: 'EN LÍNEA', local: 'LOCAL', noResults: 'Aún no hay resultados. ¡Marca el primer récord!',
  race: '▶ CORRER', trackEditor: '⚙ EDITOR DE PISTA', steer: '← A/D → — girar', jumpControl: 'Espacio — saltar', shiftControl: 'Clic izq. — cambiar marcha',
  leaderboardUnavailable: 'La clasificación en línea no está disponible temporalmente.', scoreSaveFailed: 'No se pudo guardar el resultado en línea.',
  trackTaris: 'Fácil · 2650 m', trackTatooine: 'Muchos obstáculos · 4200 m', trackManaan: 'Túnel estrecho · 5100 m',
  trackKorriban: 'Rápida y peligrosa · 6000 m', trackTaris2: 'Prueba urbana · 2650 m',
  editorTitle: 'EDITOR DE PISTA', cursorPosition: 'Posición del cursor', editorHelp: 'Rueda/W–S: pista · A/D: izquierda/derecha · Mayús: 25 m · RePág/AvPág: 100 m',
  objectType: 'Tipo de objeto', crossPosition: 'Posición lateral: {value}', left: 'IZQUIERDA', center: 'CENTRO', right: 'DERECHA',
  addAt: '+ AÑADIR EN {distance} m', nearby: 'Objetos a ±18 m del cursor', noNearby: 'No hay objetos cerca.', remove: 'ELIMINAR',
  editorStats: '{objects} objetos · {boosts} aceleradores', saving: 'GUARDANDO…', saveTrack: 'GUARDAR PISTA EN ARCHIVO',
  exportJson: 'EXPORTAR JSON', importJson: 'IMPORTAR JSON', defaultLayout: 'DISEÑO PREDETERMINADO', backToMenu: 'VOLVER AL MENÚ',
  typeBoost: 'Acelerador', typeBoulder: 'Roca', typeGate: 'Puerta', typeWall: 'Muro', typeLowBarrier: 'Barrera de salto', typeMine: 'Mina',
  addedDraft: 'Objeto añadido al borrador.', removedDraft: 'Objeto eliminado del borrador.', invalidLayout: 'No se pudo guardar el diseño: los datos de la pista no son válidos.',
  savingProject: 'Guardando el diseño en el archivo del proyecto…', savedProject: 'Se guardaron {count} objetos en {path}. El diseño es permanente y se incluirá en la compilación.',
  fileSaveError: 'Error al guardar el archivo: {error}', unknownError: 'error desconocido', confirmReset: '¿Restaurar el diseño predeterminado de {track}?',
  savingDefault: 'Guardando el diseño predeterminado en el archivo del proyecto…', restoredDefault: 'Se restauró el diseño predeterminado y se guardó en {path}.',
  exportedJson: 'Se exportó una copia JSON.', importedJson: 'Se cargaron {count} objetos. Pulsa GUARDAR para confirmar.', invalidJson: 'El archivo no contiene un diseño válido para esta pista.'
};

const translations: Record<GameLanguage, TranslationTable> = { en, pl, es };

export function normalizeGameLanguage(value: unknown): GameLanguage {
  const code = String(value || '').toLowerCase().split('-')[0];
  return code === 'pl' || code === 'es' ? code : 'en';
}

export function getInitialGameLanguage(): GameLanguage {
  if (typeof window === 'undefined') return 'en';
  const queryLanguage = new URLSearchParams(window.location.search).get('lang');
  if (queryLanguage) return normalizeGameLanguage(queryLanguage);
  try {
    return normalizeGameLanguage(localStorage.getItem('geekfights-language'));
  } catch {
    return 'en';
  }
}

export function swoopText(language: GameLanguage, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    translations[language]?.[key] ?? en[key],
  );
}

export function trackSubtitle(language: GameLanguage, trackId: string): string {
  const key = `track${trackId.charAt(0).toUpperCase()}${trackId.slice(1)}` as TranslationKey;
  return translations[language]?.[key] ?? en[key] ?? '';
}

export type SwoopTranslationKey = TranslationKey;
