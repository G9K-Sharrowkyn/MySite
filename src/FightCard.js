import React from 'react';
import FightRow from './FightRow';
import './FightCard.css';

const FightCard = ({ category, fights }) => {
  return (
    <div className="fight-card-category">
      <h2>{category}</h2>
      <div className="fights-list">
        {fights.map((fight) => (
          <FightRow key={fight.id} fight={fight} />
        ))}
      </div>
    </div>
  );
};

export default FightCard;
