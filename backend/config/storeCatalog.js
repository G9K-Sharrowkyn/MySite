const STORE_ITEMS = [
  ['title_1', 'titles', 500],
  ['title_2', 'titles', 750],
  ['title_3', 'titles', 300],
  ['title_4', 'titles', 400],
  ['title_5', 'titles', 600],
  ['color_gold', 'nameColors', 200],
  ['color_purple', 'nameColors', 150],
  ['color_red', 'nameColors', 150],
  ['color_blue', 'nameColors', 150],
  ['color_green', 'nameColors', 150],
  ['color_rainbow', 'nameColors', 500],
  ['contender_1', 'contenderChances', 800],
  ['exhibition_match', 'contenderChances', 300],
  ['call_out', 'contenderChances', 200],
  ['grudge_match', 'contenderChances', 400],
  ['custom_bg', 'profileUpgrades', 250],
  ['animated_avatar', 'profileUpgrades', 300],
  ['profile_theme', 'profileUpgrades', 400],
  ['victory_sound', 'profileUpgrades', 350],
  ['double_odds', 'betBoosts', 100],
  ['insurance', 'betBoosts', 150],
  ['parlay_boost', 'betBoosts', 200],
  ['early_access', 'betBoosts', 300]
].map(([id, category, cost]) => Object.freeze({ id, category, cost }));

export const getStoreItem = (itemId, category) =>
  STORE_ITEMS.find(
    (item) => item.id === itemId && (!category || item.category === category)
  ) || null;

export default STORE_ITEMS;
