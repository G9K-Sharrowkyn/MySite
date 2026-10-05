import assert from 'node:assert/strict'
import test from 'node:test'
import { Vector3 } from 'three'
import { ballisticDrop, segmentSphereHitDistance } from './projectiles.ts'

test('opad pocisku rośnie z odległością', () => {
  assert.ok(ballisticDrop(80, 360) > ballisticDrop(40, 360))
})

test('szybszy pocisk ma mniejszy opad na tym samym dystansie', () => {
  assert.ok(ballisticDrop(60, 715) < ballisticDrop(60, 360))
})

test('wykrywa przelot pocisku przez gracza', () => {
  const distance = segmentSphereHitDistance(
    new Vector3(0, 1.7, -2),
    new Vector3(0, 1.7, 2),
    new Vector3(0, 1.7, 0),
    0.38,
  )

  assert.ok(distance !== null)
  assert.ok(distance > 1.5 && distance < 2)
})

test('nie zalicza pocisku lecacego obok gracza', () => {
  const distance = segmentSphereHitDistance(
    new Vector3(1, 1.7, -2),
    new Vector3(1, 1.7, 2),
    new Vector3(0, 1.7, 0),
    0.38,
  )

  assert.equal(distance, null)
})
