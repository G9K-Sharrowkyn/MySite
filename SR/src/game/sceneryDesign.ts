import { TRACK_WIDTH } from './raceRules.ts';

export type OpenWorldTrackId = 'tatooine' | 'korriban';
export type CliffRole = 'canyon' | 'backdrop' | 'ridge';

export interface MountainStation {
  distance: number;
  variant: number;
  rotation: number;
  side: -1 | 1;
  lateralDistance: number;
  scale: number;
}

export interface CliffStation {
  distance: number;
  height: number;
  width: number;
  side: -1 | 1;
  lateralDistance: number;
  rotation: number;
  role: CliffRole;
}

export interface CanyonSection {
  start: number;
  end: number;
}

export interface RockWallStation {
  distance: number;
  length: number;
  height: number;
  side: -1 | 1;
  lateralDistance: number;
  rotation: number;
}

export interface DuneFieldStation {
  distance: number;
  side: -1 | 1;
  lateralDistance: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
}

export interface OpenWorldScenery {
  desertStart: number;
  desertEnd: number;
  canyonSections: CanyonSection[];
  cliffChunkLength: number;
  mountains: MountainStation[];
  cliffs: CliffStation[];
  rockWalls: RockWallStation[];
  duneFields: DuneFieldStation[];
}

// Maksymalny promien modelu w poziomie, juz z jego wewnetrznym skalowaniem.
// Generator wykorzystuje te wartosci, aby nawet obrocona gora nie weszla na jezdnie.
export const MOUNTAIN_BASE_HALF_WIDTHS = [6, 7.6, 6, 11.8, 7.8, 6.4] as const;
export const ROAD_SCENERY_CLEARANCE = 3.4;

function noise(seed: number): number {
  const value = Math.sin(seed * 91.173 + 17.731) * 43758.5453;
  return value - Math.floor(value);
}

function placeInBand(fraction: number, start: number, end: number, margin: number): number {
  return start + margin + fraction * Math.max(1, end - start - margin * 2);
}

function placeOutsideBand(
  fraction: number,
  trackLength: number,
  bandStart: number,
  bandEnd: number,
): number {
  const startMargin = 28;
  const transitionMargin = 135;
  const endMargin = 150;
  const firstStart = startMargin;
  const firstEnd = bandStart - transitionMargin;
  const secondStart = bandEnd + transitionMargin;
  const secondEnd = trackLength - endMargin;
  const firstLength = Math.max(1, firstEnd - firstStart);
  const secondLength = Math.max(1, secondEnd - secondStart);
  const offset = fraction * (firstLength + secondLength);
  return offset <= firstLength
    ? firstStart + offset
    : secondStart + offset - firstLength;
}

export function getMountainHalfWidth(
  trackId: OpenWorldTrackId,
  variant: number,
  scale: number,
): number {
  const themeScale = trackId === 'korriban' ? 1.12 : 1;
  return MOUNTAIN_BASE_HALF_WIDTHS[variant % MOUNTAIN_BASE_HALF_WIDTHS.length]
    * scale
    * themeScale;
}

function getMountainSide(index: number): -1 | 1 {
  const repeat = Math.floor(index / MOUNTAIN_BASE_HALF_WIDTHS.length);
  const variant = index % MOUNTAIN_BASE_HALF_WIDTHS.length;
  const sidePattern = [-1, -1, -1, 1, 1, 1] as const;
  return sidePattern[(variant + repeat) % sidePattern.length];
}

function buildTatooineCanyon(
  trackLength: number,
  desertStart: number,
  desertEnd: number,
  chunkLength: number,
): CliffStation[] {
  const closeSpacing = chunkLength * 0.72;
  const backdropSpacing = chunkLength * 0.82;
  const canyonSections: CanyonSection[] = [
    { start: 0, end: desertStart },
    { start: desertEnd, end: trackLength },
  ];

  const canyonWalls = ([-1, 1] as const).flatMap((side, sideIndex) => (
    canyonSections.flatMap((section, sectionIndex) => {
      const firstCenter = section.start - chunkLength * 0.42;
      const lastCenter = section.end + chunkLength * 0.42;
      const count = Math.ceil((lastCenter - firstCenter) / closeSpacing) + 1;
      return Array.from({ length: count }, (_, index): CliffStation => {
        const seed = sectionIndex * 1009 + sideIndex * 503 + index * 19;
        const progress = count <= 1 ? 0 : index / (count - 1);
        const broadWave = Math.sin(progress * Math.PI * (2.4 + sectionIndex * 0.35) + sideIndex);
        return {
          distance: Math.round(firstCenter + index * closeSpacing),
          height: 10.5 + noise(seed + 1) * 9.5 + broadWave * 2.2,
          width: 6.6 + noise(seed + 2) * 2.4,
          side,
          lateralDistance: 13.2 + noise(seed + 3) * 3.2 + broadWave * 0.8,
          rotation: (noise(seed + 4) - 0.5) * 0.035,
          role: 'canyon',
        };
      });
    })
  ));

  // W otwartej czesci sciany odsuwaja sie na horyzont. Nadal tworza ciagla
  // sylwetke po obu stronach i zaslaniaja granice plaszczyzny pustyni.
  const backdropStart = desertStart - chunkLength * 0.35;
  const backdropEnd = desertEnd + chunkLength * 0.35;
  const backdropCount = Math.ceil((backdropEnd - backdropStart) / backdropSpacing) + 1;
  const backdropWalls = ([-1, 1] as const).flatMap((side, sideIndex) => (
    Array.from({ length: backdropCount }, (_, index): CliffStation => {
      const seed = 4001 + sideIndex * 733 + index * 23;
      const progress = backdropCount <= 1 ? 0 : index / (backdropCount - 1);
      return {
        distance: Math.round(backdropStart + index * backdropSpacing),
        height: 22 + noise(seed + 1) * 17 + Math.sin(progress * Math.PI * 3.2) * 3.5,
        width: 15 + noise(seed + 2) * 9,
        side,
        lateralDistance: 66 + noise(seed + 3) * 38 + Math.sin(progress * Math.PI * 2 + sideIndex) * 8,
        rotation: (noise(seed + 4) - 0.5) * 0.045,
        role: 'backdrop',
      };
    })
  ));

  return [...canyonWalls, ...backdropWalls];
}

function buildKorribanRidge(
  start: number,
  end: number,
  chunkLength: number,
): CliffStation[] {
  const count = Math.ceil((end - start) / chunkLength);
  return ([-1, 1] as const).flatMap((side, sideIndex) => (
    Array.from({ length: count }, (_, index): CliffStation => {
      const seed = index * 17 + sideIndex * 103 + 9;
      return {
        distance: Math.round(
          start + index * chunkLength
            + (side > 0 ? chunkLength * 0.36 : 0)
            + (noise(seed + 1) - 0.5) * 8,
        ),
        height: 7.5 + noise(seed + 2) * 7,
        width: 7.8 + noise(seed + 5) * 2,
        side,
        lateralDistance: TRACK_WIDTH / 2 + 7.5 + noise(seed + 3) * 5,
        rotation: (noise(seed + 4) - 0.5) * 0.05,
        role: 'ridge',
      };
    })
  ));
}

export function buildOpenWorldScenery(
  trackId: OpenWorldTrackId,
  trackLength: number,
): OpenWorldScenery {
  const isTatooine = trackId === 'tatooine';
  const desertStart = Math.round(trackLength / 3);
  const desertEnd = Math.round(trackLength * 2 / 3);
  const korribanRidgeStart = Math.round(trackLength * 0.37);
  const korribanRidgeEnd = Math.round(korribanRidgeStart + trackLength * 0.25);
  const cliffChunkLength = isTatooine ? 96 : 78;
  const mountainBandStart = isTatooine ? desertStart : korribanRidgeStart;
  const mountainBandEnd = isTatooine ? desertEnd : korribanRidgeEnd;

  const mountains = Array.from({ length: 36 }, (_, index): MountainStation => {
    const variant = index % MOUNTAIN_BASE_HALF_WIDTHS.length;
    const repeat = Math.floor(index / MOUNTAIN_BASE_HALF_WIDTHS.length);
    const seed = index * 37 + (trackId === 'korriban' ? 211 : 17);
    const depthBand = (variant + repeat * 2) % 3;
    const isSignatureMountain = index === 3;
    const scale = isSignatureMountain ? 1.85 : 0.66 + noise(seed + 3) * 0.7;
    const halfWidth = getMountainHalfWidth(trackId, variant, scale);
    let lateralDistance: number;

    if (isSignatureMountain) {
      lateralDistance = isTatooine ? 76 : 118;
    } else if (depthBand === 0) {
      lateralDistance = isTatooine
        ? 48 + noise(seed + 4) * 38
        : 58 + noise(seed + 4) * 92;
    } else if (depthBand === 1) {
      lateralDistance = 27 + noise(seed + 4) * 20;
    } else {
      lateralDistance = TRACK_WIDTH / 2
        + ROAD_SCENERY_CLEARANCE
        + halfWidth
        + noise(seed + 4) * 11;
    }

    const fraction = Math.max(0.004, Math.min(0.996,
      (index + 0.42) / 36 + (noise(seed + 5) - 0.5) * 0.012));
    const distance = isTatooine
      ? placeInBand(fraction, desertStart, desertEnd, 42)
      : placeOutsideBand(fraction, trackLength, mountainBandStart, mountainBandEnd);
    return {
      distance: Math.round(distance),
      variant,
      rotation: (repeat % 3) * (Math.PI * 2 / 3)
        + (noise(seed + 6) - 0.5) * 0.24,
      side: getMountainSide(index),
      lateralDistance,
      scale,
    };
  });

  const canyonSections: CanyonSection[] = isTatooine
    ? [{ start: 0, end: desertStart }, { start: desertEnd, end: trackLength }]
    : [];
  const cliffs = isTatooine
    ? buildTatooineCanyon(trackLength, desertStart, desertEnd, cliffChunkLength)
    : buildKorribanRidge(korribanRidgeStart, korribanRidgeEnd, cliffChunkLength);

  const rockWalls: RockWallStation[] = [
    {
      distance: Math.round(trackLength * (isTatooine ? 0.43 : 0.205)),
      length: isTatooine ? 128 : 116,
      height: isTatooine ? 13.5 : 16,
      side: -1,
      lateralDistance: isTatooine ? 24 : 22,
      rotation: isTatooine ? -0.035 : 0.045,
    },
    {
      distance: Math.round(trackLength * (isTatooine ? 0.585 : 0.785)),
      length: isTatooine ? 112 : 126,
      height: isTatooine ? 10.5 : 14,
      side: 1,
      lateralDistance: isTatooine ? 29 : 24,
      rotation: isTatooine ? 0.05 : -0.04,
    },
  ];

  const duneFields: DuneFieldStation[] = isTatooine
    ? [
      { distance: Math.round(trackLength * 0.39), side: 1, lateralDistance: 16, width: 18, depth: 32, height: 1.7, rotation: -0.18 },
      { distance: Math.round(trackLength * 0.43), side: -1, lateralDistance: 21, width: 28, depth: 38, height: 2.5, rotation: 0.12 },
      { distance: Math.round(trackLength * 0.555), side: -1, lateralDistance: 17, width: 21, depth: 36, height: 1.9, rotation: 0.2 },
      { distance: Math.round(trackLength * 0.61), side: 1, lateralDistance: 24, width: 34, depth: 46, height: 3.1, rotation: -0.1 },
    ]
    : [];

  return {
    desertStart,
    desertEnd,
    canyonSections,
    cliffChunkLength,
    mountains,
    cliffs,
    rockWalls,
    duneFields,
  };
}
