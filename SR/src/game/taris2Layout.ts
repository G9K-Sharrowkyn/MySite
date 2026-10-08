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

const PLAZA_DISTANCES = [14, 29, 50, 77] as const;
const PLAZA_HEIGHTS = [1.8, 3.3, 7.5, 12] as const;

export function getTaris2PlazaPlan(section: number, sideIndex: number): Taris2PlazaPlan | null {
  // Leaving some city blocks without a plaza makes the skyline less rhythmic.
  if ((section * 2 + sideIndex) % 5 === 3) return null;
  const tier = (section * 3 + sideIndex * 2) % PLAZA_DISTANCES.length;
  const xDistance = PLAZA_DISTANCES[tier];
  return {
    xDistance,
    z: (taris2Random(section, sideIndex, 162) - .5) * 13,
    height: PLAZA_HEIGHTS[tier],
    scaleX: tier === 0 ? 14 : 18,
    scaleZ: tier < 2 ? 17 : 15,
    style: (section + sideIndex) % 3,
    avenueX: tier < 2 ? 51 : 95,
    avenueY: tier < 2 ? 3.3 : 12,
  };
}
