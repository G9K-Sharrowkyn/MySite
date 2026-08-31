import { readFile } from 'node:fs/promises';

const BUILT_IN_CATALOG_URL = new URL('../scripts/characters.json', import.meta.url);

let builtInCatalogPromise;

const cleanText = (value) => String(value || '').trim();

export const normalizeCharacterKey = (value) =>
  cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US');

const normalizeCharacter = (character) => {
  const name = cleanText(character?.name);
  const id = cleanText(character?.id);
  if (!id || !name) return null;

  return {
    ...character,
    id,
    name,
    baseName: cleanText(character?.baseName) || name,
    universe: cleanText(character?.universe) || 'Other',
    image: cleanText(character?.image),
    tags: Array.isArray(character?.tags)
      ? character.tags.map(cleanText).filter(Boolean)
      : []
  };
};

export const loadBuiltInCharacterCatalog = async () => {
  if (!builtInCatalogPromise) {
    builtInCatalogPromise = readFile(BUILT_IN_CATALOG_URL, 'utf8')
      .then((contents) => JSON.parse(contents))
      .then((characters) => {
        if (!Array.isArray(characters)) {
          throw new TypeError('Built-in character catalog must be an array.');
        }
        return characters.map(normalizeCharacter).filter(Boolean);
      })
      .catch((error) => {
        builtInCatalogPromise = undefined;
        throw error;
      });
  }

  return builtInCatalogPromise;
};

const mergeCharacter = (builtIn, stored) => ({
  ...builtIn,
  ...stored,
  id: cleanText(stored?.id) || builtIn.id,
  name: cleanText(stored?.name) || builtIn.name,
  baseName: cleanText(stored?.baseName) || builtIn.baseName,
  universe: cleanText(stored?.universe) || builtIn.universe,
  image: cleanText(stored?.image) || builtIn.image,
  tags: Array.isArray(stored?.tags) ? stored.tags : builtIn.tags,
  images: {
    ...(builtIn.images || {}),
    ...(stored?.images || {})
  }
});

export const mergeCharacterCatalog = (builtIns = [], storedCharacters = []) => {
  const stored = Array.isArray(storedCharacters)
    ? storedCharacters.map(normalizeCharacter).filter(Boolean)
    : [];
  const byId = new Map(stored.map((character) => [character.id, character]));
  const byName = new Map(
    stored.map((character) => [normalizeCharacterKey(character.name), character])
  );
  const consumed = new Set();
  const catalog = [];

  for (const rawBuiltIn of Array.isArray(builtIns) ? builtIns : []) {
    const builtIn = normalizeCharacter(rawBuiltIn);
    if (!builtIn) continue;

    const match =
      byId.get(builtIn.id) || byName.get(normalizeCharacterKey(builtIn.name));
    if (match) consumed.add(match.id);

    if (String(match?.status || '').toLowerCase() === 'deleted') continue;
    catalog.push(match ? mergeCharacter(builtIn, match) : builtIn);
  }

  for (const character of stored) {
    if (consumed.has(character.id)) continue;
    if (String(character.status || 'active').toLowerCase() === 'deleted') continue;
    catalog.push(character);
  }

  const unique = new Map();
  for (const character of catalog) {
    const key = character.id || normalizeCharacterKey(character.name);
    if (!unique.has(key)) unique.set(key, character);
  }

  return [...unique.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', {
      numeric: true,
      sensitivity: 'base'
    })
  );
};

export const getMergedCharacterCatalog = async (storedCharacters = []) =>
  mergeCharacterCatalog(await loadBuiltInCharacterCatalog(), storedCharacters);

export const findBuiltInCharacter = async (id) => {
  const normalizedId = cleanText(id);
  if (!normalizedId) return null;
  const characters = await loadBuiltInCharacterCatalog();
  return characters.find((character) => character.id === normalizedId) || null;
};
