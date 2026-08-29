const en = {
  arenaAria: 'TRON arena', intro: 'Leave light walls, trap your opponents and use wall-riding to take control of the arena.',
  arenaReady: 'ARENA READY', connecting: 'CONNECTING TO ARENA…', reconnecting: 'RECONNECTING…', trailColor: 'TRAIL COLOR',
  colorBlue: 'Blue', colorOrange: 'Orange', colorYellow: 'Yellow', colorRed: 'Red', colorGreen: 'Green',
  trainingMode: 'TRAINING MODE', joining: 'JOINING…', playSolo: 'PLAY SOLO', soloHint: 'Instant one-player round',
  multiplayer: 'MULTIPLAYER', activeGames: 'ACTIVE GAMES', refresh: 'REFRESH', private: 'PRIVATE', public: 'PUBLIC',
  password: 'Password', roomPasswordAria: 'Password for room {room}', full: 'FULL', join: 'JOIN', noRooms: 'No active rooms. Create the first game.',
  createRoom: 'CREATE ROOM', gameName: 'Game name', gameNamePlaceholder: 'E.g. Flynn Arena', creating: 'CREATING…', createAndJoin: 'CREATE AND JOIN',
  winsRanking: 'WINS RANKING', rankingMonth: 'Leaderboard month', loadingRanking: 'Loading leaderboard…', win: 'WIN', wins: 'WINS',
  noWins: 'Nobody has won this month yet.', winsAccount: 'Wins are automatically assigned to your account.', winsLogin: 'Log in to add your wins to the monthly ranking.',
  controls: 'CONTROLS: A / ← · D / →', round: 'ROUND', activePrograms: 'active programs', sector: 'SECTOR', exit: 'EXIT',
  roundWinner: 'ROUND WINNER', programDeleted: 'PROGRAM DELETED', spectating: 'You are watching the remaining players', speed: 'SPEED',
  wallRideBoost: 'WALL-RIDE BOOST', wallRide: 'WALL-RIDE {side} · +SPEED', hugWall: 'HUG A WALL TO ACCELERATE', turnLeft: 'Turn left', turnRight: 'Turn right',
  phaseWaiting: 'WAITING', phaseCountdown: 'STARTING SOON', phaseRunning: 'ROUND IN PROGRESS', phaseFinished: 'ROUND OVER',
  sideLeft: 'LEFT', sideRight: 'RIGHT',
  backendTimeout: 'The game server did not respond. Check whether the backend is running on port 5000.', connectionFailed: 'Could not connect to the arena.',
  roomError: 'TRON room error.', arenaNotConnected: 'The arena is not connected to the server yet.', leaderboardFailed: 'Could not load the leaderboard.',
  errorROOM_FULL: 'The room is full (maximum 8 players).', errorROOM_NAME: 'The room name must contain at least 3 characters.',
  errorROOM_PASSWORD: 'A private room password must contain at least 4 characters.', errorROOM_CREATE: 'Could not create the room.',
  errorROOM_NOT_FOUND: 'This room no longer exists.', errorBAD_PASSWORD: 'Incorrect room password.', errorROOM_JOIN: 'Could not join the room.'
};

const pl = {
  arenaAria: 'Arena TRON', intro: 'Zostawiaj ściany światła, zamykaj przeciwników i wykorzystuj ślizg, aby przejąć kontrolę nad areną.',
  arenaReady: 'ARENA GOTOWA', connecting: 'ŁĄCZENIE Z ARENĄ…', reconnecting: 'PONOWNE ŁĄCZENIE…', trailColor: 'KOLOR SMUGI',
  colorBlue: 'Niebieski', colorOrange: 'Pomarańczowy', colorYellow: 'Żółty', colorRed: 'Czerwony', colorGreen: 'Zielony',
  trainingMode: 'TRYB TRENINGOWY', joining: 'DOŁĄCZANIE…', playSolo: 'GRAJ SOLO', soloHint: 'Natychmiastowa runda dla jednego gracza',
  multiplayer: 'MULTIPLAYER', activeGames: 'AKTYWNE GRY', refresh: 'ODŚWIEŻ', private: 'PRYWATNY', public: 'PUBLICZNY',
  password: 'Hasło', roomPasswordAria: 'Hasło do pokoju {room}', full: 'PEŁNY', join: 'DOŁĄCZ', noRooms: 'Brak aktywnych pokoi. Utwórz pierwszą rozgrywkę.',
  createRoom: 'UTWÓRZ POKÓJ', gameName: 'Nazwa gry', gameNamePlaceholder: 'Np. Arena Flynna', creating: 'TWORZENIE…', createAndJoin: 'UTWÓRZ I WEJDŹ',
  winsRanking: 'RANKING ZWYCIĘSTW', rankingMonth: 'Miesiąc rankingu', loadingRanking: 'Ładowanie rankingu…', win: 'WYGRANA', wins: 'WYGRANYCH',
  noWins: 'W tym miesiącu nikt jeszcze nie wygrał.', winsAccount: 'Zwycięstwa są automatycznie przypisywane do Twojego konta.', winsLogin: 'Zaloguj się, aby zwycięstwa trafiały do miesięcznego rankingu.',
  controls: 'STEROWANIE: A / ← · D / →', round: 'RUNDA', activePrograms: 'aktywnych programów', sector: 'SEKTOR', exit: 'WYJDŹ',
  roundWinner: 'ZWYCIĘZCA RUNDY', programDeleted: 'PROGRAM ZDELETOWANY', spectating: 'Obserwujesz pozostałych', speed: 'PRĘDKOŚĆ',
  wallRideBoost: 'WALL-RIDE BOOST', wallRide: 'ŚLIZG {side} · +PRĘDKOŚĆ', hugWall: 'PRZYTUL ŚCIANĘ, ABY PRZYSPIESZYĆ', turnLeft: 'Skręć w lewo', turnRight: 'Skręć w prawo',
  phaseWaiting: 'OCZEKIWANIE', phaseCountdown: 'START ZA CHWILĘ', phaseRunning: 'RUNDA TRWA', phaseFinished: 'KONIEC RUNDY',
  sideLeft: 'LEWO', sideRight: 'PRAWO',
  backendTimeout: 'Serwer gry nie odpowiedział. Sprawdź, czy backend działa na porcie 5000.', connectionFailed: 'Nie udało się połączyć z areną.',
  roomError: 'Błąd pokoju TRON.', arenaNotConnected: 'Arena jeszcze nie jest połączona z serwerem.', leaderboardFailed: 'Nie udało się pobrać rankingu.',
  errorROOM_FULL: 'Pokój jest pełny (maksymalnie 8 graczy).', errorROOM_NAME: 'Nazwa pokoju musi mieć co najmniej 3 znaki.',
  errorROOM_PASSWORD: 'Hasło prywatnego pokoju musi mieć co najmniej 4 znaki.', errorROOM_CREATE: 'Nie udało się utworzyć pokoju.',
  errorROOM_NOT_FOUND: 'Ten pokój już nie istnieje.', errorBAD_PASSWORD: 'Nieprawidłowe hasło do pokoju.', errorROOM_JOIN: 'Nie udało się dołączyć do pokoju.'
};

const es = {
  arenaAria: 'Arena TRON', intro: 'Deja muros de luz, encierra a tus rivales y usa el deslizamiento para controlar la arena.',
  arenaReady: 'ARENA LISTA', connecting: 'CONECTANDO CON LA ARENA…', reconnecting: 'RECONECTANDO…', trailColor: 'COLOR DE LA ESTELA',
  colorBlue: 'Azul', colorOrange: 'Naranja', colorYellow: 'Amarillo', colorRed: 'Rojo', colorGreen: 'Verde',
  trainingMode: 'MODO ENTRENAMIENTO', joining: 'ENTRANDO…', playSolo: 'JUGAR SOLO', soloHint: 'Ronda inmediata para un jugador',
  multiplayer: 'MULTIJUGADOR', activeGames: 'PARTIDAS ACTIVAS', refresh: 'ACTUALIZAR', private: 'PRIVADA', public: 'PÚBLICA',
  password: 'Contraseña', roomPasswordAria: 'Contraseña de la sala {room}', full: 'LLENA', join: 'ENTRAR', noRooms: 'No hay salas activas. Crea la primera partida.',
  createRoom: 'CREAR SALA', gameName: 'Nombre de la partida', gameNamePlaceholder: 'P. ej., Arena de Flynn', creating: 'CREANDO…', createAndJoin: 'CREAR Y ENTRAR',
  winsRanking: 'CLASIFICACIÓN DE VICTORIAS', rankingMonth: 'Mes de la clasificación', loadingRanking: 'Cargando clasificación…', win: 'VICTORIA', wins: 'VICTORIAS',
  noWins: 'Nadie ha ganado todavía este mes.', winsAccount: 'Las victorias se asignan automáticamente a tu cuenta.', winsLogin: 'Inicia sesión para añadir tus victorias a la clasificación mensual.',
  controls: 'CONTROLES: A / ← · D / →', round: 'RONDA', activePrograms: 'programas activos', sector: 'SECTOR', exit: 'SALIR',
  roundWinner: 'GANADOR DE LA RONDA', programDeleted: 'PROGRAMA ELIMINADO', spectating: 'Estás observando a los jugadores restantes', speed: 'VELOCIDAD',
  wallRideBoost: 'IMPULSO DE MURO', wallRide: 'DESLIZAMIENTO {side} · +VELOCIDAD', hugWall: 'PÉGATE A UN MURO PARA ACELERAR', turnLeft: 'Girar a la izquierda', turnRight: 'Girar a la derecha',
  phaseWaiting: 'ESPERANDO', phaseCountdown: 'SALIDA INMINENTE', phaseRunning: 'RONDA EN CURSO', phaseFinished: 'FIN DE LA RONDA',
  sideLeft: 'IZQUIERDA', sideRight: 'DERECHA',
  backendTimeout: 'El servidor del juego no respondió. Comprueba si el backend funciona en el puerto 5000.', connectionFailed: 'No se pudo conectar con la arena.',
  roomError: 'Error de la sala TRON.', arenaNotConnected: 'La arena aún no está conectada al servidor.', leaderboardFailed: 'No se pudo cargar la clasificación.',
  errorROOM_FULL: 'La sala está llena (máximo 8 jugadores).', errorROOM_NAME: 'El nombre de la sala debe tener al menos 3 caracteres.',
  errorROOM_PASSWORD: 'La contraseña de una sala privada debe tener al menos 4 caracteres.', errorROOM_CREATE: 'No se pudo crear la sala.',
  errorROOM_NOT_FOUND: 'Esta sala ya no existe.', errorBAD_PASSWORD: 'Contraseña de sala incorrecta.', errorROOM_JOIN: 'No se pudo entrar en la sala.'
};

const tables = { en, pl, es };
const locales = { en: 'en-US', pl: 'pl-PL', es: 'es-ES' };

export const normalizeTronLanguage = (value) => {
  const code = String(value || '').toLowerCase().split('-')[0];
  return code === 'pl' || code === 'es' ? code : 'en';
};

export const tronText = (language, key, values = {}) => {
  const normalized = normalizeTronLanguage(language);
  const template = tables[normalized][key] ?? tables.en[key] ?? key;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
};

export const tronPhaseLabel = (language, phase) => {
  const rawPhase = String(phase || '');
  const key = `phase${rawPhase.charAt(0).toUpperCase()}${rawPhase.slice(1)}`;
  const translated = tronText(language, key);
  return translated === key ? rawPhase.toUpperCase() : translated;
};

export const tronMonthLabel = (language, monthKey) => {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return monthKey;
  const normalized = normalizeTronLanguage(language);
  return new Intl.DateTimeFormat(locales[normalized], { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
};

export const tronRoomError = (language, payload) => {
  const code = String(payload?.code || '');
  if (!code) return tronText(language, 'roomError');
  const key = `error${code}`;
  const translated = tronText(language, key);
  return translated === key ? tronText(language, 'roomError') : translated;
};
