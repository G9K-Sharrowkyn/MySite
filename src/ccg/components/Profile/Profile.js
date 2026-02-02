import React from 'react';

const Profile = ({ user, onLogout, onPlayPvP, onPlayPvE, onCollection, availableGames, onJoinGame }) => (
  <div className="max-w-4xl mx-auto mt-10 p-6 bg-gray-900">
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-3xl font-bold text-white">Welcome, {user.username}!</h1>
      <button
        onClick={onLogout}
        className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
      >
        Logout
      </button>
    </div>
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Player Stats</h2>
        <span className="text-yellow-400 font-bold">Points: {user.points}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={onPlayPvP}
          className="bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-lg text-center"
        >
          <h3 className="text-xl font-bold">Play PvP</h3>
          <p className="mt-2">Challenge other players</p>
        </button>
        <button
          onClick={onPlayPvE}
          className="bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-lg text-center"
        >
          <h3 className="text-xl font-bold">Play vs AI</h3>
          <p className="mt-2">Practice against computer</p>
        </button>
        <button
          onClick={onCollection}
          className="bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-lg text-center"
        >
          <h3 className="text-xl font-bold">My Collection</h3>
          <p className="mt-2">View your cards</p>
        </button>
      </div>
    </div>
    {availableGames.length > 0 && (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Available Games</h2>
        <div className="grid grid-cols-1 gap-2">
          {availableGames.map(gameId => (
            <button
              key={gameId}
              onClick={() => onJoinGame(gameId)}
              className="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded"
            >
              Join Game #{gameId}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default Profile;