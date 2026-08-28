import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_WIDTH } from './raceRules.ts';
import {
  buildOpenWorldScenery,
  getMountainHalfWidth,
  MOUNTAIN_BASE_HALF_WIDTHS,
  ROAD_SCENERY_CLEARANCE,
} from './sceneryDesign.ts';

const TRACKS = [
  ['tatooine', 4200],
  ['korriban', 6000],
] as const;

test('open-world mountains use six models asymmetrically without consecutive repeats', () => {
  for (const [trackId, trackLength] of TRACKS) {
    const scenery = buildOpenWorldScenery(trackId, trackLength);
    assert.equal(scenery.mountains.length, 36);
    assert.equal(scenery.mountains.filter(({ side }) => side === -1).length, 18);
    assert.equal(scenery.mountains.filter(({ side }) => side === 1).length, 18);
    assert.equal(new Set(scenery.mountains.map(({ distance }) => distance)).size, 36);

    scenery.mountains.forEach((mountain, index) => {
      if (trackId === 'tatooine') {
        assert.ok(mountain.distance > scenery.desertStart);
        assert.ok(mountain.distance < scenery.desertEnd);
      }
      if (index > 0) {
        assert.ok(mountain.distance > scenery.mountains[index - 1].distance);
        assert.notEqual(mountain.variant, scenery.mountains[index - 1].variant);
      }
    });

    for (const side of [-1, 1] as const) {
      for (const variant of MOUNTAIN_BASE_HALF_WIDTHS.keys()) {
        const instances = scenery.mountains.filter(
          (mountain) => mountain.side === side && mountain.variant === variant,
        );
        assert.equal(instances.length, 3);
        assert.deepEqual(
          instances
            .map(({ rotation }) => Math.round(rotation / (Math.PI * 2 / 3)) || 0)
            .sort((a, b) => a - b),
          [0, 1, 2],
        );
      }
    }
  }
});

test('every mountain stays clear of the road using its rendered model width', () => {
  for (const [trackId, trackLength] of TRACKS) {
    const { mountains } = buildOpenWorldScenery(trackId, trackLength);
    mountains.forEach((mountain) => {
      const innerEdge = mountain.lateralDistance
        - getMountainHalfWidth(trackId, mountain.variant, mountain.scale);
      assert.ok(
        innerEdge >= TRACK_WIDTH / 2 + ROAD_SCENERY_CLEARANCE,
        `${trackId} mountain ${mountain.variant} reaches x=${innerEdge.toFixed(2)}`,
      );
    });
  }
});

test('Tatooine mountains densely populate the middle desert at three depths', () => {
  const scenery = buildOpenWorldScenery('tatooine', 4200);
  const { mountains } = scenery;
  assert.ok(mountains[0].distance - scenery.desertStart < 100);
  assert.ok(scenery.desertEnd - mountains.at(-1)!.distance < 100);
  assert.ok(mountains.some(({ scale }) => scale >= 1.8));
  assert.ok(mountains.some(({ lateralDistance }) => lateralDistance < 20));
  assert.ok(mountains.filter(({ lateralDistance }) => lateralDistance >= 25 && lateralDistance < 48).length >= 10);
  assert.ok(mountains.filter(({ lateralDistance }) => lateralDistance >= 48).length >= 10);
  assert.ok(Math.max(...mountains.map(({ lateralDistance }) => lateralDistance)) >= 76);
  assert.ok(new Set(mountains.map(({ lateralDistance }) => Math.round(lateralDistance))).size >= 24);

  const gaps = mountains.slice(1).map((mountain, index) => mountain.distance - mountains[index].distance);
  assert.ok(Math.max(...gaps) < 55);
});

test('Tatooine has continuous close canyon walls in the first and final thirds', () => {
  const trackLength = 4200;
  const scenery = buildOpenWorldScenery('tatooine', trackLength);
  assert.deepEqual(scenery.canyonSections, [
    { start: 0, end: 1400 },
    { start: 2800, end: 4200 },
  ]);

  for (const section of scenery.canyonSections) {
    for (const side of [-1, 1] as const) {
      const chunks = scenery.cliffs
        .filter((chunk) => chunk.role === 'canyon'
          && chunk.side === side
          && chunk.distance >= section.start - scenery.cliffChunkLength
          && chunk.distance <= section.end + scenery.cliffChunkLength)
        .sort((a, b) => a.distance - b.distance);
      assert.ok(chunks.length >= 20);
      assert.ok(chunks[0].distance - scenery.cliffChunkLength / 2 <= section.start);
      assert.ok(chunks.at(-1)!.distance + scenery.cliffChunkLength / 2 >= section.end);

      chunks.slice(1).forEach((chunk, index) => {
        assert.ok(chunk.distance - chunks[index].distance < scenery.cliffChunkLength);
      });
      chunks.forEach((chunk) => {
        assert.ok(chunk.lateralDistance - chunk.width / 2 >= TRACK_WIDTH / 2 + 3);
      });
    }
  }
});

test('the open Tatooine desert keeps continuous distant canyon walls on both horizons', () => {
  const scenery = buildOpenWorldScenery('tatooine', 4200);
  const backdrop = scenery.cliffs.filter(({ role }) => role === 'backdrop');
  const left = backdrop.filter(({ side }) => side === -1).sort((a, b) => a.distance - b.distance);
  const right = backdrop.filter(({ side }) => side === 1).sort((a, b) => a.distance - b.distance);
  assert.equal(left.length, right.length);
  assert.ok(left.length >= 18);

  for (const chunks of [left, right]) {
    assert.ok(chunks[0].distance < scenery.desertStart);
    assert.ok(chunks.at(-1)!.distance > scenery.desertEnd);
    chunks.slice(1).forEach((chunk, index) => {
      assert.ok(chunk.distance - chunks[index].distance < scenery.cliffChunkLength);
    });
    chunks.forEach((chunk) => {
      assert.ok(chunk.lateralDistance - chunk.width / 2 > 45);
      assert.ok(chunk.height >= 18);
    });
  }
});

test('open routes include continuous hundred-metre rock walls and safe desert dune fields', () => {
  for (const [trackId, trackLength] of TRACKS) {
    const scenery = buildOpenWorldScenery(trackId, trackLength);
    assert.equal(scenery.rockWalls.length, 2);
    scenery.rockWalls.forEach((wall) => assert.ok(wall.length >= 100));

    if (trackId === 'tatooine') {
      assert.equal(scenery.duneFields.length, 4);
      assert.equal(scenery.duneFields.filter(({ side }) => side === -1).length, 2);
      assert.equal(scenery.duneFields.filter(({ side }) => side === 1).length, 2);
      scenery.duneFields.forEach((field) => {
        assert.ok(field.distance > scenery.desertStart && field.distance < scenery.desertEnd);
        assert.ok(field.lateralDistance - field.width / 2 >= TRACK_WIDTH / 2 + 3);
      });
    } else {
      assert.equal(scenery.duneFields.length, 0);
    }
  }
});
