import React, { useState, useEffect } from 'react';
import { getOptimizedImageProps } from '../utils/placeholderImage';
import { useLanguage } from '../i18n/LanguageContext';
import './BattleEngine.css';

const BattleEngine = ({ character1, character2, onBattleEnd }) => {
  const [battleState, setBattleState] = useState('preparing'); // preparing, fighting, finished
  const [fighter1, setFighter1] = useState(null);
  const [fighter2, setFighter2] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [winner, setWinner] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (character1 && character2) {
      initializeBattle();
    }
  }, [character1, character2]);

  const initializeBattle = () => {
    // Enhanced character stats based on universe and power level
    const enhancedChar1 = enhanceCharacter(character1);
    const enhancedChar2 = enhanceCharacter(character2);
    
    setFighter1(enhancedChar1);
    setFighter2(enhancedChar2);
    
    addToBattleLog(`🔥 Battle begins: ${character1.name} vs ${character2.name}!`);
    addToBattleLog(`⚡ ${character1.name} enters with ${enhancedChar1.powerLevel} power!`);
    addToBattleLog(`⚡ ${character2.name} enters with ${enhancedChar2.powerLevel} power!`);
    
    setBattleState('fighting');
    
    // Start battle simulation
    setTimeout(() => simulateBattle(enhancedChar1, enhancedChar2), 2000);
  };

  const enhanceCharacter = (character) => {
    // Base stats calculation based on universe and character type
    const universePowerMultipliers = {
      'Dragon Ball': 2.5,
      'Marvel': 2.0,
      'DC': 2.0,
      'Naruto': 1.8,
      'One Piece': 1.7,
      'Bleach': 1.6,
      'Pokemon': 1.4,
      'Star Wars': 1.5,
      'Anime': 1.6,
      'Gaming': 1.3
    };

    const basePower = Math.floor(Math.random() * 1000) + 500;
    const universeMultiplier = universePowerMultipliers[character.universe] || 1.0;
    const powerLevel = Math.floor(basePower * universeMultiplier);

    return {
      ...character,
      hp: powerLevel,
      maxHp: powerLevel,
      powerLevel,
      attack: Math.floor(powerLevel * 0.3),
      defense: Math.floor(powerLevel * 0.2),
      speed: Math.floor(powerLevel * 0.25),
      abilities: generateAbilities(character),
      statusEffects: [],
      energy: 100
    };
  };

  const generateAbilities = (character) => {
    const abilityPool = {
      'Dragon Ball': [
        { name: 'Kamehameha', damage: 1.5, cost: 30, description: 'Devastating energy wave' },
        { name: 'Spirit Bomb', damage: 2.0, cost: 50, description: 'Energy from all living things' },
        { name: 'Instant Transmission', effect: 'dodge', cost: 20, description: 'Teleport to avoid damage' }
      ],
      'Marvel': [
        { name: 'Web Swing', damage: 1.2, cost: 15, description: 'Agile web-based attack' },
        { name: 'Repulsor Ray', damage: 1.4, cost: 25, description: 'High-tech energy beam' },
        { name: 'Healing Factor', effect: 'heal', cost: 30, description: 'Regenerate health' }
      ],
      'DC': [
        { name: 'Heat Vision', damage: 1.3, cost: 20, description: 'Laser beam from eyes' },
        { name: 'Speed Force', effect: 'speed', cost: 25, description: 'Increase speed dramatically' },
        { name: 'Batarang Combo', damage: 1.1, cost: 10, description: 'Precise thrown weapons' }
      ],
      'default': [
        { name: 'Power Strike', damage: 1.3, cost: 20, description: 'Enhanced physical attack' },
        { name: 'Energy Blast', damage: 1.4, cost: 25, description: 'Concentrated energy attack' },
        { name: 'Defensive Stance', effect: 'defense', cost: 15, description: 'Increase defense' }
      ]
    };

    const abilities = abilityPool[character.universe] || abilityPool['default'];
    return abilities.slice(0, 3); // Each character gets 3 abilities
  };

  const addToBattleLog = (message) => {
    setBattleLog(prev => [...prev, { message, turn: currentTurn, timestamp: Date.now() }]);
  };

  const simulateBattle = async (f1, f2) => {
    let attacker = f1;
    let defender = f2;
    let turn = 1;

    while (f1.hp > 0 && f2.hp > 0 && turn < 20) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Determine action (basic attack, ability, or special move)
      const action = determineAction(attacker);
      const damage = calculateDamage(attacker, defender, action);
      
      // Apply damage and effects
      if (action.effect === 'dodge' && Math.random() < 0.3) {
        addToBattleLog(`💨 ${attacker.name} uses ${action.name} and dodges the attack!`);
      } else if (action.effect === 'heal') {
        const healAmount = Math.floor(attacker.maxHp * 0.2);
        attacker.hp = Math.min(attacker.hp + healAmount, attacker.maxHp);
        addToBattleLog(`💚 ${attacker.name} uses ${action.name} and heals for ${healAmount} HP!`);
      } else {
        defender.hp = Math.max(0, defender.hp - damage);
        addToBattleLog(`💥 ${attacker.name} uses ${action.name} and deals ${damage} damage to ${defender.name}!`);
        
        if (defender.hp <= 0) {
          addToBattleLog(`🏆 ${attacker.name} wins the battle!`);
          setWinner(attacker);
          break;
        }
      }

      // Update states
      setFighter1({...f1});
      setFighter2({...f2});
      
      // Switch turns
      [attacker, defender] = [defender, attacker];
      turn++;
      setCurrentTurn(turn);
    }

    if (turn >= 20) {
      const winner = f1.hp > f2.hp ? f1 : f2;
      addToBattleLog(`⏰ Battle reaches time limit! ${winner.name} wins by health advantage!`);
      setWinner(winner);
    }

    setBattleState('finished');
    if (onBattleEnd) {
      onBattleEnd(winner);
    }
  };

  const determineAction = (fighter) => {
    if (fighter.energy >= 30 && Math.random() < 0.4) {
      // Use special ability
      const availableAbilities = fighter.abilities.filter(ab => ab.cost <= fighter.energy);
      if (availableAbilities.length > 0) {
        const ability = availableAbilities[Math.floor(Math.random() * availableAbilities.length)];
        fighter.energy -= ability.cost;
        return ability;
      }
    }
    
    // Basic attack
    return { name: 'Basic Attack', damage: 1.0, cost: 5, description: 'Standard physical attack' };
  };

  const calculateDamage = (attacker, defender, action) => {
    const baseDamage = attacker.attack * (action.damage || 1.0);
    const defensiveReduction = defender.defense * 0.5;
    const randomFactor = 0.8 + Math.random() * 0.4; // 80-120% damage variance
    
    return Math.floor(Math.max(1, (baseDamage - defensiveReduction) * randomFactor));
  };

  const getHealthPercentage = (current, max) => {
    return Math.max(0, (current / max) * 100);
  };

  const getHealthBarColor = (percentage) => {
    if (percentage > 60) return '#28a745';
    if (percentage > 30) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div className="battle-engine">
      <div className="battle-arena">
        <div className="arena-background">
          <div className="energy-particles"></div>
        </div>
        
        {/* Fighter Display */}
        <div className="fighters-display">
          {fighter1 && (
            <div className="fighter-panel left">
              <div className="fighter-portrait">
                <img {...getOptimizedImageProps(fighter1.image, { size: 120 })} alt={fighter1.name} />
                <div className="power-aura"></div>
              </div>
              <div className="fighter-stats">
                <h3>{fighter1.name}</h3>
                <div className="stat-bar">
                  <label>HP</label>
                  <div className="health-bar">
                    <div 
                      className="health-fill"
                      style={{ 
                        width: `${getHealthPercentage(fighter1.hp, fighter1.maxHp)}%`,
                        backgroundColor: getHealthBarColor(getHealthPercentage(fighter1.hp, fighter1.maxHp))
                      }}
                    ></div>
                  </div>
                  <span>{fighter1.hp}/{fighter1.maxHp}</span>
                </div>
                <div className="stat-bar">
                  <label>Energy</label>
                  <div className="energy-bar">
                    <div 
                      className="energy-fill"
                      style={{ width: `${fighter1.energy}%` }}
                    ></div>
                  </div>
                  <span>{fighter1.energy}/100</span>
                </div>
                <div className="power-level">⚡ {fighter1.powerLevel}</div>
              </div>
            </div>
          )}

          <div className="vs-indicator">
            <div className="vs-text">VS</div>
            <div className="battle-effects"></div>
          </div>

          {fighter2 && (
            <div className="fighter-panel right">
              <div className="fighter-portrait">
                <img {...getOptimizedImageProps(fighter2.image, { size: 120 })} alt={fighter2.name} />
                <div className="power-aura"></div>
              </div>
              <div className="fighter-stats">
                <h3>{fighter2.name}</h3>
                <div className="stat-bar">
                  <label>HP</label>
                  <div className="health-bar">
                    <div 
                      className="health-fill"
                      style={{ 
                        width: `${getHealthPercentage(fighter2.hp, fighter2.maxHp)}%`,
                        backgroundColor: getHealthBarColor(getHealthPercentage(fighter2.hp, fighter2.maxHp))
                      }}
                    ></div>
                  </div>
                  <span>{fighter2.hp}/{fighter2.maxHp}</span>
                </div>
                <div className="stat-bar">
                  <label>Energy</label>
                  <div className="energy-bar">
                    <div 
                      className="energy-fill"
                      style={{ width: `${fighter2.energy}%` }}
                    ></div>
                  </div>
                  <span>{fighter2.energy}/100</span>
                </div>
                <div className="power-level">⚡ {fighter2.powerLevel}</div>
              </div>
            </div>
          )}
        </div>

        {/* Battle Log */}
        <div className="battle-log">
          <h4>📜 Battle Log</h4>
          <div className="log-entries">
            {battleLog.map((entry, index) => (
              <div key={index} className="log-entry">
                <span className="turn-number">Turn {entry.turn}:</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Battle Controls */}
        {battleState === 'finished' && winner && (
          <div className="battle-result">
            <div className="winner-announcement">
              <h2>🏆 {winner.name} Wins!</h2>
              <div className="victory-effects"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BattleEngine;
