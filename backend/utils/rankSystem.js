const RANKS = [
  'Mortal',
  'Survivor',
  'Wanderer',
  'Initiate',
  'Novice',
  'Apprentice',
  'Adept',
  'Fighter',
  'Warrior',
  'Veteran',
  'Squire',
  'Footman',
  'Man-at-Arms',
  'Knight',
  'Knight-Errant',
  'Knight-Sergeant',
  'Knight-Captain',
  'Knight-Commander',
  'Knight-Champion',
  'Banner Lord',
  'Baron',
  'Viscount',
  'Count',
  'Earl',
  'Marquis',
  'Duke',
  'Lord',
  'Archduke',
  'Prince',
  'King',
  'High King',
  'Emperor',
  'High Emperor',
  'Warlord',
  'Overlord',
  'Conqueror',
  'Warmaster',
  'Grandmaster',
  'Paragon',
  'Legend',
  'Mythic',
  'Hero',
  'Champion',
  'Vanguard',
  'Vindicator',
  'Crusader',
  'Paladin',
  'Templar',
  'Justiciar',
  'Exemplar',
  'Magus',
  'Archmage',
  'Spellbinder',
  'Oracle',
  'Prophet',
  'Seer',
  'Sage',
  'Savant',
  'Luminary',
  'Archsage',
  'Titan',
  'Colossus',
  'Juggernaut',
  'Behemoth',
  'Leviathan',
  'Celestial',
  'Seraph',
  'Archangel',
  'Demigod',
  'Ascendant',
  'Eternal',
  'Radiant',
  'Stellar',
  'Astral',
  'Nebula',
  'Nova',
  'Voidwalker',
  'Starforged',
  'Planeswalker',
  'Worldshaper',
  'Realitybender',
  'Chronomancer',
  'Riftlord',
  'Voidlord',
  'Etherlord',
  'Empyrean',
  'Paracausal',
  'Omniwarden',
  'Infinityborn',
  'Godslayer',
  'Godking',
  'Celestarch',
  'High Seraph',
  'Archon',
  'Primarch',
  'Exarch',
  'Sovereign',
  'Apex',
  'Eternal Champion',
  'Immortal'
];

const POINTS_PER_LEVEL = 100;

export const RANK_POINT_VALUES = {
  comment: 2,
  post: 5,
  reaction: 1,
  win: 20,
  badgeLevel: 25
};

const clampLevel = (level) => {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(level, RANKS.length));
};

export const getRankLevel = (points) => {
  const safePoints = Math.max(0, Number(points) || 0);
  return clampLevel(Math.floor(safePoints / POINTS_PER_LEVEL) + 1);
};

export const getRankNameForLevel = (level) => {
  return RANKS[clampLevel(level) - 1];
};

export const getRankInfo = (points) => {
  const level = getRankLevel(points);
  return {
    level,
    rank: getRankNameForLevel(level)
  };
};

export const syncRankFromPoints = (user) => {
  if (!user) return null;
  user.stats = user.stats || {};
  const points = Number(user.stats.points) || 0;
  const { level, rank } = getRankInfo(points);
  user.stats.level = level;
  user.stats.rank = rank;
  return { level, rank, points };
};

export const addRankPoints = (user, points) => {
  if (!user) return null;
  const delta = Number(points) || 0;
  if (delta === 0) {
    return syncRankFromPoints(user);
  }
  user.stats = user.stats || {};
  user.stats.points = (user.stats.points || 0) + delta;
  return syncRankFromPoints(user);
};

const ensureBadgeLevels = (user) => {
  user.stats = user.stats || {};
  user.stats.badgeLevels = user.stats.badgeLevels || {};
  return user.stats.badgeLevels;
};

export const awardBadgeLevelPoints = (user, badgeId, newLevel, pointsPerLevel) => {
  if (!user || !badgeId) return 0;
  const badgeLevels = ensureBadgeLevels(user);
  const currentLevel = Number(badgeLevels[badgeId]) || 0;
  const safeNewLevel = Math.max(0, Number(newLevel) || 0);
  if (safeNewLevel <= currentLevel) {
    return 0;
  }
  badgeLevels[badgeId] = safeNewLevel;
  const delta = safeNewLevel - currentLevel;
  addRankPoints(user, delta * (pointsPerLevel || RANK_POINT_VALUES.badgeLevel));
  return delta;
};

export const updateLeveledBadgeProgress = (user, badgeId, currentValue, perLevel, maxLevel, pointsPerLevel) => {
  const safeValue = Math.max(0, Number(currentValue) || 0);
  const level = Math.min(Math.floor(safeValue / perLevel), maxLevel);
  return awardBadgeLevelPoints(user, badgeId, level, pointsPerLevel);
};
