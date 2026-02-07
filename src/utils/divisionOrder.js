export const DIVISION_SEASON_ORDER = [
  'regular',
  'metahuman',
  'planetBusters',
  'godTier',
  'universalThreat',
  'star-wars',
  'dragon-ball',
  'marvel',
  'dc'
];

const DIVISION_ORDER_INDEX = new Map(
  DIVISION_SEASON_ORDER.map((id, index) => [id, index])
);

export const sortDivisionSeasons = (seasons = []) => {
  const list = Array.isArray(seasons) ? [...seasons] : [];
  return list.sort((a, b) => {
    const aId = a?.id;
    const bId = b?.id;
    const aIndex = DIVISION_ORDER_INDEX.has(aId)
      ? DIVISION_ORDER_INDEX.get(aId)
      : Number.MAX_SAFE_INTEGER;
    const bIndex = DIVISION_ORDER_INDEX.has(bId)
      ? DIVISION_ORDER_INDEX.get(bId)
      : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    const aLabel = String(a?.name || a?.id || '');
    const bLabel = String(b?.name || b?.id || '');
    return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
  });
};

