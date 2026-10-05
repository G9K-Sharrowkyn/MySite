import { create } from 'zustand'
import { botSpawns } from '../game/map'
import {
  makeStartingMagazines,
  makeStartingReserves,
  type WeaponId,
  weaponDefinitions,
} from '../game/weapons'

export type GamePhase = 'menu' | 'playing' | 'won' | 'lost'

export type BotState = {
  id: number
  health: number
  alive: boolean
  spawn: [number, number]
}

type GameState = {
  phase: GamePhase
  health: number
  selectedWeapon: WeaponId
  magazines: Record<WeaponId, number>
  reserves: Record<WeaponId, number>
  reloading: boolean
  timeLeft: number
  kills: number
  score: number
  shots: number
  hits: number
  shotSerial: number
  hitSerial: number
  weaponSerial: number
  pointerLocked: boolean
  aiming: boolean
  message: string
  roundId: number
  bots: BotState[]
  startRound: () => void
  setPointerLocked: (locked: boolean) => void
  setAiming: (aiming: boolean) => void
  selectWeapon: (weapon: WeaponId) => void
  fire: () => boolean
  reload: () => void
  hitBot: (id: number, damage: number, headshot: boolean) => void
  damagePlayer: (damage: number) => void
  tick: (delta: number) => void
}

const makeBots = (): BotState[] => botSpawns.map((spawn, id) => ({
  id,
  health: 100,
  alive: true,
  spawn,
}))

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  health: 100,
  selectedWeapon: 'rifle',
  magazines: makeStartingMagazines(),
  reserves: makeStartingReserves(),
  reloading: false,
  timeLeft: 90,
  kills: 0,
  score: 0,
  shots: 0,
  hits: 0,
  shotSerial: 0,
  hitSerial: 0,
  weaponSerial: 0,
  pointerLocked: false,
  aiming: false,
  message: 'Oczyść teren',
  roundId: 0,
  bots: makeBots(),

  startRound: () => set((state) => ({
    phase: 'playing',
    health: 100,
    selectedWeapon: 'rifle',
    magazines: makeStartingMagazines(),
    reserves: makeStartingReserves(),
    reloading: false,
    timeLeft: 90,
    kills: 0,
    score: 0,
    shots: 0,
    hits: 0,
    shotSerial: 0,
    hitSerial: 0,
    weaponSerial: state.weaponSerial + 1,
    aiming: false,
    message: 'Oczyść teren',
    bots: makeBots(),
    roundId: state.roundId + 1,
  })),

  setPointerLocked: (pointerLocked) => set((state) => ({
    pointerLocked,
    aiming: pointerLocked ? state.aiming : false,
  })),

  setAiming: (aiming) => set((state) => ({
    aiming: state.phase === 'playing' && state.pointerLocked ? aiming : false,
  })),

  selectWeapon: (selectedWeapon) => {
    const state = get()
    if (state.phase !== 'playing' || state.selectedWeapon === selectedWeapon) return
    set({
      selectedWeapon,
      reloading: false,
      weaponSerial: state.weaponSerial + 1,
      message: weaponDefinitions[selectedWeapon].name,
    })
  },

  fire: () => {
    const state = get()
    const ammo = state.magazines[state.selectedWeapon]
    if (state.phase !== 'playing' || state.reloading || ammo <= 0) return false
    set({
      magazines: { ...state.magazines, [state.selectedWeapon]: ammo - 1 },
      shots: state.shots + 1,
      shotSerial: state.shotSerial + 1,
      message: ammo === 1 ? 'Magazynek pusty — R' : state.message,
    })
    return true
  },

  reload: () => {
    const state = get()
    const weapon = weaponDefinitions[state.selectedWeapon]
    const ammo = state.magazines[state.selectedWeapon]
    const reserve = state.reserves[state.selectedWeapon]
    if (state.phase !== 'playing' || state.reloading || ammo === weapon.magazineSize || reserve === 0) return
    const roundId = state.roundId
    const weaponId = state.selectedWeapon
    const weaponSerial = state.weaponSerial
    set({ reloading: true, aiming: false, message: 'Przeładowanie…' })
    window.setTimeout(() => {
      const current = get()
      if (
        current.roundId !== roundId || current.phase !== 'playing' ||
        current.selectedWeapon !== weaponId || current.weaponSerial !== weaponSerial
      ) return
      const currentAmmo = current.magazines[weaponId]
      const currentReserve = current.reserves[weaponId]
      const needed = weapon.magazineSize - currentAmmo
      const loaded = Math.min(needed, currentReserve)
      set({
        magazines: { ...current.magazines, [weaponId]: currentAmmo + loaded },
        reserves: { ...current.reserves, [weaponId]: currentReserve - loaded },
        reloading: false,
        message: 'Broń gotowa',
      })
    }, weapon.reloadTime)
  },

  hitBot: (id, damage, headshot) => {
    const state = get()
    const target = state.bots.find((bot) => bot.id === id)
    if (!target?.alive || state.phase !== 'playing') return
    const nextHealth = Math.max(0, target.health - damage)
    const killed = nextHealth === 0
    const bots = state.bots.map((bot) => bot.id === id
      ? { ...bot, health: nextHealth, alive: !killed }
      : bot)
    const kills = state.kills + (killed ? 1 : 0)
    set({
      bots,
      kills,
      hits: state.hits + 1,
      hitSerial: state.hitSerial + 1,
      score: state.score + (killed ? (headshot ? 250 : 150) : 20),
      message: killed ? (headshot ? 'Strzał w głowę!' : 'Cel wyeliminowany') : 'Trafienie',
      phase: bots.every((bot) => !bot.alive) ? 'won' : state.phase,
      pointerLocked: bots.every((bot) => !bot.alive) ? false : state.pointerLocked,
      aiming: bots.every((bot) => !bot.alive) ? false : state.aiming,
    })
    if (bots.every((bot) => !bot.alive)) document.exitPointerLock?.()
  },

  damagePlayer: (damage) => {
    const state = get()
    if (state.phase !== 'playing') return
    const health = Math.max(0, state.health - damage)
    set({
      health,
      message: health === 0 ? 'Operator wyeliminowany' : 'Jesteś pod ostrzałem',
      phase: health === 0 ? 'lost' : state.phase,
      pointerLocked: health === 0 ? false : state.pointerLocked,
      aiming: health === 0 ? false : state.aiming,
    })
    if (health === 0) document.exitPointerLock?.()
  },

  tick: (delta) => {
    const state = get()
    if (state.phase !== 'playing') return
    const timeLeft = Math.max(0, state.timeLeft - delta)
    set({
      timeLeft,
      phase: timeLeft === 0 ? 'lost' : state.phase,
      message: timeLeft === 0 ? 'Czas minął' : state.message,
      pointerLocked: timeLeft === 0 ? false : state.pointerLocked,
      aiming: timeLeft === 0 ? false : state.aiming,
    })
    if (timeLeft === 0) document.exitPointerLock?.()
  },
}))
