export const TARIS2_SECTION_LENGTH = 40;
export const TARIS2_VIEW_DISTANCE = 650;

export function getTaris2SectionCount(trackLength: number) {
  // Keep real geometry beyond the finish and beyond the camera's far plane.
  return Math.ceil((trackLength + TARIS2_VIEW_DISTANCE + TARIS2_SECTION_LENGTH * 2) / TARIS2_SECTION_LENGTH);
}

export function taris2Random(section: number, index: number, salt: number) {
  let value = Math.imul(section + 149, 1597334677) ^ Math.imul(index + 71, 3812015801) ^ salt;
  value = Math.imul(value ^ value >>> 16, 2246822507);
  value = Math.imul(value ^ value >>> 13, 3266489909);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

export interface Taris2PlazaPlan {
  xDistance: number;
  z: number;
  height: number;
  scaleX: number;
  scaleZ: number;
  style: number;
  avenueX: number;
  avenueY: number;
}

const PLAZA_DISTANCES = [18, 42, 68, 102] as const;
const PLAZA_HEIGHTS = [-8, -1, 2.5, 9, 22, 38, 58] as const;
const AVENUES = [
  { x: 51, y: 3.3 },
  { x: 72, y: 9 },
  { x: 95, y: 12 },
  { x: 130, y: 19 },
] as const;

export function getTaris2PlazaPlan(section: number, sideIndex: number): Taris2PlazaPlan | null {
  // Leaving some city blocks without a plaza makes the skyline less rhythmic.
  if ((section * 2 + sideIndex) % 5 === 3) return null;
  // Only one block in twenty is close to the track. Most plazas are woven
  // through the middle and far city instead of lining the windows.
  const distribution = (section * 11 + sideIndex * 7) % 20;
  const tier = distribution === 0 ? 0 : distribution < 5 ? 1 : distribution < 13 ? 2 : 3;
  const xDistance = PLAZA_DISTANCES[tier];
  const height = PLAZA_HEIGHTS[Math.floor(taris2Random(section, sideIndex, 241) * PLAZA_HEIGHTS.length)];
  return {
    xDistance,
    z: (taris2Random(section, sideIndex, 162) - .5) * 13,
    height,
    scaleX: tier === 0 ? 14 : tier === 1 ? 18 + Math.floor(taris2Random(section, sideIndex, 252) * 3)
      : tier === 2 ? 23 + Math.floor(taris2Random(section, sideIndex, 252) * 4)
        : 26 + Math.floor(taris2Random(section, sideIndex, 252) * 6),
    scaleZ: tier === 0 ? 15 : 15 + Math.floor(taris2Random(section, sideIndex, 263) * 4),
    style: (section + sideIndex) % 3,
    avenueX: AVENUES[tier].x,
    avenueY: AVENUES[tier].y,
  };
}
