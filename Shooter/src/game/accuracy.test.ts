import assert from 'node:assert/strict'
import test from 'node:test'
import {
  accuracySpreadPercent,
  movementPenalty,
  resolveMovementMode,
  seriesPenalty,
} from './accuracy.ts'

test('tryby ruchu mają ustalone kary celności', () => {
  assert.equal(movementPenalty.walking, 5)
  assert.equal(movementPenalty.running, 30)
  assert.equal(movementPenalty.sprinting, 60)
  assert.equal(resolveMovementMode({ moving: false, walking: false, sprinting: true }), 'standing')
  assert.equal(resolveMovementMode({ moving: true, walking: true, sprinting: false }), 'walking')
})

test('pierwszy strzał rozpoznanej serii także otrzymuje karę', () => {
  assert.equal(seriesPenalty(1, false), 0)
  assert.ok(seriesPenalty(1, true) > 0)
  assert.ok(seriesPenalty(5, true) > seriesPenalty(2, true))
})

test('spokojny pojedynczy strzał ADS mieści się w jednym procencie krzyżyka', () => {
  assert.equal(accuracySpreadPercent({
    aiming: true,
    movement: 'standing',
    shotInSeries: 1,
    isSeries: false,
    mousePenalty: 0,
  }), 1)
})

test('biodro, sprint, seria i ruch myszy sumują kary do maksymalnie stu procent', () => {
  assert.equal(accuracySpreadPercent({
    aiming: false,
    movement: 'sprinting',
    shotInSeries: 12,
    isSeries: true,
    mousePenalty: 50,
  }), 100)
})
