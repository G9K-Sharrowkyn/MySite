const UNIVERSE_KEYWORDS = {
  DC: [
    'batman',
    'superman',
    'wonder woman',
    'flash',
    'green lantern',
    'aquaman',
    'cyborg',
    'joker',
    'lex luthor',
    'darkseid',
    'gotham',
    'metropolis',
    'krypton',
    'atlantis'
  ],
  Marvel: [
    'spider-man',
    'iron man',
    'captain america',
    'thor',
    'hulk',
    'black widow',
    'hawkeye',
    'doctor strange',
    'wolverine',
    'deadpool',
    'thanos',
    'loki',
    'avengers',
    'x-men',
    'wakanda',
    'asgard'
  ],
  'Dragon Ball': [
    'goku',
    'vegeta',
    'gohan',
    'piccolo',
    'frieza',
    'cell',
    'majin buu',
    'beerus',
    'whis',
    'saiyan',
    'namek',
    'kamehameha',
    'ki',
    'dragon balls'
  ],
  Naruto: [
    'naruto',
    'sasuke',
    'sakura',
    'kakashi',
    'itachi',
    'madara',
    'hashirama',
    'minato',
    'jiraiya',
    'orochimaru',
    'akatsuki',
    'sharingan',
    'byakugan',
    'rinnegan',
    'chakra',
    'jutsu',
    'konoha'
  ],
  'One Piece': [
    'luffy',
    'zoro',
    'sanji',
    'nami',
    'usopp',
    'chopper',
    'robin',
    'franky',
    'brook',
    'jinbe',
    'shanks',
    'whitebeard',
    'kaido',
    'big mom',
    'blackbeard',
    'devil fruit',
    'haki',
    'grand line'
  ],
  'Attack on Titan': [
    'eren',
    'mikasa',
    'armin',
    'levi',
    'erwin',
    'annie',
    'reiner',
    'bertholdt',
    'titan',
    'survey corps',
    'wall maria',
    'wall rose',
    'wall sina',
    'paradis'
  ],
  'Demon Slayer': [
    'tanjiro',
    'nezuko',
    'zenitsu',
    'inosuke',
    'giyu',
    'shinobu',
    'rengoku',
    'tengen',
    'muzan',
    'demon',
    'hashira',
    'breathing',
    'nichirin'
  ],
  JJK: [
    'yuji',
    'megumi',
    'nobara',
    'gojo',
    'sukuna',
    'nanami',
    'maki',
    'inumaki',
    'panda',
    'cursed spirit',
    'cursed technique',
    'domain expansion',
    'jujutsu'
  ],
  Bleach: [
    'ichigo',
    'rukia',
    'uryu',
    'chad',
    'orihime',
    'byakuya',
    'kenpachi',
    'toshiro',
    'aizen',
    'yamamoto',
    'hollow',
    'shinigami',
    'quincy',
    'zanpakuto',
    'bankai',
    'soul society'
  ],
  'One Punch Man': [
    'saitama',
    'genos',
    'king',
    'tatsumaki',
    'fubuki',
    'bang',
    'atomic samurai',
    'child emperor',
    'metal knight',
    'zombieman',
    'hero association',
    'monster association'
  ],
  'My Hero Academia': [
    'deku',
    'bakugo',
    'todoroki',
    'uraraka',
    'iida',
    'all might',
    'endeavor',
    'aizawa',
    'shigaraki',
    'dabi',
    'toga',
    'quirk',
    'one for all',
    'all for one',
    'ua',
    'hero',
    'villain'
  ]
};

const POWER_TIER_KEYWORDS = {
  'Regular People': ['human', 'normal', 'civilian', 'regular', 'ordinary', 'mortal'],
  Metahuman: ['superhuman', 'enhanced', 'mutant', 'powered', 'ability', 'meta'],
  'Planet Busters': ['planetary', 'world destroyer', 'planet level', 'continental', 'surface wiper'],
  'God Tier': ['god', 'deity', 'divine', 'celestial', 'cosmic', 'universal'],
  'Universal Threat': ['universal', 'multiverse', 'reality warper', 'dimension', 'omniversal'],
  Omnipotent: ['omnipotent', 'all powerful', 'supreme', 'absolute', 'infinite power']
};

const CATEGORY_KEYWORDS = {
  Hero: ['hero', 'good guy', 'protector', 'savior', 'champion', 'defender'],
  Villain: ['villain', 'bad guy', 'evil', 'antagonist', 'enemy', 'destroyer'],
  'Anti-Hero': ['anti-hero', 'antihero', 'morally gray', 'complex', 'vigilante'],
  Neutral: ['neutral', 'balanced', 'neither', 'independent', 'unaligned']
};

const normalizeText = (value) => String(value || '').toLowerCase();

const addUnique = (list, value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed || list.includes(trimmed)) {
    return;
  }
  list.push(trimmed);
};

const collectNames = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (value.name) {
    return [value.name];
  }
  return [];
};

const matchCharacter = (characters, targetName) => {
  const target = normalizeText(targetName);
  if (!target) return null;
  return characters.find((character) => {
    const names = [character.name, ...(character.aliases || [])]
      .filter(Boolean)
      .map((name) => normalizeText(name));
    return names.includes(target);
  });
};

const addCharacterTags = (tags, character) => {
  if (!character) return;
  addUnique(tags.characters, character.name);
  if (character.universe) {
    addUnique(tags.universes, character.universe);
  }
  if (character.powerTier) {
    addUnique(tags.powerTiers, character.powerTier);
  }
  if (character.category) {
    addUnique(tags.categories, character.category);
  }
};

export const autoTagPost = (db = {}, postData = {}) => {
  const tags = {
    universes: [],
    characters: [],
    powerTiers: [],
    categories: []
  };

  const characters = Array.isArray(db.characters) ? db.characters : [];
  const content = normalizeText(`${postData.title || ''} ${postData.content || ''}`);

  const fightNames = [
    ...collectNames(postData.teamA),
    ...collectNames(postData.teamB)
  ];

  if (postData.fight) {
    fightNames.push(...collectNames(postData.fight.teamA));
    fightNames.push(...collectNames(postData.fight.teamB));
    fightNames.push(...collectNames(postData.fight.fighter1));
    fightNames.push(...collectNames(postData.fight.fighter2));
  }

  fightNames.forEach((name) => {
    const match = matchCharacter(characters, name);
    if (match) {
      addCharacterTags(tags, match);
    } else {
      addUnique(tags.characters, name);
    }
  });

  if (fightNames.length === 0 && content) {
    characters.forEach((character) => {
      const names = [character.name, ...(character.aliases || [])].filter(Boolean);
      if (
        names.some((name) => content.includes(normalizeText(name)))
      ) {
        addCharacterTags(tags, character);
      }
    });
  }

  Object.entries(UNIVERSE_KEYWORDS).forEach(([universe, keywords]) => {
    if (keywords.some((keyword) => content.includes(keyword))) {
      addUnique(tags.universes, universe);
    }
  });

  Object.entries(POWER_TIER_KEYWORDS).forEach(([tier, keywords]) => {
    if (keywords.some((keyword) => content.includes(keyword))) {
      addUnique(tags.powerTiers, tier);
    }
  });

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    if (keywords.some((keyword) => content.includes(keyword))) {
      addUnique(tags.categories, category);
    }
  });

  const combined = [
    ...tags.universes,
    ...tags.characters,
    ...tags.powerTiers,
    ...tags.categories
  ];

  return {
    tags: [...new Set(combined)],
    autoTags: tags
  };
};

export const getBaseTags = () => [
  { name: 'DC', category: 'universe', color: '#0078d4' },
  { name: 'Marvel', category: 'universe', color: '#ed1d24' },
  { name: 'Dragon Ball', category: 'universe', color: '#ff8c00' },
  { name: 'Naruto', category: 'universe', color: '#ff6b35' },
  { name: 'One Piece', category: 'universe', color: '#1e90ff' },
  { name: 'Attack on Titan', category: 'universe', color: '#8b4513' },
  { name: 'Demon Slayer', category: 'universe', color: '#800080' },
  { name: 'JJK', category: 'universe', color: '#000080' },
  { name: 'Bleach', category: 'universe', color: '#ff4500' },
  { name: 'One Punch Man', category: 'universe', color: '#ffd700' },
  { name: 'My Hero Academia', category: 'universe', color: '#32cd32' },
  { name: 'Regular People', category: 'power_tier', color: '#6c757d' },
  { name: 'Metahuman', category: 'power_tier', color: '#17a2b8' },
  { name: 'Planet Busters', category: 'power_tier', color: '#ffc107' },
  { name: 'God Tier', category: 'power_tier', color: '#dc3545' },
  { name: 'Universal Threat', category: 'power_tier', color: '#6f42c1' },
  { name: 'Omnipotent', category: 'power_tier', color: '#000000' },
  { name: 'Hero', category: 'genre', color: '#28a745' },
  { name: 'Villain', category: 'genre', color: '#dc3545' },
  { name: 'Anti-Hero', category: 'genre', color: '#6c757d' },
  { name: 'Neutral', category: 'genre', color: '#17a2b8' }
];
