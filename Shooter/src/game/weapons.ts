export type WeaponId = 'pistol' | 'rifle' | 'shotgun'

export type WeaponDefinition = {
  id: WeaponId
  slot: 1 | 2 | 3
  name: string
  shortName: string
  magazineSize: number
  startingReserve: number
  damage: number
  headDamage: number
  fireDelay: number
  reloadTime: number
  pellets: number
  spread: number
  aimedSpreadMultiplier: number
  muzzleVelocity: number
  maxRange: number
  tracerLength: number
  tracerWidth: number
  tracerColor: string
  automatic: boolean
}

export const weaponDefinitions: Record<WeaponId, WeaponDefinition> = {
  pistol: {
    id: 'pistol',
    slot: 1,
    name: 'Pistolet P12',
    shortName: 'P12',
    magazineSize: 12,
    startingReserve: 48,
    damage: 45,
    headDamage: 100,
    fireDelay: 235,
    reloadTime: 1050,
    pellets: 1,
    spread: 0.0001,
    aimedSpreadMultiplier: 0.25,
    muzzleVelocity: 360,
    maxRange: 120,
    tracerLength: 4,
    tracerWidth: 0.012,
    tracerColor: '#ffd77a',
    automatic: false,
  },
  rifle: {
    id: 'rifle',
    slot: 2,
    name: 'Karabin MK.II',
    shortName: 'MK.II',
    magazineSize: 30,
    startingReserve: 90,
    damage: 34,
    headDamage: 90,
    fireDelay: 70,
    reloadTime: 1350,
    pellets: 1,
    spread: 0.0001,
    aimedSpreadMultiplier: 0.22,
    muzzleVelocity: 715,
    maxRange: 300,
    tracerLength: 7,
    tracerWidth: 0.014,
    tracerColor: '#fff0a6',
    automatic: true,
  },
  shotgun: {
    id: 'shotgun',
    slot: 3,
    name: 'Strzelba SG-8',
    shortName: 'SG-8',
    magazineSize: 8,
    startingReserve: 32,
    damage: 18,
    headDamage: 28,
    fireDelay: 760,
    reloadTime: 1550,
    pellets: 8,
    spread: 0.037,
    aimedSpreadMultiplier: 0.48,
    muzzleVelocity: 400,
    maxRange: 80,
    tracerLength: 2.2,
    tracerWidth: 0.008,
    tracerColor: '#ffbc69',
    automatic: false,
  },
}

export const weaponOrder: WeaponId[] = ['pistol', 'rifle', 'shotgun']

export function getWeaponSpread(weapon: WeaponDefinition, aiming: boolean) {
  return weapon.spread * (aiming ? weapon.aimedSpreadMultiplier : 1)
}

export function makeStartingMagazines(): Record<WeaponId, number> {
  return Object.fromEntries(
    weaponOrder.map((id) => [id, weaponDefinitions[id].magazineSize]),
  ) as Record<WeaponId, number>
}

export function makeStartingReserves(): Record<WeaponId, number> {
  return Object.fromEntries(
    weaponOrder.map((id) => [id, weaponDefinitions[id].startingReserve]),
  ) as Record<WeaponId, number>
}
