import { clampPlayerColor } from '../realtime/tronArena.js';

describe('TRON arena player colors', () => {
  test.each([
    '#00e5ff',
    '#ff7a00',
    '#ffd84a',
    '#ff3b4d',
    '#58f56b'
  ])('accepts the supported trail color %s', (color) => {
    expect(clampPlayerColor(color.toUpperCase())).toBe(color);
  });

  test.each(['', '#ffffff', '#c77dff', 'not-a-color', null])(
    'rejects unsupported trail color %s',
    (color) => {
      expect(clampPlayerColor(color)).toBeNull();
    }
  );
});
