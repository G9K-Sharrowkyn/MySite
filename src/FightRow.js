import React from 'react';
import './FightRow.css';

const FightRow = ({ fight }) => {
  return (
    <div className="fight-row">
      <div className="fighter-block user1-block">
        <div className="user-info">{fight.user1}</div>
        <div className="fighter-name">{fight.fighter1}</div>
        <div className="record">Rekord: {fight.user1Record} (Ogólny: {fight.overallRecord1})</div>
        <div className="fighter-image placeholder"></div>
      </div>
      <div className="vs-text">VS</div>
      <div className="fighter-block user2-block">
        <div className="user-info">{fight.user2}</div>
        <div className="fighter-name">{fight.fighter2}</div>
        <div className="record">Rekord: {fight.user2Record} (Ogólny: {fight.overallRecord2})</div>
        <div className="fighter-image placeholder"></div>
      </div>
    </div>
  );
};

export default FightRow;
