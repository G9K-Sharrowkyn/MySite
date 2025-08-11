export const getDivisions = async (req, res) => {
  const db = req.db;
  await db.read();
  res.json(db.data.divisions);
};

export const getDivisionStats = async (req, res) => {
  const db = req.db;
  await db.read();

  const divisions = Object.values(db.data.divisions);
  const stats = divisions.map(division => {
    const memberCount = division.members.length;
    const champion = division.champion ? db.data.users.find(u => u.id === division.champion) : null;

    const divisionFights = db.data.fights.filter(f => f.division === division.id);
    const totalVotes = divisionFights.reduce((sum, fight) => sum + (fight.votes ? fight.votes.total : 0), 0);
    const avgVotesPerFight = divisionFights.length > 0 ? totalVotes / divisionFights.length : 0;

    return {
      id: division.id,
      name: division.name,
      description: division.description,
      memberCount,
      champion: champion ? { username: champion.username } : null,
      avgVotesPerFight
    };
  });

  res.json(stats);
};
