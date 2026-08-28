import { readFile, writeFile } from 'node:fs/promises';

const TRACK_FILE = new URL('../src/game/trackLayouts.json', import.meta.url);
const DT = 1 / 1000;
const MAX_SPEED = 400;

const GEARS = [
  null,
  { min: 0, max: 80, startAcceleration: 30, endAcceleration: 18 },
  { min: 70, max: 145, startAcceleration: 10, endAcceleration: 7 },
  { min: 130, max: 220, startAcceleration: 7, endAcceleration: 5 },
  { min: 205, max: 305, startAcceleration: 5, endAcceleration: 3.8 },
  { min: 290, max: 400, startAcceleration: 4, endAcceleration: 2.2 },
];

const TRACKS = {
  taris: { duration: 43, length: 2650, extraPacks: 0 },
  tatooine: { duration: 58.59, length: 4200, extraPacks: 2 },
  manaan: { duration: 67.67, length: 5100, extraPacks: 3 },
  korriban: { duration: 76.74, length: 6000, extraPacks: 4 },
};

// The opening follows the cadence described from KOTOR. From 24 seconds on,
// seven boost pads are interleaved with hazards, giving a readable 3:2 ratio.
const BASE_SCHEDULE = [
  [3, 'boost'], [4, 'hazard'], [6, 'boost'], [7, 'boost'], [8, 'hazard'],
  [9, 'boost'], [10, 'hazard'], [13, 'boost'], [15, 'boost'], [17, 'boost'],
  [19, 'hazard'], [20, 'boost'], [22, 'hazard'], [24, 'boost'], [25.5, 'hazard'],
  [27, 'boost'], [28.5, 'hazard'], [30, 'boost'], [31.5, 'hazard'], [33, 'boost'],
  [34.5, 'hazard'], [36, 'boost'], [37.5, 'hazard'], [39, 'boost'], [42, 'boost'],
].map(([time, category]) => ({ time, category }));

function extensionSchedule(duration, packCount) {
  const count = packCount * 5;
  if (count === 0) return [];
  const start = 44;
  const end = duration - 1.5;
  const step = count === 1 ? 0 : (end - start) / (count - 1);
  const categories = ['boost', 'hazard', 'boost', 'hazard', 'boost'];
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * step,
    category: categories[index % categories.length],
  }));
}

function acceleration(speed, gear) {
  const definition = GEARS[gear];
  const range = definition.max - definition.min;
  const progress = Math.max(0, Math.min(1, (speed - definition.min) / range));
  return definition.startAcceleration
    + (definition.endAcceleration - definition.startAcceleration) * progress;
}

function shiftProgress(speed, gear) {
  const definition = GEARS[gear];
  return Math.max(0, Math.min(1, (speed - definition.min) / (definition.max - definition.min)));
}

function worldFlow(speed) {
  const effectProgress = Math.max(0, Math.min(1, (speed - 30) / 240));
  const speedEffect = effectProgress ** 1.35;
  return (speed * 0.08 + speed * speed * 0.00011) * (1 + speedEffect);
}

function simulateSchedule(schedule, duration) {
  let time = 0;
  let distance = 0;
  let speed = 10;
  let gear = 1;
  let eventIndex = 0;
  const distances = [];
  const shifts = [];

  while (time <= duration + DT) {
    speed = Math.min(GEARS[gear].max, speed + acceleration(speed, gear) * DT);
    distance += worldFlow(speed) * DT;
    time += DT;

    while (eventIndex < schedule.length && time >= schedule[eventIndex].time) {
      distances[eventIndex] = distance;
      if (schedule[eventIndex].category === 'boost') speed = Math.min(MAX_SPEED, speed + 15);
      eventIndex += 1;
    }

    if (gear < 5 && shiftProgress(speed, gear) >= 0.95) {
      gear += 1;
      shifts.push({ time, gear, speed, distance });
    }
  }

  return { distances, shifts, finishDistance: distance };
}

function sampleTemplates(pool, count) {
  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.min(pool.length - 1, Math.floor(index * pool.length / count));
    const { distance: _distance, ...template } = pool[sourceIndex];
    return { ...template };
  });
}

const file = JSON.parse(await readFile(TRACK_FILE, 'utf8'));
const authoredTracks = {};
const report = {};

for (const [trackId, config] of Object.entries(TRACKS)) {
  const source = file.tracks[trackId];
  const schedule = [
    ...BASE_SCHEDULE,
    ...extensionSchedule(config.duration, config.extraPacks),
  ].sort((a, b) => a.time - b.time);
  const simulation = simulateSchedule(schedule, config.duration);
  const boostCount = schedule.filter((event) => event.category === 'boost').length;
  const hazardCount = schedule.length - boostCount;
  const boostTemplates = sampleTemplates(source.filter((event) => event.type === 'boost'), boostCount);
  const hazardTemplates = sampleTemplates(source.filter((event) => event.type !== 'boost'), hazardCount);
  let boostIndex = 0;
  let hazardIndex = 0;

  authoredTracks[trackId] = schedule.map((scheduled, index) => {
    const template = scheduled.category === 'boost'
      ? boostTemplates[boostIndex++]
      : hazardTemplates[hazardIndex++];
    return {
      ...template,
      distance: Math.max(1, Math.min(config.length - 1, Math.round(simulation.distances[index]))),
    };
  }).sort((a, b) => a.distance - b.distance || a.type.localeCompare(b.type));

  if (boostCount * 5 !== schedule.length * 3) {
    throw new Error(`${trackId}: object ratio is not exactly 3:2`);
  }
  if (authoredTracks[trackId].some((event) => event.distance >= config.length)) {
    throw new Error(`${trackId}: an event is outside the finish line`);
  }

  report[trackId] = {
    objects: schedule.length,
    boosts: boostCount,
    hazards: hazardCount,
    firstBoostAt: authoredTracks[trackId].find((event) => event.type === 'boost').distance,
    shifts: simulation.shifts.map((shift) => ({
      gear: shift.gear,
      time: Number(shift.time.toFixed(2)),
      speed: Number(shift.speed.toFixed(1)),
    })),
    simulatedDistanceAtFinish: Number(simulation.finishDistance.toFixed(1)),
    configuredLength: config.length,
    lastObjectAt: authoredTracks[trackId].at(-1).distance,
  };
}

await writeFile(TRACK_FILE, `${JSON.stringify({ version: 1, tracks: authoredTracks }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
