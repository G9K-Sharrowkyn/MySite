import React, { useEffect, useState } from 'react';
import API from '../api';

const Shop = ({ user }) => {
  const [wallet, setWallet] = useState({ packs: { normal: 0, premium: 0 }, currency: { gold: 0, premium: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await API.get('/users/wallet');
      setWallet(res.data);
    } catch (err) {
      setError('Błąd pobierania portfela');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallet(); }, []);

  const buyPack = async (type, currencyType) => {
    setError(''); setSuccess('');
    try {
      await API.post('/users/buy-pack', { type, currencyType });
      setSuccess('Zakupiono paczkę!');
      fetchWallet();
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd zakupu');
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-gray-800 p-6 rounded">
      <h2 className="text-2xl mb-4">Sklep z paczkami</h2>
      {loading ? <div>Ładowanie...</div> : (
        <>
          <div className="mb-4">
            <div className="text-lg text-yellow-300">Gold: {wallet.currency.gold}</div>
            <div className="text-lg text-pink-300">Premium: {wallet.currency.premium}</div>
            <div className="mt-2 text-sm text-gray-300">Twoje paczki: Normalne: {wallet.packs.normal}, Premium: {wallet.packs.premium}</div>
          </div>
          {error && <div className="bg-red-600 text-white p-2 rounded mb-2">{error}</div>}
          {success && <div className="bg-green-600 text-white p-2 rounded mb-2">{success}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 p-4 rounded flex flex-col items-center">
              <div className="text-lg font-bold mb-2">Paczka zwykła</div>
              <div className="mb-2">Cena: <span className="text-yellow-300">200 Gold</span> / <span className="text-pink-300">1 Premium</span></div>
              <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded mb-2" onClick={() => buyPack('normal', 'gold')}>Kup za Gold</button>
              <button className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded" onClick={() => buyPack('normal', 'premium')}>Kup za Premium</button>
            </div>
            <div className="bg-gray-700 p-4 rounded flex flex-col items-center">
              <div className="text-lg font-bold mb-2">Paczka premium</div>
              <div className="mb-2">Cena: <span className="text-yellow-300">1000 Gold</span> / <span className="text-pink-300">5 Premium</span></div>
              <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded mb-2" onClick={() => buyPack('premium', 'gold')}>Kup za Gold</button>
              <button className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded" onClick={() => buyPack('premium', 'premium')}>Kup za Premium</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Shop; 