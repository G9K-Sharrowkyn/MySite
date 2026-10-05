export function toonAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}models/toon-shooter/${fileName}`
}

export function fpsTemplateAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}models/free-fps-template/${fileName}`
}

export function realisticWeaponAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}models/realistic-weapons/${fileName}`
}

export function industrialTextureAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}textures/industrial/${fileName}`
}

export function environmentAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}environment/${fileName}`
}

export function effectTextureAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}textures/${fileName}`
}

export function weaponSoundAsset(fileName: string) {
  return `${import.meta.env.BASE_URL}audio/free-weapon-sounds/${fileName}`
}
