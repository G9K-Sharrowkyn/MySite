import assert from 'node:assert/strict'
import test from 'node:test'
import { getWeaponSpread, makeStartingMagazines, weaponDefinitions, weaponOrder } from './weapons.ts'

test('każda broń ma osobny, pełny magazynek startowy', () => {
  const magazines = makeStartingMagazines()
  for (const id of weaponOrder) {
    assert.equal(magazines[id], weaponDefinitions[id].magazineSize)
  }
})

test('tylko karabin prowadzi ogień automatyczny', () => {
  assert.equal(weaponDefinitions.pistol.automatic, false)
  assert.equal(weaponDefinitions.rifle.automatic, true)
  assert.equal(weaponDefinitions.shotgun.automatic, false)
})

test('karabin może opróżnić magazynek w około dwie sekundy ciągłego ognia', () => {
  const rifle = weaponDefinitions.rifle
  const burstDuration = (rifle.magazineSize - 1) * rifle.fireDelay
  assert.ok(burstDuration >= 1800)
  assert.ok(burstDuration <= 2200)
})

test('strzelba ma wiele śrutów i największy rozrzut', () => {
  assert.ok(weaponDefinitions.shotgun.pellets > 1)
  assert.ok(weaponDefinitions.shotgun.spread > weaponDefinitions.rifle.spread)
})

test('celowanie zmniejsza rozrzut każdej broni', () => {
  for (const id of weaponOrder) {
    const weapon = weaponDefinitions[id]
    assert.ok(getWeaponSpread(weapon, true) < getWeaponSpread(weapon, false))
  }
})

test('prędkości pocisków odpowiadają klasom broni', () => {
  assert.ok(weaponDefinitions.pistol.muzzleVelocity >= 300)
  assert.ok(weaponDefinitions.pistol.muzzleVelocity <= 450)
  assert.ok(weaponDefinitions.rifle.muzzleVelocity >= 600)
  assert.ok(weaponDefinitions.rifle.muzzleVelocity <= 1000)
  assert.ok(weaponDefinitions.shotgun.muzzleVelocity >= 300)
  assert.ok(weaponDefinitions.shotgun.muzzleVelocity <= 500)
  assert.ok(weaponDefinitions.rifle.muzzleVelocity > weaponDefinitions.pistol.muzzleVelocity)
})
