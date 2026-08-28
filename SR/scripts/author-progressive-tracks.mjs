import { readFile, writeFile } from 'node:fs/promises';

const TRACK_FILE = new URL('../src/game/trackLayouts.json', import.meta.url);
const TRACK_LENGTHS = {
  taris: 2650,
  tatooine: 4200,
  manaan: 5100,
  korriban: 6000,
};
const DIFFICULTY = {
  tatooine: 1,
  manaan: 2,
  korriban: 3,
};

const file = JSON.parse(await readFile(TRACK_FILE, 'utf8'));
const taris = file.tracks?.taris;
if (!Array.isArray(taris) || taris.length < 2) {
  throw new Error('Canonical Taris layout is missing or too short.');
}

const tarisSnapshot = JSON.stringify(taris);
const tarisGaps = taris.slice(1).map((event, index) => event.distance - taris[index].distance);
if (tarisGaps.some((gap) => !Number.isFinite(gap) || gap <= 0)) {
  throw new Error('Taris events must have strictly increasing distances.');
}

const sortedGaps = [...tarisGaps].sort((a, b) => a - b);
const cycleGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
const finishMargin = TRACK_LENGTHS.taris - taris.at(-1).distance;

function mirrorEvent(event, mirrored) {
  const clone = { ...event };
  if (!mirrored) return clone;
  clone.x = -clone.x;
  if (clone.side === 'left') clone.side = 'right';
  else if (clone.side === 'right') clone.side = 'left';
  return clone;
}

function buildTrack(trackId) {
  const compression = DIFFICULTY[trackId];
  const limit = TRACK_LENGTHS[trackId] - finishMargin;
  const events = [];
  let distance = taris[0].distance;
  let index = 0;

  while (distance < limit) {
    const sourceIndex = index % taris.length;
    const cycle = Math.floor(index / taris.length);
    const mirrored = (cycle + compression) % 2 === 1;
    const event = mirrorEvent(taris[sourceIndex], mirrored);
    events.push({ ...event, distance });

    index += 1;
    const nextSourceIndex = index % taris.length;
    const sourceGap = nextSourceIndex === 0
      ? cycleGap
      : taris[nextSourceIndex].distance - taris[nextSourceIndex - 1].distance;
    distance += Math.max(3, sourceGap - compression);
  }

  return events;
}

for (const trackId of Object.keys(DIFFICULTY)) {
  file.tracks[trackId] = buildTrack(trackId);
}

if (JSON.stringify(file.tracks.taris) !== tarisSnapshot) {
  throw new Error('Refusing to write: the handcrafted Taris layout changed.');
}

await writeFile(TRACK_FILE, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

const report = Object.fromEntries(Object.entries(file.tracks).map(([trackId, events]) => {
  const gaps = events.slice(1).map((event, index) => event.distance - events[index].distance);
  const boosts = events.filter((event) => event.type === 'boost').length;
  return [trackId, {
    objects: events.length,
    boosts,
    hazards: events.length - boosts,
    first: events[0].distance,
    last: events.at(-1).distance,
    minimumGap: Math.min(...gaps),
    averageGap: Number((gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length).toFixed(2)),
    medianGap: [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)],
    maximumGap: Math.max(...gaps),
  }];
}));

console.log(JSON.stringify({ tarisPreserved: true, cycleGap, finishMargin, tracks: report }, null, 2));
