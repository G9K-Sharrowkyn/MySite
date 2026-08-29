import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGameLanguage, swoopText, trackSubtitle } from '../i18n.ts';

test('Swoop menu translations cover every site language', () => {
  assert.equal(swoopText('en', 'chooseTrack'), 'Choose a track');
  assert.equal(swoopText('pl', 'chooseTrack'), 'Wybierz trasę');
  assert.equal(swoopText('es', 'chooseTrack'), 'Elige una pista');
  assert.equal(trackSubtitle('es', 'tatooine'), 'Muchos obstáculos · 4200 m');
});

test('host language variants normalize to the supported language set', () => {
  assert.equal(normalizeGameLanguage('es-ES'), 'es');
  assert.equal(normalizeGameLanguage('pl-PL'), 'pl');
  assert.equal(normalizeGameLanguage('fr'), 'en');
});
