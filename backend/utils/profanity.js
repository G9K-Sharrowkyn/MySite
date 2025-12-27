const PROFANITY_WORDS = [
  'fuck',
  'fucking',
  'fucker',
  'motherfucker',
  'shit',
  'shitty',
  'bitch',
  'bastard',
  'asshole',
  'cunt',
  'dick',
  'dickhead',
  'pussy',
  'slut',
  'whore',
  'faggot',
  'nigger',
  'kurwa',
  'chuj',
  'pizda',
  'cipa',
  'cipka',
  'jebac',
  'jebany',
  'jebana',
  'pierdol',
  'pierdolic',
  'skurwysyn',
  'puta',
  'puto',
  'mierda',
  'cabron',
  'joder',
  'carajo',
  'pendejo',
  'merde',
  'putain',
  'salaud',
  'connard',
  'scheisse',
  'arschloch',
  'fick',
  'hurensohn',
  'cazzo',
  'merda',
  'puttana',
  'stronzo',
  'blyat',
  'suka',
  'hui'
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PROFANITY_REGEX = new RegExp(
  `\\b(${[...new Set(PROFANITY_WORDS)].map(escapeRegExp).join('|')})\\b`,
  'gi'
);

export const findProfanityMatches = (text) => {
  if (!text) return [];
  const matches = String(text).match(PROFANITY_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map((match) => match.toLowerCase()))];
};

export const hasProfanity = (text) => findProfanityMatches(text).length > 0;
