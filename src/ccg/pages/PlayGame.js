import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../utils/socket';
import GameInterface from '../components/GameInterface';
import LoadingScreen from '../components/LoadingScreen';
import API from '../api';

const PlayGame = ({ user }) => {
  const { roomId } = useParams();
  const [deck, setDeck] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit('joinRoom', { roomId, user: { id: user.id, username: user.username } });
    
    socket.on('playersUpdate', (list) => {
      const opp = list.find(u => u.id !== user.id);
      if (opp) setOpponent(opp);
      setLoading(false);
    });
    
    socket.on('gameStart', ({ deck }) => {
      setDeck(deck);
      setGameStarted(true);
    });

    API.post(`/game/room/${roomId}/join`);
    
    return () => {
      socket.off('playersUpdate');
      socket.off('gameStart');
    };
  }, [roomId]);

  const startGame = () => {
    socket.emit('startGame', { roomId });
  };

  if (loading) {
    return <LoadingScreen message="Joining game room..." />;
  }

  if (gameStarted && deck.length > 0) {
    return <GameInterface user={user} roomId={roomId} initialDeck={deck} />;
  }

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Game Lobby Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Game Room</h1>
            <p className="text-slate-400">Room ID: <span className="text-blue-400 font-mono">{roomId}</span></p>
          </div>
          <button 
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:from-green-500 hover:to-emerald-500 transform hover:scale-105 transition-all duration-300"
            onClick={startGame}
          >
            Start Game
          </button>
        </div>
      </div>

      {/* Players Section */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          <h2 className="text-xl font-bold text-white text-center mb-8">Players</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Current Player */}
            <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/30 rounded-xl border-2 border-blue-600/50 p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{user.username.charAt(0).toUpperCase()}</span>
              </div>
              <h3 className="text-lg font-bold text-blue-400 mb-2">{user.username}</h3>
              <p className="text-blue-300 text-sm">You</p>
              <div className="mt-4 flex justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="ml-2 text-green-400 text-sm">Ready</span>
              </div>
            </div>

            {/* Opponent */}
            <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 rounded-xl border-2 border-red-600/50 p-6 text-center">
              {opponent ? (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{opponent.username.charAt(0).toUpperCase()}</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-400 mb-2">{opponent.username}</h3>
                  <p className="text-red-300 text-sm">Opponent</p>
                  <div className="mt-4 flex justify-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="ml-2 text-green-400 text-sm">Ready</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl text-gray-400">?</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-400 mb-2">Waiting for opponent...</h3>
                  <p className="text-gray-500 text-sm">Empty slot</p>
                  <div className="mt-4 flex justify-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="ml-2 text-yellow-400 text-sm">Waiting</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Game Instructions */}
          <div className="mt-12 text-center">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-600">
              <h3 className="text-lg font-bold text-white mb-4">How to Play</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
                <div>
                  <div className="text-blue-400 font-bold mb-2">Command Phase</div>
                  <p>Play command cards to generate mana for your units</p>
                </div>
                <div>
                  <div className="text-green-400 font-bold mb-2">Deployment Phase</div>
                  <p>Deploy units using your accumulated mana</p>
                </div>
                <div>
                  <div className="text-red-400 font-bold mb-2">Battle Phase</div>
                  <p>Attack with your units and end your turn</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayGame;
