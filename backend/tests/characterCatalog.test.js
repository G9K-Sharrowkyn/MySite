import {
  mergeCharacterCatalog,
  normalizeCharacterKey
} from '../services/characterCatalog.js';

const builtIns = [
  {
    id: 'batman-dc',
    name: 'Batman (DC)',
    baseName: 'Batman',
    universe: 'DC',
    image: '/characters/Batman.jpg',
    tags: ['DC']
  },
  {
    id: 'darkseid-dc',
    name: 'Darkseid (DC)',
    baseName: 'Darkseid',
    universe: 'DC',
    image: '/characters/Darkseid.jpg',
    tags: ['DC']
  }
];

describe('merged character catalog', () => {
  test('keeps the shipped catalog when MongoDB contains only one custom character', () => {
    const result = mergeCharacterCatalog(builtIns, [
      {
        id: 'delta-four',
        name: 'Delta Four',
        universe: 'Custom',
        image: '/api/media/characters/delta-four'
      }
    ]);

    expect(result.map((character) => character.name)).toEqual([
      'Batman (DC)',
      'Darkseid (DC)',
      'Delta Four'
    ]);
  });

  test('uses the stored record as an override of a built-in character', () => {
    const result = mergeCharacterCatalog(builtIns, [
      {
        id: 'batman-dc',
        name: 'Batman (DC)',
        universe: 'DC',
        image: '/api/media/characters/batman-dc',
        tags: ['Detective']
      }
    ]);

    expect(result).toHaveLength(2);
    expect(result.find((character) => character.id === 'batman-dc')).toMatchObject({
      image: '/api/media/characters/batman-dc',
      tags: ['Detective']
    });
  });

  test('honors a deleted tombstone for a built-in character', () => {
    const result = mergeCharacterCatalog(builtIns, [
      {
        id: 'darkseid-dc',
        name: 'Darkseid (DC)',
        status: 'deleted'
      }
    ]);

    expect(result.map((character) => character.id)).toEqual(['batman-dc']);
  });

  test('matches equivalent names without case or diacritics', () => {
    expect(normalizeCharacterKey('  Átomo  ')).toBe('atomo');
  });
});
