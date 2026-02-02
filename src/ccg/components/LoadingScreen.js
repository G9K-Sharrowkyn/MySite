import React from 'react';

const LoadingScreen = ({ message = "Loading game..." }) => {
  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        {/* Animated logo/spinner */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto relative">
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
            <div className="absolute inset-2 border-4 border-purple-600 rounded-full animate-spin border-b-transparent" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-4 border-4 border-yellow-500 rounded-full animate-spin border-l-transparent" style={{ animationDuration: '2s' }}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg"></div>
            </div>
          </div>
        </div>
        
        {/* Loading text */}
        <h2 className="text-2xl font-bold text-white mb-4">Card Game</h2>
        <p className="text-slate-400 text-lg mb-8">{message}</p>
        
        {/* Loading dots animation */}
        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;