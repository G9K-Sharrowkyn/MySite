import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { CCG_BASE_PATH } from '../utils/paths';

const Lobby = ({ user }) => {
  const navigate = useNavigate();
  const [activeDeck, setActiveDeck] = useState(null);
  const [activeDeckCards, setActiveDeckCards] = useState(0);
  const [loadingDeck, setLoadingDeck] = useState(true);

  useEffect(() => {
    const fetchActiveDeck = async () => {
      try {
        setLoadingDeck(true);
        const response = await API.get('/users/me');
        if (response.data.activeDeck) {
          const deckName = response.data.activeDeck;
          const deck = (response.data.decks || []).find(d => d.name === deckName);
          setActiveDeck(deckName);
          setActiveDeckCards(deck ? deck.cards.length : 0);
        }
      } catch (error) {
        console.error('Error fetching active deck:', error);
      } finally {
        setLoadingDeck(false);
      }
    };

    fetchActiveDeck();
  }, []);

  const handlePlayBot = async (difficulty) => {
    if (!activeDeck || activeDeckCards !== 40) {
      alert('Musisz mieć ustawioną aktywną talię z 40 kartami!');
      return;
    }

    try {
      const res = await API.post('/game/play-vs-bot', { difficulty });
      const matchId = res.data.matchId;
      navigate(`${CCG_BASE_PATH}/game/${matchId}`);
    } catch (error) {
      console.error('Error starting bot game:', error);
      alert(error.response?.data?.message || 'Błąd podczas tworzenia gry z botem');
    }
  };

  const deckReady = activeDeck && activeDeckCards === 40;

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-dark via-space-blue to-space-purple relative overflow-hidden">
      {/* Tło kosmiczne z efektami */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/6 w-1 h-1 bg-cyan-400 rounded-full pulse-glow"></div>
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-purple-400 rounded-full pulse-glow" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/3 left-1/2 w-1.5 h-1.5 bg-pink-400 rounded-full pulse-glow" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-3/4 right-1/6 w-1 h-1 bg-green-400 rounded-full pulse-glow" style={{animationDelay: '6s'}}></div>
      </div>

      <div className="relative z-10 p-6 max-w-6xl mx-auto">
        {/* Nagłówek dowództwa */}
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center pulse-glow">
              <span className="text-black font-bold text-3xl">🚀</span>
            </div>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 font-mono flicker-effect">
            COMMAND CENTER
          </h1>
          <div className="text-cyan-400 text-lg font-mono">
            Welcome back, <span className="text-white font-bold">COMMANDER {user.username.toUpperCase()}</span>
          </div>
          <div className="text-green-400 text-sm font-mono mt-2">
            STATUS: READY FOR DEPLOYMENT
          </div>
        </div>

        {/* Panel statusu aktywnej talii */}
        <div className="modular-frame mb-8 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center pulse-glow">
                <span className="text-black font-bold text-xl">📋</span>
              </div>
              <div>
                <h3 className="text-cyan-400 font-mono text-lg font-bold">ACTIVE FLEET CONFIGURATION</h3>
                {loadingDeck ? (
                  <div className="text-yellow-400 font-mono text-sm">
                    [LOADING FLEET DATA...]
                  </div>
                ) : activeDeck ? (
                  <div>
                    <div className="text-white font-mono text-base">
                      FLEET: <span className="text-yellow-300 font-bold">{activeDeck.toUpperCase()}</span>
                    </div>
                    <div className={`font-mono text-sm ${activeDeckCards === 40 ? 'text-green-400' : 'text-red-400'}`}>
                      SHIPS: {activeDeckCards}/40 {activeDeckCards === 40 ? '[READY]' : '[INCOMPLETE]'}
                    </div>
                  </div>
                ) : (
                  <div className="text-red-400 font-mono text-sm font-bold">
                    [WARNING] NO ACTIVE FLEET CONFIGURED
                  </div>
                )}
              </div>
            </div>
            {!deckReady && (
              <div className="text-red-400 font-mono text-sm text-right">
                <div>[MISSION CRITICAL]</div>
                <div>Configure fleet in DECK MANAGEMENT</div>
              </div>
            )}
          </div>
        </div>

        {/* Główny panel dowodzenia */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Panel gry z botem */}
          <div className="scifi-panel p-8 tech-corners">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center pulse-glow mb-4">
                <span className="text-black font-bold text-2xl">🤖</span>
              </div>
              <h3 className="text-purple-400 font-mono text-xl font-bold mb-2">AI COMBAT SIMULATION</h3>
              <p className="text-gray-300 font-mono text-sm">Train against artificial intelligence</p>
            </div>
            
            <div className="space-y-4">
              <div className="text-center text-cyan-400 font-mono text-sm mb-4">
                [SELECT DIFFICULTY LEVEL]
              </div>
              
              <button
                onClick={() => handlePlayBot('easy')}
                disabled={!deckReady}
                className={`scifi-button green w-full py-3 text-lg font-bold ${!deckReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                CADET LEVEL
              </button>
              
              <button
                onClick={() => handlePlayBot('medium')}
                disabled={!deckReady}
                className={`scifi-button orange w-full py-3 text-lg font-bold ${!deckReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                OFFICER LEVEL
              </button>
              
              <button
                onClick={() => handlePlayBot('hard')}
                disabled={!deckReady}
                className={`scifi-button pink w-full py-3 text-lg font-bold ${!deckReady ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                ADMIRAL LEVEL
              </button>
            </div>
          </div>

          {/* Panel gry PvP */}
          <div className="scifi-panel p-8 tech-corners">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-400 to-green-500 rounded-full flex items-center justify-center pulse-glow mb-4">
                <span className="text-black font-bold text-2xl">⚔️</span>
              </div>
              <h3 className="text-cyan-400 font-mono text-xl font-bold mb-2">MULTIPLAYER COMBAT</h3>
              <p className="text-gray-300 font-mono text-sm">Challenge other commanders</p>
            </div>
            
            <div className="space-y-4">
              <div className="text-center text-cyan-400 font-mono text-sm mb-4">
                [COMING SOON]
              </div>
              
              <button
                disabled={true}
                className="scifi-button w-full py-3 text-lg font-bold opacity-50 cursor-not-allowed"
              >
                QUICK MATCH
              </button>
              
              <button
                disabled={true}
                className="scifi-button w-full py-3 text-lg font-bold opacity-50 cursor-not-allowed"
              >
                RANKED BATTLE
              </button>
              
              <button
                disabled={true}
                className="scifi-button w-full py-3 text-lg font-bold opacity-50 cursor-not-allowed"
              >
                CUSTOM LOBBY
              </button>
            </div>
          </div>
        </div>

        {/* Panel szybkiego dostępu */}
        <div className="mt-8">
          <div className="modular-frame p-6">
            <h3 className="text-cyan-400 font-mono text-lg font-bold mb-4 text-center">
              QUICK ACCESS CONSOLE
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate(`${CCG_BASE_PATH}/collection`)}
                className="scifi-button purple text-center py-4"
              >
                <div className="text-2xl mb-2">📚</div>
                <div className="text-sm">COLLECTION</div>
              </button>
              
              <button
                onClick={() => navigate(`${CCG_BASE_PATH}/decks`)}
                className="scifi-button green text-center py-4"
              >
                <div className="text-2xl mb-2">🃏</div>
                <div className="text-sm">FLEET MGMT</div>
              </button>
              
              <button
                onClick={() => navigate(`${CCG_BASE_PATH}/shop`)}
                className="scifi-button orange text-center py-4"
              >
                <div className="text-2xl mb-2">🛒</div>
                <div className="text-sm">SUPPLY DEPOT</div>
              </button>
              
              <button
                onClick={() => navigate(`${CCG_BASE_PATH}/crafting`)}
                className="scifi-button pink text-center py-4"
              >
                <div className="text-2xl mb-2">⚗️</div>
                <div className="text-sm">R&D LAB</div>
              </button>
            </div>
          </div>
        </div>

        {/* Status systemowy */}
        <div className="mt-8 text-center">
          <div className="inline-block modular-frame px-6 py-3">
            <div className="text-green-400 font-mono text-sm">
              SYSTEM STATUS: <span className="text-white">OPERATIONAL</span>
            </div>
            <div className="text-cyan-400 font-mono text-xs mt-1">
              PROTEUS NEBULE COMMAND INTERFACE v2.387
            </div>
          </div>
        </div>
      </div>

      {/* Efekt skanowania */}
      <div className="scan-lines"></div>
    </div>
  );
};

export default Lobby;
