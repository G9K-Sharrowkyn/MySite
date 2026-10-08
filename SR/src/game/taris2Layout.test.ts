import assert from 'node:assert/strict';
import test from 'node:test';
import { getTaris2PlazaPlan, getTaris2SectionCount, TARIS2_SECTION_LENGTH, TARIS2_VIEW_DISTANCE } from './taris2Layout.ts';

test('Taris 2.0 geometry continues beyond the finish and camera view', () => {
  const raceLength = 2650;
  const sections = getTaris2SectionCount(raceLength);
  const farEdge = (sections - 1) * TARIS2_SECTION_LENGTH + TARIS2_SECTION_LENGTH / 2;
  assert.ok(farEdge > raceLength + TARIS2_VIEW_DISTANCE);
});

test('city plazas vary in depth but never touch the race corridor', () => {
  const depths = new Set<number>();
  const styles = new Set<number>();
  for (let section = 0; section < 90; section++) for (let side = 0; side < 2; side++) {
    const plaza = getTaris2PlazaPlan(section, side);
    if (!plaza) continue;
    // Transit decks are the widest of the three plaza models (1.2 units).
    assert.ok(plaza.xDistance - plaza.scaleX * .6 > 4.5);
    assert.ok(Math.abs(plaza.z) + plaza.scaleZ * .55 < TARIS2_SECTION_LENGTH / 2);
    depths.add(plaza.xDistance);
    styles.add(plaza.style);
  }
  assert.equal(depths.size, 4);
  assert.equal(styles.size, 3);
});
