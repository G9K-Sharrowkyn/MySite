import React from 'react';
import Card from './Card';

const ImageTest = () => {
  const testCards = [
    { name: 'Yazzilan_Industry_Zone' },
    { name: 'Yazzilan_Dockyard' }, 
    { name: 'Aberran_Firenaute' },
    { name: 'Aelgallan_Flamers' },
    { name: 'Terran_Shipyard' },
    { name: 'Wernano_Artitank' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-white text-3xl font-bold mb-8 text-center">Card Image Loading Test</h1>
        
        {/* Test with direct img tags */}
        <div className="mb-12">
          <h2 className="text-white text-xl mb-4">Direct Image Loading Test</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {testCards.map(card => (
              <div key={card.name} className="text-center">
                <img 
                  src={`${process.env.PUBLIC_URL}/assets/cards/${card.name}.png`}
                  alt={card.name}
                  className="w-32 h-44 object-cover border border-gray-600 rounded shadow-lg"
                  onLoad={() => console.log(`✅ Direct load success: ${card.name}`)}
                  onError={(e) => {
                    console.log(`❌ Direct load failed: ${card.name}`);
                    console.log(`Tried path: ${e.target.src}`);
                    // Try alternative path
                    e.target.src = `/assets/cards/${card.name}.png`;
                  }}
                />
                <p className="text-white text-xs mt-2 break-words">{card.name.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Test with Card component */}
        <div className="mb-12">
          <h2 className="text-white text-xl mb-4">Card Component Test</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {testCards.map(card => (
              <div key={`card-${card.name}`} className="text-center">
                <Card 
                  card={card}
                  size="large"
                  showStats={true}
                />
                <p className="text-white text-xs mt-2 break-words">{card.name.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Debug info */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-white text-lg font-bold mb-4">Debug Information</h3>
          <div className="text-slate-300 space-y-2">
            <p><strong>PUBLIC_URL:</strong> {process.env.PUBLIC_URL || 'undefined'}</p>
            <p><strong>Sample Path:</strong> {`${process.env.PUBLIC_URL}/assets/cards/Yazzilan_Industry_Zone.png`}</p>
            <p><strong>Alternative Path:</strong> /assets/cards/Yazzilan_Industry_Zone.png</p>
            <p className="text-yellow-400">Check browser console for loading results!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageTest;