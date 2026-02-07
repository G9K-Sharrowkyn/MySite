export const formatCharacterDisplayName = (value) =>
  String(value || '')
    .replace(/\)\(/g, ') (')
    .replace(/\s+/g, ' ')
    .trim();

