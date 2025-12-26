const buildTeamName = (team) => {
  if (!team) return '';
  const fighters = Array.isArray(team.fighters) ? team.fighters : [];
  if (fighters.length > 0) {
    return fighters
      .map((fighter) => fighter?.name || fighter?.characterName || fighter)
      .filter(Boolean)
      .join(', ');
  }
  const main = team.mainCharacter?.name || team.mainCharacter || '';
  const secondary = team.secondaryCharacter?.name || team.secondaryCharacter || '';
  return [main, secondary].filter(Boolean).join(', ');
};

const resolveFightLabel = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => entry?.name || entry?.characterName || entry)
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return value.name || value.characterName || '';
  }
  return value ? String(value) : '';
};

export const buildProfileFights = (db, userId) => {
  const fights = [];
  const seen = new Set();

  const addFight = (fight) => {
    if (!fight || !fight.id) return;
    if (seen.has(fight.id)) return;
    seen.add(fight.id);
    fights.push(fight);
  };

  (db.divisionFights || []).forEach((fight) => {
    if (fight.team1?.userId !== userId && fight.team2?.userId !== userId) {
      return;
    }

    const winner =
      fight.winnerId ||
      fight.result?.winnerId ||
      (fight.result?.winner === 'A'
        ? fight.team1?.userId
        : fight.result?.winner === 'B'
          ? fight.team2?.userId
          : null);

    addFight({
      id: fight.id || fight._id,
      fighter1: fight.teamA || fight.fight?.teamA || buildTeamName(fight.team1),
      fighter2: fight.teamB || fight.fight?.teamB || buildTeamName(fight.team2),
      winnerId: winner,
      createdAt: fight.createdAt || fight.updatedAt,
      status: fight.status || fight.fight?.status || 'active',
      source: 'division'
    });
  });

  (db.fights || []).forEach((fight) => {
    const participants = Array.isArray(fight.participants) ? fight.participants : [];
    const participantIds = participants
      .map((participant) => participant?.userId || participant?.id)
      .filter(Boolean);

    if (
      !participantIds.includes(userId) &&
      fight.userId !== userId &&
      fight.createdBy !== userId
    ) {
      return;
    }

    addFight({
      id: fight.id || fight._id,
      fighter1: resolveFightLabel(fight.fighter1 || fight.teamA),
      fighter2: resolveFightLabel(fight.fighter2 || fight.teamB),
      winnerId: fight.winnerId || fight.winner || fight.result?.winnerId || null,
      createdAt: fight.createdAt || fight.date,
      status: fight.status || 'active',
      source: 'fight'
    });
  });

  (db.posts || []).forEach((post) => {
    if (post.type !== 'fight' || post.authorId !== userId) {
      return;
    }

    addFight({
      id: post.id || post._id,
      fighter1: resolveFightLabel(post.fight?.teamA || post.teamA),
      fighter2: resolveFightLabel(post.fight?.teamB || post.teamB),
      winnerId: post.fight?.winnerId || post.fight?.winnerUserId || null,
      createdAt: post.createdAt,
      status: post.fight?.status || 'active',
      source: 'post'
    });
  });

  return fights.sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
};
