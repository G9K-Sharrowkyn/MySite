import { buildCollectionDiff } from '../services/mongoDb.js';

describe('Mongo collection diff', () => {
  test('writes only changed documents and explicit removals', () => {
    const before = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 }
    ];
    const after = [
      { id: 'a', value: 1 },
      { id: 'b', value: 20 },
      { id: 'd', value: 4 }
    ];

    const diff = buildCollectionDiff(before, after);

    expect(diff.upserts).toEqual([
      { id: 'b', value: 20 },
      { id: 'd', value: 4 }
    ]);
    expect(diff.removedIds).toEqual(['c']);
    expect(diff.documents).toEqual(after);
  });

  test('rejects duplicate logical IDs before a write', () => {
    expect(() =>
      buildCollectionDiff([], [
        { id: 'same', value: 1 },
        { id: 'same', value: 2 }
      ])
    ).toThrow(/Duplicate document id/);
  });
});
