import React, { useState, useEffect } from 'react';
import API from '../api';
import Card from '../components/Card';

const Crafting = () => {
  const [allCards, setAllCards] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [craftingResult, setCraftingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cardsRes, profileRes] = await Promise.all([
        API.get('/users/cards'),
        API.get('/users/me')
      ]);
      setAllCards(cardsRes.data);
      setUserProfile(profileRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleCraftCard = async () => {
    if (!selectedCard) return;
    
    setLoading(true);
    try {
      const response = await API.post('/users/craft-card', {
        cardName: selectedCard.name
      });
      
      setCraftingResult({
        success: true,
        message: response.data.message,
        cardName: response.data.cardName,
        remainingFragments: response.data.remainingFragments
      });
      
      // Odśwież profil użytkownika
      const profileRes = await API.get('/users/me');
      setUserProfile(profileRes.data);
      
    } catch (error) {
      setCraftingResult({
        success: false,
        message: error.response?.data?.message || 'Błąd podczas craftingu'
      });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCards = () => {
    let filtered = allCards;
    
    // Filtruj według posiadania
    if (filter === 'owned') {
      filtered = filtered.filter(card => 
        userProfile?.collection?.some(c => c.name === card.name)
      );
    } else if (filter === 'missing') {
      filtered = filtered.filter(card => 
        !userProfile?.collection?.some(c => c.name === card.name)
      );
    }
    
    // Filtruj według wyszukiwania
    if (searchTerm) {
      filtered = filtered.filter(card =>
        card.name.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const craftingCost = 100; // Podstawowy koszt craftingu
  const canCraft = userProfile && selectedCard && 
    userProfile.cardFragments >= craftingCost && 
    !userProfile.collection?.some(c => c.name === selectedCard.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 mb-6 border border-slate-600">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Warsztat Kart</h1>
              <p className="text-slate-400">Twórz karty z kawałków znalezionych w paczkach</p>
            </div>
            <div className="mt-4 md:mt-0 text-right">
              <div className="text-2xl font-bold text-purple-400">
                {userProfile?.cardFragments || 0} Kawałków
              </div>
              <div className="text-slate-400 text-sm">Dostępne materiały</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Craftingu */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600 sticky top-4">
              <h3 className="text-xl font-bold text-white mb-4">Crafting</h3>
              
              {selectedCard ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Card 
                      card={selectedCard} 
                      size="large" 
                      showStats 
                      enableHoverZoom={false}
                    />
                  </div>
                  
                  <div className="text-center">
                    <h4 className="text-lg font-bold text-white mb-2">
                      {selectedCard.name.replace(/_/g, ' ')}
                    </h4>
                    
                    <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-400">Koszt:</span>
                        <span className="text-purple-400 font-bold">{craftingCost} kawałków</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Masz:</span>
                        <span className={`font-bold ${
                          (userProfile?.cardFragments || 0) >= craftingCost 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          {userProfile?.cardFragments || 0} kawałków
                        </span>
                      </div>
                    </div>
                    
                    {userProfile?.collection?.some(c => c.name === selectedCard.name) ? (
                      <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 mb-4">
                        <span className="text-yellow-400 text-sm">
                          ✓ Już posiadasz tę kartę
                        </span>
                      </div>
                    ) : null}
                    
                    <button
                      onClick={handleCraftCard}
                      disabled={!canCraft || loading}
                      className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-300 ${
                        canCraft && !loading
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 transform hover:scale-105'
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {loading ? 'Tworzenie...' : 'Stwórz Kartę'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🔨</div>
                  <p className="text-slate-400">
                    Wybierz kartę z listy, aby rozpocząć crafting
                  </p>
                </div>
              )}
              
              {/* Wynik craftingu */}
              {craftingResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  craftingResult.success 
                    ? 'bg-green-900/30 border-green-600/50' 
                    : 'bg-red-900/30 border-red-600/50'
                }`}>
                  <p className={`text-sm ${
                    craftingResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {craftingResult.message}
                  </p>
                  {craftingResult.success && (
                    <p className="text-xs text-slate-400 mt-1">
                      Pozostało: {craftingResult.remainingFragments} kawałków
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lista Kart */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 border border-slate-600">
              {/* Filtry */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Szukaj kart..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Wszystkie
                  </button>
                  <button
                    onClick={() => setFilter('missing')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filter === 'missing'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Brakujące
                  </button>
                  <button
                    onClick={() => setFilter('owned')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      filter === 'owned'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    Posiadane
                  </button>
                </div>
              </div>

              {/* Siatka kart */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {getFilteredCards().map((card) => {
                  const isOwned = userProfile?.collection?.some(c => c.name === card.name);
                  const isSelected = selectedCard?.name === card.name;
                  
                  return (
                    <div
                      key={card.name}
                      className={`relative cursor-pointer transition-all duration-300 ${
                        isSelected ? 'ring-2 ring-blue-400 scale-105' : ''
                      }`}
                      onClick={() => setSelectedCard(card)}
                    >
                      <Card
                        card={card}
                        size="normal"
                        showStats
                        className={isOwned ? 'opacity-60' : ''}
                      />
                      
                      {isOwned && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded">
                          ✓
                        </div>
                      )}
                      
                      <p className="text-center mt-2 text-xs text-slate-300 truncate">
                        {card.name.replace(/_/g, ' ')}
                      </p>
                    </div>
                  );
                })}
              </div>
              
              {getFilteredCards().length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-slate-400">
                    Nie znaleziono kart spełniających kryteria
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Informacje o craftingu */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl p-6 mt-6 border border-slate-600">
          <h3 className="text-xl font-bold text-white mb-4">Jak działa Crafting?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-purple-400 font-bold mb-2">1. Zbieraj kawałki</div>
              <p className="text-slate-300">
                Otrzymuj kawałki kart za duplikaty w paczkach. Każdy duplikat daje 20 kawałków.
              </p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-blue-400 font-bold mb-2">2. Wybierz kartę</div>
              <p className="text-slate-300">
                Wybierz kartę, której nie posiadasz. Każda karta kosztuje 100 kawałków.
              </p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <div className="text-green-400 font-bold mb-2">3. Stwórz kartę</div>
              <p className="text-slate-300">
                Kliknij "Stwórz Kartę" i dodaj ją do swojej kolekcji!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Crafting; 