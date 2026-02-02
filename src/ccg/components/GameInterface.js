import React, { useState, useEffect } from 'react';
import socket from '../utils/socket';
import cardsSpecifics from '../mechanics/CardsSpecifics';
import GameMechanics, { Phases } from '../mechanics/GameMechanics';
import Card from './Card';
import '../assets/css/CardGame.css';

const drawCards = (deckArr, count) => {
  const newHand = [];
  let newDeck = [...deckArr];
  for (let i = 0; i < count && newDeck.length; i++) {
    const idx = Math.floor(Math.random() * newDeck.length);
    newHand.push(newDeck.splice(idx, 1)[0]);
  }
  return { hand: newHand, deck: newDeck };
};

const GameInterface = ({ user, roomId, initialDeck }) => {
  const [deck, setDeck] = useState(initialDeck);
  const [hand, setHand] = useState([]);
  const [playerUnits, setPlayerUnits] = useState([]);
  const [playerCommands, setPlayerCommands] = useState([]);
  const [opponentUnits, setOpponentUnits] = useState([]);
  const [opponentCommands, setOpponentCommands] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [gameMechanics] = useState(new GameMechanics());
  const [currentPhase, setCurrentPhase] = useState(gameMechanics.getCurrentPhase());
  const [playerHP] = useState(20);
  const [opponentHP] = useState(20);
  const [commandPoints, setCommandPoints] = useState(0);
  const [hasPlayedCommandCard, setHasPlayedCommandCard] = useState(false);
  const [hasDrawnCard, setHasDrawnCard] = useState(false);
  const [shouldAnimateButton, setShouldAnimateButton] = useState(false);
  const [cardAnimations, setCardAnimations] = useState({});
  const [draggedCard, setDraggedCard] = useState(null);
  const [dropZoneActive, setDropZoneActive] = useState('');

  useEffect(() => {
    const startingDeck = Array.isArray(initialDeck) ? initialDeck : [];
    const initialHand = drawCards(startingDeck, 7);
    setHand(initialHand.hand);
    setDeck(initialHand.deck);
    
    // Add some sample opponent cards for demo purposes
    if (startingDeck.length > 0) {
      const sampleOpponentUnits = startingDeck.slice(0, 2);
      const sampleOpponentCommands = startingDeck.slice(2, 4);
      setOpponentUnits(sampleOpponentUnits);
      setOpponentCommands(sampleOpponentCommands);
    }
    
    socket.on('opponentMove', (move) => {
      // obsługa ruchu przeciwnika
    });
    return () => { socket.off('opponentMove'); };
  }, [initialDeck]);

  useEffect(() => {
    if (currentPhase === Phases.COMMAND) {
      setHasPlayedCommandCard(false);
      setHasDrawnCard(false);
      setCommandPoints(playerCommands.reduce((sum, c) => {
        const d = cardsSpecifics.find(x => x.name === c.name);
        return sum + (d.type.includes('Shipyard') ? 2 : 1);
      }, 0));
    }
  }, [currentPhase, playerCommands]);

  const drawCard = () => {
    if (currentPhase !== Phases.COMMAND || hasDrawnCard || deck.length === 0) return;
    const { hand: newCards, deck: newDeck } = drawCards(deck, 1);
    
    // Animuj nową kartę
    if (newCards.length > 0) {
      const cardKey = `${newCards[0].name}_${Date.now()}`;
      setCardAnimations(prev => ({ ...prev, [cardKey]: 'draw' }));
      setTimeout(() => {
        setCardAnimations(prev => {
          const updated = { ...prev };
          delete updated[cardKey];
          return updated;
        });
      }, 600);
    }
    
    setHand([...hand, ...newCards]);
    setDeck(newDeck);
    setHasDrawnCard(true);
  };

  const endPhase = () => {
    gameMechanics.endCurrentPhase();
    const next = gameMechanics.getCurrentPhase();
    setCurrentPhase(next);
    setShouldAnimateButton(false);
    socket.emit('playMove', { roomId, move: { phaseEnded: next, player: user.id } });
  };

  const selectCard = (card) => {
    if (selectedCard === card) setSelectedCard(null);
    else setSelectedCard(card);
  };

  const deploy = (zone) => {
    if (!selectedCard) return;
    const details = cardsSpecifics.find(c => c.name === selectedCard.name);
    if (gameMechanics.getCurrentPhase() === Phases.COMMAND && zone === 'command-zone') {
      if (hasPlayedCommandCard) return;
      setPlayerCommands([...playerCommands, selectedCard]);
      setCommandPoints(p => p + (details.type.includes('Shipyard') ? 2 : 1));
      setHand(hand.filter(c => c !== selectedCard));
      setSelectedCard(null);
      setHasPlayedCommandCard(true);
      setShouldAnimateButton(true);
      socket.emit('playMove', { roomId, move: { playedCommand: selectedCard, player: user.id } });
    } else if (gameMechanics.getCurrentPhase() === Phases.DEPLOYMENT && zone === 'unit-zone') {
      if (details.commandCost > commandPoints) return;
      setPlayerUnits([...playerUnits, selectedCard]);
      setCommandPoints(p => p - details.commandCost);
      setHand(hand.filter(c => c !== selectedCard));
      setSelectedCard(null);
      socket.emit('playMove', { roomId, move: { playedUnit: selectedCard, player: user.id } });
    }
  };

  // Funkcje drag and drop
  const handleCardDragStart = (card, e) => {
    setDraggedCard(card);
  };

  const handleCardDragEnd = (card, e) => {
    setDraggedCard(null);
    setDropZoneActive('');
  };

  const handleDragOver = (e, zone) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZoneActive(zone);
  };

  const handleDragLeave = (e) => {
    setDropZoneActive('');
  };

  const handleDrop = (e, zone) => {
    e.preventDefault();
    setDropZoneActive('');
    
    if (!draggedCard) return;
    
    const details = cardsSpecifics.find(c => c.name === draggedCard.name);
    
    if (zone === 'command-zone' && gameMechanics.getCurrentPhase() === Phases.COMMAND) {
      if (hasPlayedCommandCard) return;
      
      // Animuj kartę
      const cardKey = `${draggedCard.name}_${Date.now()}`;
      setCardAnimations(prev => ({ ...prev, [cardKey]: 'deploy' }));
      
      setPlayerCommands([...playerCommands, draggedCard]);
      setCommandPoints(p => p + (details.type.includes('Shipyard') ? 2 : 1));
      setHand(hand.filter(c => c !== draggedCard));
      setSelectedCard(null);
      setHasPlayedCommandCard(true);
      setShouldAnimateButton(true);
      socket.emit('playMove', { roomId, move: { playedCommand: draggedCard, player: user.id } });
      
    } else if (zone === 'unit-zone' && gameMechanics.getCurrentPhase() === Phases.DEPLOYMENT) {
      if (details.commandCost > commandPoints) return;
      
      // Animuj kartę
      const cardKey = `${draggedCard.name}_${Date.now()}`;
      setCardAnimations(prev => ({ ...prev, [cardKey]: 'deploy' }));
      
      setPlayerUnits([...playerUnits, draggedCard]);
      setCommandPoints(p => p - details.commandCost);
      setHand(hand.filter(c => c !== draggedCard));
      setSelectedCard(null);
      socket.emit('playMove', { roomId, move: { playedUnit: draggedCard, player: user.id } });
    }
    
    setDraggedCard(null);
  };

  const getDropZoneClass = (zone) => {
    const baseClass = 'drop-zone';
    if (dropZoneActive === zone) {
      if (!draggedCard) return `${baseClass} active`;
      
      const details = cardsSpecifics.find(c => c.name === draggedCard.name);
      
      if (zone === 'command-zone' && gameMechanics.getCurrentPhase() === Phases.COMMAND && !hasPlayedCommandCard) {
        return `${baseClass} active valid`;
      } else if (zone === 'unit-zone' && gameMechanics.getCurrentPhase() === Phases.DEPLOYMENT && details.commandCost <= commandPoints) {
        return `${baseClass} active valid`;
      } else {
        return `${baseClass} active invalid`;
      }
    }
    return baseClass;
  };



  return (
    <div className="cosmic-game-board h-screen flex flex-col overflow-hidden relative">
      {/* Efekty tła kosmicznego */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/6 w-1 h-1 bg-cyan-400 rounded-full pulse-glow"></div>
        <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-purple-400 rounded-full pulse-glow" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 left-3/4 w-1 h-1 bg-pink-400 rounded-full pulse-glow" style={{animationDelay: '4s'}}></div>
      </div>

      {/* Top Command Console - Opponent Status */}
      <div className="scifi-panel m-2 p-4 tech-corners">
        <div className="flex justify-between items-center">
          {/* Opponent Status */}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center pulse-glow">
              <span className="text-white font-bold text-xl">👾</span>
            </div>
            <div>
              <div className="text-red-400 font-mono text-lg font-bold">
                ENEMY COMMANDER
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-red-300 font-mono text-sm">
                  HULL: <span className="text-red-400 font-bold">{opponentHP}</span>
                </div>
                <div className="text-gray-400 font-mono text-sm">
                  FLEET: {deck.length}
                </div>
              </div>
            </div>
          </div>
          
          {/* Phase Indicator */}
          <div className="modular-frame px-6 py-3 text-center">
            <div className="text-yellow-400 font-mono text-xl font-bold flicker-effect">
              {currentPhase}
            </div>
            <div className="text-cyan-400 font-mono text-xs">
              [CURRENT PHASE]
            </div>
          </div>
          
          {/* Phase Control */}
          <button 
            className={`scifi-button ${shouldAnimateButton ? 'pulse-glow' : ''} text-lg px-6 py-3`}
            onClick={endPhase}
          >
            {currentPhase === Phases.BATTLE ? 'END TURN' : 'NEXT PHASE'}
          </button>
        </div>
      </div>

      {/* Main Battle Grid */}
      <div className="flex-1 flex flex-col relative p-2">
        {/* Enemy Combat Zones */}
        <div className="flex-1 space-y-3">
          {/* Enemy Command Zone */}
          <div className="game-zone h-24 relative energy-border" style={{borderColor: 'var(--neon-pink)'}}>
            <div className="absolute top-2 left-4 text-pink-400 font-mono text-sm font-bold">
              [ENEMY COMMAND DECK]
            </div>
            <div className="flex items-center justify-center h-full space-x-2 pt-6">
              {opponentCommands.map((card, idx) => (
                <div key={idx} className="holographic-card">
                  <Card card={card} size="small" showStats />
                </div>
              ))}
              {opponentCommands.length === 0 && (
                <div className="text-pink-400/50 font-mono text-sm italic">
                  [NO COMMAND SHIPS DEPLOYED]
                </div>
              )}
            </div>
            <div className="scan-lines"></div>
          </div>
          
          {/* Enemy Unit Zone */}
          <div className="game-zone flex-1 relative energy-border min-h-32" style={{borderColor: 'var(--neon-pink)'}}>
            <div className="absolute top-2 left-4 text-pink-400 font-mono text-sm font-bold">
              [ENEMY BATTLE FLEET]
            </div>
            <div className="flex items-center justify-center h-full space-x-2 pt-8">
              {opponentUnits.map((card, idx) => (
                <div key={idx} className="holographic-card">
                  <Card card={card} size="normal" showStats />
                </div>
              ))}
              {opponentUnits.length === 0 && (
                <div className="text-pink-400/50 font-mono text-lg italic">
                  [NO BATTLE SHIPS DETECTED]
                </div>
              )}
            </div>
            <div className="data-stream"></div>
          </div>
        </div>

        {/* Battle Line Separator */}
        <div className="h-2 relative my-2">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-60"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-40 animate-pulse"></div>
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-yellow-400 font-mono text-xs">
            [COMBAT ZONE]
          </div>
        </div>

        {/* Player Combat Zones */}
        <div className="flex-1 space-y-3">
          {/* Player Unit Zone */}
          <div 
            className={`game-zone flex-1 relative energy-border min-h-32 cursor-pointer transition-all duration-300 ${getDropZoneClass('unit-zone')}`}
            style={{borderColor: 'var(--neon-cyan)'}}
            onClick={() => deploy('unit-zone')}
            onDragOver={(e) => handleDragOver(e, 'unit-zone')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'unit-zone')}
          >
            <div className="absolute top-2 left-4 text-cyan-400 font-mono text-sm font-bold">
              [YOUR BATTLE FLEET]
            </div>
            <div className="flex items-center justify-center h-full space-x-2 pt-8">
              {playerUnits.map((card, idx) => (
                <div key={idx} className="holographic-card">
                  <Card 
                    card={card} 
                    size="normal" 
                    showStats 
                    isSelected={selectedCard === card}
                    onClick={() => selectCard(card)}
                    animationState={cardAnimations[`${card.name}_${idx}`]}
                  />
                </div>
              ))}
              {playerUnits.length === 0 && (
                <div className="text-cyan-400/50 font-mono text-lg italic">
                  [DEPLOY BATTLE SHIPS HERE]
                </div>
              )}
            </div>
            <div className="data-stream"></div>
          </div>
          
          {/* Player Command Zone */}
          <div 
            className={`game-zone h-24 relative energy-border cursor-pointer transition-all duration-300 ${getDropZoneClass('command-zone')}`}
            style={{borderColor: 'var(--neon-cyan)'}}
            onClick={() => deploy('command-zone')}
            onDragOver={(e) => handleDragOver(e, 'command-zone')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'command-zone')}
          >
            <div className="absolute top-2 left-4 text-cyan-400 font-mono text-sm font-bold">
              [YOUR COMMAND DECK]
            </div>
            <div className="flex items-center justify-center h-full space-x-2 pt-6">
              {playerCommands.map((card, idx) => (
                <div key={idx} className="holographic-card">
                  <Card 
                    card={card} 
                    size="small" 
                    showStats
                    isSelected={selectedCard === card}
                    onClick={() => selectCard(card)}
                    animationState={cardAnimations[`${card.name}_${idx}`]}
                  />
                </div>
              ))}
              {playerCommands.length === 0 && (
                <div className="text-cyan-400/50 font-mono text-sm italic">
                  [DEPLOY COMMAND SHIPS HERE]
                </div>
              )}
            </div>
            <div className="scan-lines"></div>
          </div>
        </div>
      </div>

      {/* Bottom Command Console - Player Status & Fleet */}
      <div className="scifi-panel m-2 p-4 tech-corners">
        {/* Player Status Bar */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-cyan-400/30">
          <div className="flex items-center space-x-6">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center pulse-glow">
              <span className="text-black font-bold text-xl">👤</span>
            </div>
            <div>
              <div className="text-cyan-400 font-mono text-lg font-bold">
                COMMANDER {user.username.toUpperCase()}
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-green-400 font-mono text-sm">
                  HULL: <span className="text-green-300 font-bold">{playerHP}</span>
                </div>
                <div className="text-blue-400 font-mono text-sm">
                  ENERGY: <span className="text-blue-300 font-bold">{commandPoints}</span>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            className={`scifi-button green ${currentPhase === Phases.COMMAND && !hasDrawnCard ? 'pulse-glow' : ''} px-4 py-2`}
            onClick={drawCard}
            disabled={currentPhase !== Phases.COMMAND || hasDrawnCard || deck.length === 0}
          >
            DRAW CARD ({deck.length})
          </button>
        </div>
        
        {/* Fleet Hand */}
        <div className="relative">
          <div className="text-center mb-3">
            <div className="text-cyan-400 font-mono text-sm font-bold">
              [FLEET COMMAND INTERFACE]
            </div>
          </div>
          <div className="flex justify-center space-x-3 overflow-x-auto pb-2 hand-container">
            {hand.map((card, idx) => (
              <div key={idx} className="holographic-card">
                <Card 
                  card={card} 
                  size="large" 
                  showStats 
                  isSelected={selectedCard === card}
                  onClick={() => selectCard(card)}
                  draggable={true}
                  onDragStart={handleCardDragStart}
                  onDragEnd={handleCardDragEnd}
                  animationState={cardAnimations[`${card.name}_${idx}`]}
                />
              </div>
            ))}
            {hand.length === 0 && (
              <div className="text-cyan-400/50 font-mono text-lg italic py-8">
                [NO SHIPS IN COMMAND QUEUE]
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Scan Effect */}
      <div className="scan-lines"></div>
    </div>
  );
};

export default GameInterface;
