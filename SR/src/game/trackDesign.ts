import type { TrackEvent } from '../store/gameStore.ts';

type PatternEvent = Omit<TrackEvent, 'distance'> & { offset: number };

// Every authored pack contains exactly three boost pads and two hazards.
// Changing gaps and lane changes form readable racing lines rather than a grid.
const EVENT_PACKS: PatternEvent[][] = [
  [
    { offset: 18, type: 'boost', x: 2 },
    { offset: 21, type: 'boulder', x: 0 },
    { offset: 24, type: 'boost', x: 2 },
    { offset: 101, type: 'boost', x: -2 },
    { offset: 106, type: 'wall', x: 0, side: 'left' },
  ],
  [
    { offset: 16, type: 'boost', x: -2 },
    { offset: 19, type: 'mine', x: 0.2 },
    { offset: 23, type: 'boost', x: -2 },
    { offset: 104, type: 'gate', x: 0, width: 2.5 },
    { offset: 108, type: 'boost', x: 0 },
  ],
  [
    { offset: 20, type: 'lowBarrier', x: 0 },
    { offset: 24, type: 'boost', x: 1.7 },
    { offset: 28, type: 'boost', x: 1.7 },
    { offset: 99, type: 'boulder', x: 0.7 },
    { offset: 103, type: 'boost', x: -1.7 },
  ],
  [
    { offset: 15, type: 'boost', x: 0.8 },
    { offset: 18, type: 'boost', x: 0.8 },
    { offset: 22, type: 'boulder', x: -1.5 },
    { offset: 106, type: 'wall', x: 0, side: 'right' },
    { offset: 111, type: 'boost', x: 2 },
  ],
  [
    { offset: 19, type: 'mine', x: 0 },
    { offset: 22, type: 'boost', x: -1.8 },
    { offset: 26, type: 'boost', x: -1.8 },
    { offset: 102, type: 'boost', x: 0 },
    { offset: 107, type: 'gate', x: 0, width: 2.25 },
  ],
  [
    { offset: 17, type: 'boost', x: 1.8 },
    { offset: 20, type: 'boulder', x: 0 },
    { offset: 24, type: 'boost', x: 1.8 },
    { offset: 98, type: 'lowBarrier', x: 0 },
    { offset: 103, type: 'boost', x: -1.4 },
  ],
  [
    { offset: 18, type: 'boost', x: -1.4 },
    { offset: 22, type: 'gate', x: -1.4, width: 2.2 },
    { offset: 26, type: 'boost', x: -1.4 },
    { offset: 105, type: 'mine', x: 1.3 },
    { offset: 109, type: 'boost', x: -1.5 },
  ],
  [
    { offset: 16, type: 'wall', x: 0, side: 'center' },
    { offset: 21, type: 'boost', x: 0 },
    { offset: 25, type: 'boost', x: 0 },
    { offset: 101, type: 'boulder', x: 1.4 },
    { offset: 105, type: 'boost', x: -1.5 },
  ],
];

function mirrorSide(side: TrackEvent['side']): TrackEvent['side'] {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return side;
}

export function buildTrackEvents(
  packCount: number,
  packSpan: number,
  patternOffset: number,
  difficulty: number,
): TrackEvent[] {
  const startOffset = 30;
  const events: TrackEvent[] = [];

  for (let packIndex = 0; packIndex < packCount; packIndex += 1) {
    const patternIndex = packIndex === 0
      ? 0
      : (packIndex + patternOffset) % EVENT_PACKS.length;
    const mirror = (packIndex + patternOffset) % 3 === 2 ? -1 : 1;

    for (const event of EVENT_PACKS[patternIndex]) {
      events.push({
        distance: startOffset + packIndex * packSpan + event.offset,
        type: event.type,
        x: event.x * mirror,
        width: event.width === undefined
          ? undefined
          : Math.max(1.55, event.width - difficulty * 0.12),
        side: mirror === -1 ? mirrorSide(event.side) : event.side,
      });
    }
  }

  return events;
}
