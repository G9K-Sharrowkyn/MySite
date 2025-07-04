import React, { useEffect, useState } from 'react';
import api from './api';
import FightCard from './FightCard';
import './TournamentPage.css';

const TournamentPage = () => {
  const [fights, setFights] = useState([]);

  useEffect(() => {
    const fetchFights = async () => {
      try {
        const res = await api.get('/api/fights');
        // Grupujemy walki według kategorii, tak jak w mockData
        const groupedFights = res.data.reduce((acc, fight) => {
          const category = fight.category || 'Inne'; // Domyślna kategoria
          if (!acc[category]) {
            acc[category] = { category, fights: [] };
          }
          acc[category].fights.push(fight);
          return acc;
        }, {});
        setFights(Object.values(groupedFights));
      } catch (err) {
        console.error('Błąd podczas pobierania walk:', err);
      }
    };
    fetchFights();
  }, []);

  return (
    <div className="tournament-page">
      <h1>Dzisiejsza Gala</h1>
      {fights.length > 0 ? (
        fights.map((categoryData) => (
          <FightCard
            key={categoryData.category}
            category={categoryData.category}
            fights={categoryData.fights}
          />
        ))
      ) : (
        <p>Brak walk do wyświetlenia.</p>
      )}
    </div>
  );
};

export default TournamentPage;