import React from 'react';
import './HoloCard.css';

const HoloCard = ({ children, active }) => (
  <div className={`holo-card${active ? ' active' : ''}`}>
    {children}
    <div className="holo-overlay" />
  </div>
);

export default HoloCard; 