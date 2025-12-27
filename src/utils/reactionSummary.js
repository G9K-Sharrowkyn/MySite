export const buildReactionSummary = (reactions = []) => {
  const reactionCounts = {};
  (reactions || []).forEach((reaction) => {
    const icon = reaction?.reactionIcon || reaction?.icon;
    const name = reaction?.reactionName || reaction?.name || '';
    if (!icon) return;
    const key = `${icon}-${name}`;
    reactionCounts[key] = (reactionCounts[key] || 0) + 1;
  });

  return Object.entries(reactionCounts).map(([key, count]) => {
    const separatorIndex = key.indexOf('-');
    const icon = separatorIndex >= 0 ? key.slice(0, separatorIndex) : key;
    const name = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : '';
    return { icon, name, count };
  });
};

export const normalizeReactionSummary = (reactions = []) => {
  if (!Array.isArray(reactions) || reactions.length === 0) return [];
  const isSummary = reactions.every(
    (reaction) => typeof reaction?.count === 'number'
  );
  if (isSummary) return reactions;
  return buildReactionSummary(reactions);
};
