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
  const heightsByDepth = new Map<number, Set<number>>();
  let plazaCount = 0;
  let nearCount = 0;
  for (let section = 0; section < 90; section++) for (let side = 0; side < 2; side++) {
    const plaza = getTaris2PlazaPlan(section, side);
    if (!plaza) continue;
    // Transit decks are the widest of the three plaza models (1.2 units).
    assert.ok(plaza.xDistance - plaza.scaleX * .6 > 4.5);
    assert.ok(Math.abs(plaza.z) + plaza.scaleZ * .55 < TARIS2_SECTION_LENGTH / 2);
    depths.add(plaza.xDistance);
    styles.add(plaza.style);
    plazaCount++;
    if (plaza.xDistance < 25) nearCount++;
    const heights = heightsByDepth.get(plaza.xDistance) ?? new Set<number>();
    heights.add(plaza.height);
    heightsByDepth.set(plaza.xDistance, heights);
  }
  assert.equal(depths.size, 4);
  assert.equal(styles.size, 3);
  assert.ok(nearCount / plazaCount < .1);
  for (const heights of heightsByDepth.values()) assert.ok(heights.size >= 4);
  const allHeights = [...heightsByDepth.values()].flatMap(heights => [...heights]);
  assert.ok(allHeights.some(height => height < 0));
  assert.ok(allHeights.some(height => height > 15));
});
