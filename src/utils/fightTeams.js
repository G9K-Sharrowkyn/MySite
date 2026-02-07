export const splitFightTeamMembers = (value) => {
  const raw = String(value || '');
  if (!raw.trim()) return [];

  const out = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') {
      parenDepth += 1;
      current += ch;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
      continue;
    }

    // Team members are comma-separated, but commas can appear inside parentheses
    // (e.g. "Warhammer 40,000"). Split only when we are not inside parentheses.
    if (ch === ',' && parenDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) out.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) out.push(trimmed);
  return out;
};

