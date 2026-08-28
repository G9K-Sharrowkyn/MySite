const TRACK_FILE_URL = new URL('../src/game/trackLayouts.json', import.meta.url);
const SAVE_ENDPOINT = 'http://localhost:5173/api/track-layouts';
const HANDCRAFTED_END = 300;
const CELL_SPAN = 64;
const CELL_COUNT = 42;
const EXTRA_PAIR_CELLS = new Set([5, 17, 29]);

const L = -1.8;
const C = 0;
const R = 1.8;

const boost = (offset, x) => ({ offset, type: 'boost', x });
const boulder = (offset, x) => ({ offset, type: 'boulder', x });
const mine = (offset, x) => ({ offset, type: 'mine', x });
const barrier = (offset) => ({ offset, type: 'lowBarrier', x: 0 });
const gate = (offset, x) => ({ offset, type: 'gate', x, width: 2.2 });
const wall = (offset, side) => ({ offset, type: 'wall', x: 0, side });

// Each cell has three boosts and two hazards. The patterns form readable
// racing lines, not independent random placements.
const CELLS = [
  [boost(8, L), boulder(20, C), boost(32, R), mine(46, L), boost(56, R)],
  [boost(10, R), barrier(24), boost(36, L), gate(49, 0), boost(60, C)],
  [wall(8, 'left'), boost(18, L), boost(31, C), boulder(44, R), boost(57, L)],
  [boost(12, R), mine(24, C), boost(36, L), boulder(50, R), boost(50, L)],
  [boost(8, C), gate(21, -0.6), boost(34, L), barrier(47), boost(59, R)],
  [boulder(10, L), boost(22, R), boost(35, C), wall(48, 'right'), boost(60, R)],
  [boost(8, L), mine(21, L), boost(34, R), gate(48, 0.6), boost(60, C)],
  [barrier(10), boost(22, C), boulder(34, R), boost(47, L), boost(59, R)],
  [boost(8, R), wall(20, 'left'), boost(32, L), mine(45, C), boost(58, R)],
  [gate(10, 0), boost(22, C), boost(35, L), boulder(48, C), boost(60, R)],
  [boost(8, L), barrier(21), boost(33, R), mine(46, R), boost(59, L)],
  [boulder(10, C), boost(22, L), boost(34, R), wall(48, 'right'), boost(60, R)],
];

function mirrorEvent(event, mirror) {
  const mirrored = {
    ...event,
    x: event.type === 'wall' || event.type === 'lowBarrier' ? 0 : event.x * mirror,
  };
  if (event.side && mirror === -1) {
    mirrored.side = event.side === 'left' ? 'right' : event.side === 'right' ? 'left' : event.side;
  }
  return mirrored;
}

function buildExtension() {
  const events = [];
  for (let cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
    const pattern = CELLS[cellIndex % CELLS.length];
    const mirror = Math.floor(cellIndex / 3) % 2 === 0 ? 1 : -1;
    const start = HANDCRAFTED_END + cellIndex * CELL_SPAN;
    for (const template of pattern) {
      const event = mirrorEvent(template, mirror);
      const { offset, ...trackEvent } = event;
      events.push({ ...trackEvent, distance: start + offset });
    }
    // Three deliberately spaced route-choice pairs bring the complete authored
    // track to an exact 3:2 boost-to-hazard ratio.
    if (EXTRA_PAIR_CELLS.has(cellIndex)) {
      events.push({ type: 'boost', x: R * mirror, distance: start + 10 });
    }
  }
  return events.sort((a, b) => a.distance - b.distance || a.type.localeCompare(b.type));
}

function assertLayout(events, preserved) {
  const preservedAgain = events.filter((event) => event.distance <= HANDCRAFTED_END);
  if (JSON.stringify(preservedAgain) !== JSON.stringify(preserved)) {
    throw new Error('The handcrafted 0–300 m section changed.');
  }
  if (events.some((event) => event.distance < 1 || event.distance >= 3000)) {
    throw new Error('An event is outside the Taris track.');
  }
  for (let index = 1; index < events.length; index += 1) {
    if (events[index].distance < events[index - 1].distance) {
      throw new Error('Events are not sorted by distance.');
    }
  }
  const boostCount = events.filter((event) => event.type === 'boost').length;
  if (boostCount * 5 !== events.length * 3) {
    throw new Error('The complete Taris layout does not have an exact 3:2 object ratio.');
  }
}

const file = JSON.parse(await (await import('node:fs/promises')).readFile(TRACK_FILE_URL, 'utf8'));
const preserved = file.tracks.taris
  .filter((event) => event.distance <= HANDCRAFTED_END)
  .sort((a, b) => a.distance - b.distance);
const extension = buildExtension();
const taris = [...preserved, ...extension];
assertLayout(taris, preserved);

const payload = {
  version: 1,
  tracks: { ...file.tracks, taris },
};
const response = await fetch(SAVE_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const result = await response.json();
if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`);

const boostCount = taris.filter((event) => event.type === 'boost').length;
const gaps = taris.slice(1).map((event, index) => event.distance - taris[index].distance);
console.log(JSON.stringify({
  path: result.path,
  preserved: preserved.length,
  extension: extension.length,
  total: taris.length,
  boosts: boostCount,
  hazards: taris.length - boostCount,
  boostRatio: Number((boostCount / taris.length).toFixed(4)),
  shortestGap: Math.min(...gaps),
  longestGap: Math.max(...gaps),
  lastObjectAt: taris.at(-1).distance,
}, null, 2));
