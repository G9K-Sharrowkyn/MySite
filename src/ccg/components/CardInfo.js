import React, { useState, useRef, useEffect } from 'react';
import BoosterAnimation from './BoosterAnimation';
import '../assets/css/BoosterPack.css';
import BoosterPack from '../assets/cards/BoosterPack.png';

const CardInfo = ({ onDeckCreated }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [boosterPacks, setBoosterPacks] = useState(10);
  const [showBoosterPack, setShowBoosterPack] = useState(false);
  const [revealedCards, setRevealedCards] = useState([]);
  const [particlesVisible, setParticlesVisible] = useState(false);
  const particleCanvasRef = useRef(null);

  const cardsContext = require.context('../assets/cards', false, /\.png$/);
  const cards = cardsContext.keys().filter(f => f !== './BoosterPack.png').map(f => {
    const cardName = f.replace('./', '').replace('.png', '');
    return { name: cardName, imageUrl: cardsContext(f) };
  });

  useEffect(() => {
    onDeckCreated([...cards]);
  }, []);

  const openBooster = () => {
    if (boosterPacks <= 0) return;
    setShowBoosterPack(true);
    setRevealedCards([]);
  };

  const handleBoosterPackClick = (e) => {
    setBoosterPacks(p => p - 1);
    setIsAnimating(true);
    if (particleCanvasRef.current) {
      particleCanvasRef.current.triggerExplosion(e.clientX, e.clientY);
      setParticlesVisible(true);
      setTimeout(() => setParticlesVisible(false), 1000);
    }
    const randomCards = [];
    for (let i = 0; i < 5; i++) {
      randomCards.push(cards[Math.floor(Math.random()*cards.length)]);
    }
    setTimeout(() => {
      setRevealedCards(randomCards);
      setShowBoosterPack(false);
      setIsAnimating(false);
    }, 1000);
  };

  const addBoosterPack = () => setBoosterPacks(p => p + 1);

  return (
    <div>
      <button className="text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2" onClick={openBooster}>
        Otwórz Booster ({boosterPacks})
      </button>
      <button className="text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2" onClick={addBoosterPack}>
        Dodaj Booster
      </button>

      {showBoosterPack && (
        <div className="booster-pack flex justify-center items-center">
          <img
            src={BoosterPack}
            alt="Booster Pack"
            className={`w-64 h-auto cursor-pointer ${isAnimating ? 'animate-spinAndShrink' : ''}`}
            onClick={handleBoosterPackClick}
          />
          {particlesVisible && <BoosterAnimation ref={particleCanvasRef} visible={particlesVisible} />}
        </div>
      )}

      <div className="revealed-cards flex justify-center flex-wrap gap-4 mt-4">
        {revealedCards.map((card, idx) => (
          <div key={idx} className="card bg-white shadow-lg rounded overflow-hidden">
            <img src={card.imageUrl} alt={card.name} className="w-48 h-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardInfo;
