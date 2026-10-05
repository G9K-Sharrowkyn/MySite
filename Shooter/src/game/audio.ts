import { weaponSoundAsset } from './assetPaths'
import type { WeaponId } from './weapons'

let audioContext: AudioContext | null = null
const bufferCache = new Map<string, Promise<AudioBuffer>>()
const variationIndex: Record<WeaponId, number> = { pistol: 0, rifle: 0, shotgun: 0 }

const samples = {
  pistol: {
    shots: ['pistol/shot-01.ogg', 'pistol/shot-02.ogg', 'pistol/shot-03.ogg'],
    equip: 'pistol/equip.ogg',
    reload: [
      [0, 'pistol/reload-drop.ogg'],
      [330, 'pistol/reload-insert.ogg'],
      [760, 'pistol/reload-slide.ogg'],
    ],
  },
  rifle: {
    shots: ['rifle/shot-01.ogg', 'rifle/shot-02.ogg', 'rifle/shot-03.ogg'],
    equip: 'rifle/equip.ogg',
    reload: [
      [0, 'rifle/reload-drop.ogg'],
      [470, 'rifle/reload-insert.ogg'],
      [990, 'rifle/reload-bolt.ogg'],
    ],
  },
  shotgun: {
    shots: ['shotgun/shot-01.ogg', 'shotgun/shot-02.ogg', 'shotgun/shot-03.ogg'],
    equip: 'shotgun/equip.ogg',
    reload: [
      [0, 'shotgun/reload-chamber.ogg'],
      [690, 'shotgun/reload-slide.ogg'],
    ],
  },
} as const satisfies Record<WeaponId, {
  shots: readonly string[]
  equip: string
  reload: readonly (readonly [number, string])[]
}>

function context() {
  audioContext ??= new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function loadSample(file: string) {
  const url = weaponSoundAsset(file)
  let pending = bufferCache.get(url)
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Nie udało się pobrać dźwięku: ${url}`)
        return response.arrayBuffer()
      })
      .then((data) => context().decodeAudioData(data))
    bufferCache.set(url, pending)
  }
  return pending
}

function playSample(file: string, volume = 1) {
  void loadSample(file).then((buffer) => {
    const ctx = context()
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(ctx.destination)
    source.start()
  }).catch(() => undefined)
}

function tone(frequency: number, duration: number, volume: number, type: OscillatorType) {
  const ctx = context()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start()
  oscillator.stop(ctx.currentTime + duration)
}

export const gameAudio = {
  preload() {
    context()
    const files = Object.values(samples).flatMap((bank) => [
      ...bank.shots,
      bank.equip,
      ...bank.reload.map(([, file]) => file),
    ])
    void Promise.allSettled(files.map(loadSample))
  },
  shot(weapon: WeaponId = 'rifle') {
    const bank = samples[weapon]
    const index = variationIndex[weapon] % bank.shots.length
    variationIndex[weapon] += 1
    playSample(bank.shots[index], weapon === 'shotgun' ? 0.72 : 0.58)
  },
  empty() { tone(320, 0.04, 0.045, 'square') },
  hit() { tone(880, 0.055, 0.05, 'sine') },
  reload(weapon: WeaponId) {
    for (const [delay, file] of samples[weapon].reload) {
      window.setTimeout(() => playSample(file, 0.55), delay)
    }
  },
  equip(weapon: WeaponId) {
    playSample(samples[weapon].equip, 0.46)
  },
  enemyShot() { tone(82, 0.07, 0.04, 'sawtooth') },
}
