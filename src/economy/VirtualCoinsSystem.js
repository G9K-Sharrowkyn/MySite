import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './VirtualCoinsSystem.css';

const VirtualCoinsSystem = ({ user }) => {
  const [userCoins, setUserCoins] = useState(0);
  const [coinHistory, setCoinHistory] = useState([]);
  const [userInventory, setUserInventory] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [bettingHistory, setBettingHistory] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);
  const [selectedStoreCategory, setSelectedStoreCategory] = useState('titles');

  // Store categories and items
  const storeCategories = {
    titles: {
      name: 'Custom Titles',
      icon: '🏷️',
      items: [
        { id: 'title_1', name: 'The Legendary', cost: 500, description: 'Golden legendary title' },
        { id: 'title_2', name: 'Champion Slayer', cost: 750, description: 'For defeating champions' },
        { id: 'title_3', name: 'Debate Master', cost: 300, description: 'Master of arguments' },
        { id: 'title_4', name: 'Vote Warden', cost: 400, description: 'Guardian of voting integrity' },
        { id: 'title_5', name: 'Betting Guru', cost: 600, description: 'Master of predictions' }
      ]
    },
    nameColors: {
      name: 'Nickname Colors',
      icon: '🎨',
      items: [
        { id: 'color_gold', name: 'Gold Name', cost: 200, color: '#FFD700', description: 'Shimmering gold username' },
        { id: 'color_purple', name: 'Royal Purple', cost: 150, color: '#8A2BE2', description: 'Majestic purple glow' },
        { id: 'color_red', name: 'Crimson Red', cost: 150, color: '#DC143C', description: 'Bold crimson display' },
        { id: 'color_blue', name: 'Electric Blue', cost: 150, color: '#1E90FF', description: 'Vibrant blue shine' },
        { id: 'color_green', name: 'Emerald Green', cost: 150, color: '#00FF7F', description: 'Brilliant emerald glow' },
        { id: 'color_rainbow', name: 'Rainbow Effect', cost: 500, gradient: true, description: 'Animated rainbow colors' }
      ]
    },
    contenderChances: {
      name: 'Fight Opportunities',
      icon: '🥊',
      items: [
        { id: 'contender_1', name: 'Contender Shot Request', cost: 800, description: 'Request consideration for title contender fight' },
        { id: 'exhibition_match', name: 'Exhibition Match', cost: 300, description: 'Non-record exhibition fight' },
        { id: 'call_out', name: 'Fighter Call-Out', cost: 200, description: 'Publicly challenge specific opponent' },
        { id: 'grudge_match', name: 'Grudge Match Request', cost: 400, description: 'Request rematch with rival' }
      ]
    },
    profileUpgrades: {
      name: 'Profile Upgrades',
      icon: '✨',
      items: [
        { id: 'custom_bg', name: 'Custom Background Upload', cost: 250, description: 'Upload personal background image' },
        { id: 'animated_avatar', name: 'Animated Avatar Border', cost: 300, description: 'Glowing animated avatar frame' },
        { id: 'profile_theme', name: 'Profile Theme Pack', cost: 400, description: 'Exclusive color theme for profile' },
        { id: 'victory_sound', name: 'Custom Victory Sound', cost: 350, description: 'Personal victory notification sound' }
      ]
    },
    betBoosts: {
      name: 'Betting Boosts',
      icon: '🎲',
      items: [
        { id: 'double_odds', name: 'Double Odds Booster', cost: 100, description: 'Double winnings on next bet (24h)' },
        { id: 'insurance', name: 'Bet Insurance', cost: 150, description: 'Get 50% back if bet loses (24h)' },
        { id: 'parlay_boost', name: 'Parlay Multiplier +1', cost: 200, description: 'Add +1 to parlay multiplier (24h)' },
        { id: 'early_access', name: 'Early Betting Access', cost: 300, description: 'Bet 1 hour before public (week)' }
      ]
    }
  };

  // Ways to earn coins
  const coinEarningMethods = [
    { action: 'Daily Bonus', amount: 10, icon: '📅' },
    { action: 'Cast Vote in Fight', amount: 10, icon: '🗳️' },
    { action: 'Comment on Fight', amount: 5, icon: '💬' },
    { action: 'Share Fight', amount: 15, icon: '📤' },
    { action: 'Win Official Fight', amount: 100, icon: '🏆' },
    { action: 'Win Title Fight', amount: 500, icon: '👑' },
    { action: 'Successful Bet', amount: 'Variable', icon: '💰' },
    { action: 'Daily Challenge Complete', amount: 75, icon: '🎯' },
    { action: 'Weekly Challenge Complete', amount: 200, icon: '⭐' },
    { action: 'Profile Comment Received', amount: 2, icon: '💭' },
    { action: 'Friend Referral', amount: 100, icon: '👥' }
  ];

  const fetchEconomyData = useCallback(async () => {
    try {
      const [
        coinsRes,
        historyRes,
        inventoryRes,
        tasksRes,
        bettingHistoryRes,
        currentBetsRes
      ] = await Promise.all([
        axios.get(`/api/users/${user?.id}/coins`),
        axios.get(`/api/users/${user?.id}/coin-history`),
        axios.get(`/api/users/${user?.id}/inventory`),
        axios.get(`/api/users/${user?.id}/daily-tasks`),
        axios.get(`/api/users/${user?.id}/betting-history`),
        axios.get(`/api/users/${user?.id}/current-bets`)
      ]);

      setUserCoins(coinsRes.data?.coins || 0);
      setCoinHistory(historyRes.data || []);
      setUserInventory(inventoryRes.data || []);
      setDailyTasks(tasksRes.data || []);
      setBettingHistory(bettingHistoryRes.data || []);
      setCurrentBets(currentBetsRes.data || []);
    } catch (error) {
      console.error('Error fetching economy data:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEconomyData();
  }, [fetchEconomyData]);

  const purchaseItem = async (itemId, category) => {
    const item = storeCategories[category].items.find(i => i.id === itemId);
    if (!item || userCoins < item.cost) return;

    try {
      await axios.post('/api/store/purchase', {
        userId: user.id,
        itemId,
        category,
        cost: item.cost
      });

      setUserCoins(prev => prev - item.cost);
      setUserInventory(prev => [...prev, { ...item, category, purchaseDate: new Date() }]);
      
      alert(`Successfully purchased ${item.name}!`);
      fetchEconomyData();
    } catch (error) {
      console.error('Error purchasing item:', error);
      alert('Failed to purchase item.');
    }
  };

  const claimDailyTask = async (taskId) => {
    try {
      await axios.post('/api/users/claim-daily-task', {
        userId: user.id,
        taskId
      });

      fetchEconomyData();
      alert('Daily task completed! Eurodolary earned!');
    } catch (error) {
      console.error('Error claiming task:', error);
    }
  };

  const EarningMethodsSection = () => (
    <div className="earning-methods">
      <h3>💰 Ways to Earn Eurodolary</h3>
      <div className="earning-grid">
        {coinEarningMethods.map((method, index) => (
          <div key={index} className="earning-method">
            <div className="earning-icon">{method.icon}</div>
            <div className="earning-info">
              <span className="earning-action">{method.action}</span>
              <span className="earning-amount">+{method.amount} 🪙</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const DailyTasksSection = () => (
    <div className="daily-tasks">
      <h3>🎯 Daily Tasks</h3>
      <div className="tasks-grid">
        {dailyTasks.map(task => (
          <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
            <div className="task-icon">{task.icon}</div>
            <div className="task-info">
              <span className="task-name">{task.name}</span>
              <span className="task-description">{task.description}</span>
              <div className="task-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(task.progress / task.target) * 100}%` }}
                  ></div>
                </div>
                <span className="progress-text">{task.progress}/{task.target}</span>
              </div>
            </div>
            <div className="task-reward">
              <span className="reward-amount">+{task.reward} 🪙</span>
              {task.completed && !task.claimed && (
                <button 
                  className="claim-btn"
                  onClick={() => claimDailyTask(task.id)}
                >
                  Claim
                </button>
              )}
              {task.claimed && <span className="claimed-badge">✅ Claimed</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const StoreSection = () => (
    <div className="coin-store">
      <h3>🛒 Eurodolary Store</h3>
      
      <div className="store-categories">
        {Object.entries(storeCategories).map(([key, category]) => (
          <button
            key={key}
            className={`category-btn ${selectedStoreCategory === key ? 'active' : ''}`}
            onClick={() => setSelectedStoreCategory(key)}
          >
            {category.icon} {category.name}
          </button>
        ))}
      </div>

      <div className="store-items">
        {storeCategories[selectedStoreCategory].items.map(item => {
          const owned = userInventory.some(inv => inv.id === item.id);
          const canAfford = userCoins >= item.cost;

          return (
            <div key={item.id} className={`store-item ${owned ? 'owned' : ''} ${!canAfford ? 'unaffordable' : ''}`}>
              <div className="item-preview">
                {item.color && (
                  <span 
                    className="color-preview" 
                    style={{ 
                      color: item.color,
                      background: item.gradient ? 'linear-gradient(45deg, #ff0000, #ff8800, #ffff00, #88ff00, #00ff00, #00ff88, #00ffff, #0088ff, #0000ff, #8800ff, #ff00ff, #ff0088)' : 'transparent'
                    }}
                  >
                    Sample Text
                  </span>
                )}
                {selectedStoreCategory === 'titles' && (
                  <span className="title-preview">"{item.name}"</span>
                )}
                {selectedStoreCategory === 'contenderChances' && (
                  <div className="opportunity-preview">🥊</div>
                )}
                {selectedStoreCategory === 'profileUpgrades' && (
                  <div className="upgrade-preview">✨</div>
                )}
                {selectedStoreCategory === 'betBoosts' && (
                  <div className="boost-preview">🎲</div>
                )}
              </div>
              
              <div className="item-info">
                <h4>{item.name}</h4>
                <p>{item.description}</p>
                <div className="item-cost">🪙 {item.cost}</div>
              </div>

              <div className="item-actions">
                {owned ? (
                  <span className="owned-badge">✅ Owned</span>
                ) : (
                  <button
                    className="purchase-btn"
                    onClick={() => purchaseItem(item.id, selectedStoreCategory)}
                    disabled={!canAfford}
                  >
                    {canAfford ? 'Purchase' : 'Not Enough Eurodolary'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const BettingHistorySection = () => (
    <div className="betting-history">
      <h3>🎰 Betting History</h3>
      
      <div className="betting-stats">
        <div className="stat-card">
          <span className="stat-number">{bettingHistory.length}</span>
          <span className="stat-label">Total Bets</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {bettingHistory.filter(bet => bet.result === 'won').length}
          </span>
          <span className="stat-label">Won</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {Math.round((bettingHistory.filter(bet => bet.result === 'won').length / bettingHistory.length) * 100) || 0}%
          </span>
          <span className="stat-label">Win Rate</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            🪙 {bettingHistory.reduce((acc, bet) => acc + (bet.result === 'won' ? bet.winnings : 0), 0)}
          </span>
          <span className="stat-label">Total Winnings</span>
        </div>
      </div>

      <div className="current-bets">
        <h4>🎯 Current Active Bets</h4>
        {currentBets.map(bet => (
          <div key={bet.id} className="bet-card active-bet">
            <div className="bet-info">
              <span className="fight-matchup">{bet.fight.team1.name} vs {bet.fight.team2.name}</span>
              <span className="bet-prediction">Bet on: {bet.prediction}</span>
              <span className="bet-amount">Amount: 🪙 {bet.amount}</span>
            </div>
            <div className="bet-status">
              <span className="status-badge active">⏳ Active</span>
              <span className="potential-winnings">
                Potential: 🪙 {bet.potentialWinnings}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="betting-history-list">
        <h4>📜 Past Bets</h4>
        {bettingHistory.slice(0, 20).map(bet => (
          <div key={bet.id} className={`bet-card ${bet.result}`}>
            <div className="bet-info">
              <span className="fight-matchup">{bet.fight.team1.name} vs {bet.fight.team2.name}</span>
              <span className="bet-prediction">Bet on: {bet.prediction}</span>
              <span className="bet-amount">Amount: 🪙 {bet.amount}</span>
              <span className="bet-date">{new Date(bet.placedAt).toLocaleDateString()}</span>
            </div>
            <div className="bet-result">
              {bet.result === 'won' && (
                <>
                  <span className="result-badge won">✅ Won</span>
                  <span className="winnings">+🪙 {bet.winnings}</span>
                </>
              )}
              {bet.result === 'lost' && (
                <>
                  <span className="result-badge lost">❌ Lost</span>
                  <span className="loss">-🪙 {bet.amount}</span>
                </>
              )}
              {bet.result === 'pending' && (
                <span className="result-badge pending">⏳ Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CoinHistorySection = () => (
    <div className="coin-history">
      <h3>📊 Eurodolary Transaction History</h3>
      <div className="history-list">
        {coinHistory.slice(0, 50).map(transaction => (
          <div key={transaction.id} className={`history-item ${transaction.type}`}>
            <div className="transaction-icon">
              {transaction.type === 'earned' ? '💰' : '💸'}
            </div>
            <div className="transaction-info">
              <span className="transaction-description">{transaction.description}</span>
              <span className="transaction-date">
                {new Date(transaction.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className={`transaction-amount ${transaction.type}`}>
              {transaction.type === 'earned' ? '+' : '-'}🪙 {transaction.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="virtual-coins-system">
      <div className="economy-header">
        <h1>💰 Virtual Economy</h1>
        <div className="user-wallet">
          <div className="coin-balance">
            <span className="balance-label">Your Balance:</span>
            <span className="balance-amount">🪙 {userCoins.toLocaleString()}</span>
          </div>
          <button className="buy-coins-btn" onClick={() => window.open('/purchase-coins', '_blank')}>
            💳 Buy More Eurodolary
          </button>
        </div>
      </div>

      <div className="economy-tabs">
        <div className="tab-nav">
          <button className="tab-btn active">🛒 Store</button>
          <button className="tab-btn">🎯 Tasks</button>
          <button className="tab-btn">🎰 Betting</button>
          <button className="tab-btn">💰 Earnings</button>
          <button className="tab-btn">📊 History</button>
        </div>

        <div className="tab-content">
          <StoreSection />
          <DailyTasksSection />
          <BettingHistorySection />
          <EarningMethodsSection />
          <CoinHistorySection />
        </div>
      </div>
    </div>
  );
};

export default VirtualCoinsSystem;
