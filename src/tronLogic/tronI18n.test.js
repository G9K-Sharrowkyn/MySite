import { tronMonthLabel, tronPhaseLabel, tronRoomError, tronText } from './tronI18n';

describe('TRON translations', () => {
  test.each([
    ['en', 'ACTIVE GAMES'],
    ['pl', 'AKTYWNE GRY'],
    ['es', 'PARTIDAS ACTIVAS']
  ])('renders the lobby in %s', (language, expected) => {
    expect(tronText(language, 'activeGames')).toBe(expected);
  });

  test('localizes dynamic phases, dates and server error codes', () => {
    expect(tronPhaseLabel('es', 'running')).toBe('RONDA EN CURSO');
    expect(tronMonthLabel('en', '2026-08')).toBe('August 2026');
    expect(tronRoomError('pl', { code: 'BAD_PASSWORD' })).toBe('Nieprawidłowe hasło do pokoju.');
  });
});
