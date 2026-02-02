import React, { useState, useEffect } from 'react';
import API from '../api';
import Card from '../components/Card';

const Collection = () => {
  const [cards, setCards] = useState([]);
  const [myCollection, setMyCollection] = useState([]);
  const [packs, setPacks] = useState({ normal: 0, premium: 0 });
  const [opening, setOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState([]);
  const [error, setError] = useState('');
  const [goldBonus, setGoldBonus] = useState(0);

  const fetchCollection = async () => {
    API.get('/users/cards').then(res => setCards(res.data));
    API.get('/users/me').then(res => setMyCollection(res.data.collection.map(c => c.name)));
    API.get('/users/wallet').then(res => setPacks(res.data.packs));
  };

  useEffect(() => { fetchCollection(); }, []);

  const addCard = async (name) => {
    await API.post('/users/collection', { cardId: name });
    setMyCollection(prev => [...prev, name]);
  };

  const openPack = async (type) => {
    setError('');
    setOpening(true);
    setOpenedCards([]);
    setGoldBonus(0);
    try {
      const res = await API.post('/users/open-pack', { type });
      setOpenedCards(res.data.cards);
      setPacks(res.data.packs);
      setMyCollection(res.data.collection);
      setGoldBonus(res.data.goldBonus || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd otwierania paczki');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl mb-4">Twoja Kolekcja Kart</h2>
      {/* Sekcja otwierania paczek */}
      <div className="bg-gray-700 p-4 rounded mb-6">
        <div className="mb-2 text-lg">Twoje paczki: <span className="text-yellow-300">{packs.normal}</span> zwykłych, <span className="text-pink-300">{packs.premium}</span> premium</div>
        {error && <div className="bg-red-600 text-white p-2 rounded mb-2">{error}</div>}
        <div className="flex space-x-4">
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded" disabled={opening || packs.normal < 1} onClick={() => openPack('normal')}>Otwórz zwykłą paczkę</button>
          <button className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded" disabled={opening || packs.premium < 1} onClick={() => openPack('premium')}>Otwórz paczkę premium</button>
        </div>
        {opening && <div className="mt-4 text-white">Otwieranie paczki...</div>}
        {openedCards.length > 0 && (
          <div className="mt-4">
            <div className="text-white mb-2">Wylosowane karty:</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {openedCards.map(name => (
                <Card key={name} card={{ name }} size="large" showStats />
              ))}
            </div>
            {goldBonus > 0 && (
              <div className="mt-2 text-yellow-300 font-bold">Za duplikaty otrzymano: +{goldBonus} Gold!</div>
            )}
          </div>
        )}
      </div>
      {/* Kolekcja */}
      <h3 className="text-xl mb-2">Wszystkie Karty</h3>
      <div className="grid grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.name} className="bg-gray-700 p-2 rounded">
            <Card card={card} size="large" showStats />
            <p className="text-center mt-2">{card.name}</p>
            {myCollection.includes(card.name) ? (
              <button className="w-full bg-gray-500 py-1 rounded mt-2" disabled>Posiadasz</button>
            ) : (
              <button className="w-full bg-blue-600 py-1 rounded mt-2" onClick={() => addCard(card.name)}>Dodaj</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Collection;
