import React, { useEffect, useState } from 'react';
import API from '../api';
import Card from '../components/Card';

const DECK_SIZE = 40;

const Decks = () => {
  const [collection, setCollection] = useState([]);
  const [decks, setDecks] = useState([]);
  const [deckName, setDeckName] = useState('');
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeDeck, setActiveDeck] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);

  const fetchData = async () => {
    try {
      const res = await API.get('/users/me');
      setCollection(res.data.collection.map(c => c.name));
      setDecks(res.data.decks || []);
      setActiveDeck(res.data.activeDeck || null);
    } catch {
      setError('Błąd pobierania danych');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const createDeck = async () => {
    setError(''); setSuccess('');
    if (!deckName.trim()) return setError('Podaj nazwę talii!');
    try {
      await API.post('/users/decks', { name: deckName });
      setDeckName('');
      setSuccess('Talia utworzona!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd tworzenia talii');
    }
  };

  const deleteDeck = async (name) => {
    setError(''); setSuccess('');
    try {
      await API.delete(`/users/decks/${encodeURIComponent(name)}`);
      setSelectedDeck(null);
      setSuccess('Talia usunięta!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd usuwania talii');
    }
  };

  const addCardToDeck = async (deckName, cardName) => {
    setError(''); setSuccess('');
    try {
      await API.post(`/users/decks/${encodeURIComponent(deckName)}/add`, { cardName });
      setSuccess('Dodano kartę do talii!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd dodawania karty');
    }
  };

  const removeCardFromDeck = async (deckName, cardName) => {
    setError(''); setSuccess('');
    try {
      await API.post(`/users/decks/${encodeURIComponent(deckName)}/remove`, { cardName });
      setSuccess('Usunięto kartę z talii!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd usuwania karty');
    }
  };

  const setActive = async (name) => {
    setError(''); setSuccess('');
    try {
      await API.post('/users/decks/active', { name });
      setActiveDeck(name);
      setSuccess('Ustawiono aktywną talię!');
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd ustawiania aktywnej talii');
    }
  };

  const currentDeck = decks.find(d => d.name === selectedDeck) || { cards: [] };
  const cardsInDeck = currentDeck.cards;
  const cardsAvailable = collection.filter(cardName => !cardsInDeck.includes(cardName));

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <h2 className="text-2xl mb-4">Twoje Talie</h2>
        {error && <div className="bg-red-600 text-white p-2 rounded mb-2">{error}</div>}
        {success && <div className="bg-green-600 text-white p-2 rounded mb-2">{success}</div>}
        <div className="mb-4 flex space-x-2">
          <input type="text" className="p-2 rounded bg-gray-700 text-white" placeholder="Nazwa nowej talii" value={deckName} onChange={e => setDeckName(e.target.value)} />
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" onClick={createDeck}>Utwórz talię</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {decks.map(deck => (
            <div key={deck.name} className={`bg-slate-700/50 rounded-lg p-4 border-2 transition-all cursor-pointer ${
              selectedDeck === deck.name 
                ? 'border-blue-500 bg-blue-900/20' 
                : 'border-slate-600 hover:border-slate-500'
            }`} onClick={() => setSelectedDeck(deck.name)}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white">{deck.name}</h3>
                {activeDeck === deck.name && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">AKTYWNA</span>
                )}
              </div>
              
              <div className="text-sm text-slate-300 mb-3">
                <div>Karty: {deck.cards.length}/{DECK_SIZE}</div>
                {deck.stats && (
                  <div className="mt-1 space-y-1">
                    <div>Gry: {deck.stats.gamesPlayed}</div>
                    <div className="flex justify-between">
                      <span>Wygrane: <span className="text-green-400">{deck.stats.gamesWon}</span></span>
                      <span>Przegrane: <span className="text-red-400">{deck.stats.gamesLost}</span></span>
                    </div>
                    {deck.stats.gamesPlayed > 0 && (
                      <div>Winrate: <span className="text-yellow-400">
                        {Math.round((deck.stats.gamesWon / deck.stats.gamesPlayed) * 100)}%
                      </span></div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                {deck.cards.length === DECK_SIZE && (
                  <button 
                    className={`flex-1 py-1 px-2 rounded text-xs font-medium ${
                      activeDeck === deck.name 
                        ? 'bg-green-600 text-white cursor-default' 
                        : 'bg-green-500 text-white hover:bg-green-400'
                    }`} 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeDeck !== deck.name) setActive(deck.name);
                    }} 
                    disabled={activeDeck === deck.name}
                  >
                    {activeDeck === deck.name ? 'Aktywna' : 'Ustaw aktywną'}
                  </button>
                )}
                <button 
                  className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDeck(deck.name);
                  }}
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
        {selectedDeck && (
          <div className="bg-gray-800 p-4 rounded mb-6 flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="mb-2 text-gray-300">Talia: <span className="text-white font-bold">{selectedDeck}</span> ({cardsInDeck.length}/{DECK_SIZE})</div>
              {cardsInDeck.length !== DECK_SIZE && (
                <div className="text-red-400 font-bold mb-2">Talia musi mieć dokładnie 40 kart!</div>
              )}
              <div className="mb-2 text-gray-300">Kliknij kartę w talii, by ją usunąć.</div>
              <div className="grid grid-cols-4 md:grid-cols-5 gap-2 mb-4">
                {cardsInDeck.map(cardName => (
                  <div key={cardName} className="relative group">
                    <div
                      onMouseEnter={() => setHoveredCard(cardName)}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => removeCardFromDeck(selectedDeck, cardName)}
                      className="cursor-pointer transition-transform duration-200 group-hover:scale-110"
                    >
                      <Card card={{ name: cardName }} size="normal" showStats />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-2 text-gray-300">Kliknij kartę w kolekcji, by dodać do talii.</div>
              <div className="grid grid-cols-6 md:grid-cols-8 gap-2">
                {cardsAvailable.map(cardName => (
                  <div key={cardName} className="relative group">
                    <div
                      onMouseEnter={() => setHoveredCard(cardName)}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => addCardToDeck(selectedDeck, cardName)}
                      className={`cursor-pointer transition-transform duration-200 group-hover:scale-110 ${cardsInDeck.length >= DECK_SIZE ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Card card={{ name: cardName }} size="small" showStats />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Panel podglądu karty */}
            <div className="w-full md:w-72 flex-shrink-0">
              {hoveredCard ? (
                <div className="sticky top-8 bg-gray-900 rounded-lg shadow-lg p-4">
                  <Card card={{ name: hoveredCard }} size="huge" showStats />
                  <div className="mt-2 text-center text-white font-bold">{hoveredCard.replace(/_/g, ' ')}</div>
                </div>
              ) : (
                <div className="sticky top-8 bg-gray-900 rounded-lg shadow-lg p-4 text-gray-400 text-center">Najedź na kartę, by zobaczyć podgląd</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Decks; 