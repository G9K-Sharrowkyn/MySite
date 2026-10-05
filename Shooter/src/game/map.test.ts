import assert from 'node:assert/strict'
import test from 'node:test'
import { collidesWithArena, findArenaMove, hasClearPath } from './map.ts'

test('blokuje wyjście poza arenę', () => {
  assert.equal(collidesWithArena(24, 0), true)
  assert.equal(collidesWithArena(0, 23.5), true)
})

test('pozwala poruszać się po otwartej części mapy', () => {
  assert.equal(collidesWithArena(0, 18), false)
  assert.equal(collidesWithArena(14, 14), false)
})

test('wykrywa osłonę pomiędzy botem i graczem', () => {
  assert.equal(hasClearPath({ x: -10, z: -15 }, { x: -10, z: 10 }), false)
  assert.equal(hasClearPath({ x: 14, z: 14 }, { x: 20, z: 14 }), true)
})

test('bot obchodzi przeszkode zamiast biec w miejscu', () => {
  const move = findArenaMove(
    { x: -3.5, z: 3.1 },
    { x: 0, z: -1 },
    0.3,
    0.48,
    1,
  )

  assert.equal(move.moved, true)
  assert.equal(collidesWithArena(move.x, move.z, 0.48), false)
  assert.notDeepEqual([move.x, move.z], [-3.5, 3.1])
})
