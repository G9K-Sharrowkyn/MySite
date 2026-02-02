import React, { useState, useEffect } from 'react';
import API from '../api';
import Card from '../components/Card';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, achievementsRes] = await Promise.all([
          API.get('/users/me'),
          API.get('/users/achievements')
        ]);
        setProfile(profileRes.data);
        setAchievements(achievementsRes.data);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };
    fetchData();
  }, []);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Ładowanie profilu...</div>
      </div>
    );
  }

  const getRankColor = (tier) => {
    switch (tier) {
      case 'Bronze':
        return 'text-amber-600';
      case 'Silver':
        return 'text-gray-400';
      case 'Gold':
        return 'text-yellow-400';
      case 'Platinum':
        return 'text-blue-400';
      case 'Diamond':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const xpProgress = ((profile.xp % 1000) / 1000) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 mb-6 border border-slate-600">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{profile.username}</h1>
              <p className="text-slate-400">{profile.email}</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div className="text-2xl font-bold text-yellow-400">Poziom {profile.level}</div>
              <div className="text-slate-400">XP: {profile.xp}</div>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-slate-400 mb-1">
              <span>Postęp do następnego poziomu</span>
              <span>{profile.xpToNextLevel} XP pozostało</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ranking */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h3 className="text-xl font-bold text-white mb-4">Ranking</h3>
            <div className="text-center">
              <div className={`text-3xl font-bold ${getRankColor(profile.rank.tier)} mb-2`}>
                {profile.rank.tier} {profile.rank.division}
              </div>
              <div className="text-slate-400">{profile.rank.points} punktów rankingowych</div>
            </div>
          </div>

          {/* Statystyki */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h3 className="text-xl font-bold text-white mb-4">Statystyki</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Gry rozegrane:</span>
                <span className="text-white font-bold">{profile.stats.gamesPlayed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wygrane:</span>
                <span className="text-green-400 font-bold">{profile.stats.gamesWon}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Przegrane:</span>
                <span className="text-red-400 font-bold">{profile.stats.gamesLost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Zagrane karty:</span>
                <span className="text-white font-bold">{profile.stats.cardsPlayed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jednostki rozmieszczone:</span>
                <span className="text-white font-bold">{profile.stats.unitsDeployed}</span>
              </div>
            </div>
          </div>

          {/* Zasoby */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
            <h3 className="text-xl font-bold text-white mb-4">Zasoby</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Złoto:</span>
                <span className="text-yellow-400 font-bold">{profile.currency?.gold ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Waluta premium:</span>
                <span className="text-cyan-400 font-bold">{profile.currency?.premium ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Paczki zwykłe:</span>
                <span className="text-yellow-300 font-bold">{profile.packs?.normal ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Paczki premium:</span>
                <span className="text-pink-300 font-bold">{profile.packs?.premium ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kawałki kart:</span>
                <span className="text-purple-400 font-bold">{profile.cardFragments}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Osiągnięcia */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 mt-6 border border-slate-600">
          <h3 className="text-xl font-bold text-white mb-4">Osiągnięcia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map(achievement => {
              const isUnlocked = profile.achievements.includes(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-green-900/30 to-green-800/30 border-green-600/50'
                      : 'bg-gradient-to-br from-slate-700/30 to-slate-600/30 border-slate-600/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-bold ${isUnlocked ? 'text-green-400' : 'text-slate-400'}`}>
                      {achievement.name}
                    </h4>
                    {isUnlocked && <span className="text-green-400">✅</span>}
                  </div>
                  <p className={`text-sm ${isUnlocked ? 'text-green-300' : 'text-slate-500'}`}>
                    {achievement.description}
                  </p>
                  <div className={`text-xs mt-2 ${isUnlocked ? 'text-green-400' : 'text-slate-500'}`}>
                    Nagroda: {achievement.reward.xp} XP, {achievement.reward.gold} złota
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolekcja */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 mt-6 border border-slate-600">
          <h3 className="text-xl font-bold text-white mb-4">
            Moja Kolekcja ({profile.collection?.length || 0} kart)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {(profile.collection || []).map((card) => (
              <div key={card.name} className="bg-slate-700/50 p-2 rounded-lg">
                <Card card={card} size="normal" showStats />
                <p className="text-center mt-2 text-xs text-slate-300">
                  {card.name.replace(/_/g, ' ')}
                </p>
              </div>
            ))}
          </div>
          {(!profile.collection || profile.collection.length === 0) && (
            <p className="text-slate-400 text-center py-8">
              Nie masz jeszcze żadnych kart. Idź do sklepu i kup paczki!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
