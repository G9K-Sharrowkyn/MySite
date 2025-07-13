import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';
import './DonationSystem.css';

const DonationSystem = () => {
  const [donationStats, setDonationStats] = useState({
    totalDonations: 0,
    totalAmount: 0,
    monthlyGoal: 1000,
    monthlyProgress: 0,
    topDonors: [],
    recentDonations: []
  });
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationAmount, setDonationAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [donationMessage, setDonationMessage] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('buymeacoffee');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  const presetAmounts = [1, 3, 5, 10, 25, 50];

  useEffect(() => {
    fetchDonationStats();
  }, []);

  const fetchDonationStats = async () => {
    try {
      const response = await axios.get('/api/donations/stats');
      setDonationStats(response.data);
    } catch (error) {
      console.error('Error fetching donation stats:', error);
    }
  };

  const handleDonation = async () => {
    setIsLoading(true);
    
    try {
      const amount = customAmount ? parseFloat(customAmount) : donationAmount;
      
      if (!amount || amount <= 0) {
        alert('Please enter a valid donation amount.');
        return;
      }

      // Record donation in backend
      await axios.post('/api/donations/record', {
        amount,
        message: donationMessage,
        platform: selectedPlatform,
        timestamp: new Date().toISOString()
      });

      // Redirect to payment platform
      const paymentUrl = getPaymentUrl(amount, donationMessage);
      window.open(paymentUrl, '_blank');

      // Reset form
      setDonationAmount(5);
      setCustomAmount('');
      setDonationMessage('');
      setShowDonationModal(false);
      
      // Refresh stats
      fetchDonationStats();
      
      alert('Thank you for your donation! You will be redirected to complete the payment.');
    } catch (error) {
      console.error('Error processing donation:', error);
      alert('Error processing donation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentUrl = (amount, message) => {
    const encodedMessage = encodeURIComponent(message || 'Support for Fight Zone');
    
    if (selectedPlatform === 'buymeacoffee') {
      return `https://www.buymeacoffee.com/fightzone?amount=${amount}&message=${encodedMessage}`;
    } else if (selectedPlatform === 'paypal') {
      return `https://www.paypal.com/donate/?hosted_button_id=YOUR_PAYPAL_BUTTON_ID&amount=${amount}&currency_code=USD&message=${encodedMessage}`;
    }
    
    return '#';
  };

  const DonationModal = () => (
    <div className="donation-modal-overlay" onClick={() => setShowDonationModal(false)}>
      <div className="donation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💝 Support Fight Zone</h2>
          <button 
            className="close-btn"
            onClick={() => setShowDonationModal(false)}
          >
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="donation-options">
            <h3>Choose Amount</h3>
            <div className="amount-buttons">
              {presetAmounts.map(amount => (
                <button
                  key={amount}
                  className={`amount-btn ${donationAmount === amount ? 'selected' : ''}`}
                  onClick={() => {
                    setDonationAmount(amount);
                    setCustomAmount('');
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>
            
            <div className="custom-amount">
              <label>Custom Amount:</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setDonationAmount(0);
                }}
              />
            </div>
          </div>

          <div className="donation-message">
            <label>Message (Optional):</label>
            <textarea
              placeholder="Leave a message of support..."
              value={donationMessage}
              onChange={(e) => setDonationMessage(e.target.value)}
              rows="3"
              maxLength="200"
            />
            <span className="char-count">{donationMessage.length}/200</span>
          </div>

          <div className="payment-platform">
            <h3>Payment Method</h3>
            <div className="platform-options">
              <label className="platform-option">
                <input
                  type="radio"
                  name="platform"
                  value="buymeacoffee"
                  checked={selectedPlatform === 'buymeacoffee'}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                />
                <div className="platform-info">
                  <img src="/buymeacoffee-logo.png" alt="Buy Me a Coffee" />
                  <span>Buy Me a Coffee</span>
                </div>
              </label>
              
              <label className="platform-option">
                <input
                  type="radio"
                  name="platform"
                  value="paypal"
                  checked={selectedPlatform === 'paypal'}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                />
                <div className="platform-info">
                  <img src="/paypal-logo.png" alt="PayPal" />
                  <span>PayPal</span>
                </div>
              </label>
            </div>
          </div>

          <div className="donation-summary">
            <div className="summary-item">
              <span>Amount:</span>
              <span className="amount">${customAmount || donationAmount}</span>
            </div>
            <div className="summary-item">
              <span>Platform:</span>
              <span className="platform">{selectedPlatform === 'buymeacoffee' ? 'Buy Me a Coffee' : 'PayPal'}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="donate-btn"
            onClick={handleDonation}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : `Donate $${customAmount || donationAmount}`}
          </button>
          <button 
            className="cancel-btn"
            onClick={() => setShowDonationModal(false)}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const DonationStats = () => (
    <div className="donation-stats">
      <div className="stat-card">
        <div className="stat-icon">💰</div>
        <div className="stat-info">
          <span className="stat-number">${donationStats.totalAmount.toLocaleString()}</span>
          <span className="stat-label">Total Raised</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">🎯</div>
        <div className="stat-info">
          <span className="stat-number">{donationStats.totalDonations}</span>
          <span className="stat-label">Total Donations</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">📈</div>
        <div className="stat-info">
          <span className="stat-number">{Math.round((donationStats.monthlyProgress / donationStats.monthlyGoal) * 100)}%</span>
          <span className="stat-label">Monthly Goal</span>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon">⭐</div>
        <div className="stat-info">
          <span className="stat-number">{donationStats.topDonors.length}</span>
          <span className="stat-label">Top Supporters</span>
        </div>
      </div>
    </div>
  );

  const MonthlyGoalProgress = () => {
    const progress = (donationStats.monthlyProgress / donationStats.monthlyGoal) * 100;
    
    return (
      <div className="monthly-goal">
        <div className="goal-header">
          <h3>🎯 Monthly Goal</h3>
          <span className="goal-amount">${donationStats.monthlyProgress} / ${donationStats.monthlyGoal}</span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        
        <p className="goal-description">
          Help us reach our monthly goal to keep Fight Zone running and add new features!
        </p>
      </div>
    );
  };

  const TopSupporters = () => (
    <div className="top-supporters">
      <h3>🏆 Top Supporters</h3>
      <div className="supporters-list">
        {donationStats.topDonors.map((donor, index) => (
          <div key={donor.id} className="supporter-item">
            <div className="supporter-rank">
              <span className="rank-number">{index + 1}</span>
              <span className="rank-icon">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐'}
              </span>
            </div>
            <div className="supporter-info">
              <span className="supporter-name">{donor.name}</span>
              <span className="supporter-amount">${donor.totalAmount}</span>
            </div>
            <div className="supporter-badge">
              {donor.badge}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const RecentDonations = () => (
    <div className="recent-donations">
      <h3>💝 Recent Donations</h3>
      <div className="donations-list">
        {donationStats.recentDonations.map(donation => (
          <div key={donation.id} className="donation-item">
            <div className="donation-info">
              <span className="donor-name">{donation.donorName}</span>
              <span className="donation-amount">${donation.amount}</span>
            </div>
            {donation.message && (
              <p className="donation-message">"{donation.message}"</p>
            )}
            <span className="donation-time">
              {new Date(donation.timestamp).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="donation-system">
      <div className="donation-header">
        <h1>💝 Support Fight Zone</h1>
        <p>
          Help us keep Fight Zone running and add amazing new features! 
          Your support makes this community possible.
        </p>
        <button 
          className="donate-now-btn"
          onClick={() => setShowDonationModal(true)}
        >
          💝 Donate Now
        </button>
      </div>

      <DonationStats />
      <MonthlyGoalProgress />

      <div className="donation-content">
        <div className="content-section">
          <h2>Why Support Fight Zone?</h2>
          <div className="reasons-grid">
            <div className="reason-card">
              <div className="reason-icon">🚀</div>
              <h3>Keep It Running</h3>
              <p>Help cover server costs and keep the platform online 24/7</p>
            </div>
            
            <div className="reason-card">
              <div className="reason-icon">✨</div>
              <h3>New Features</h3>
              <p>Fund development of new features and improvements</p>
            </div>
            
            <div className="reason-card">
              <div className="reason-icon">🎨</div>
              <h3>Better Design</h3>
              <p>Improve the user interface and user experience</p>
            </div>
            
            <div className="reason-card">
              <div className="reason-icon">🛡️</div>
              <h3>Security & Privacy</h3>
              <p>Enhance security measures and protect user data</p>
            </div>
          </div>
        </div>

        <div className="content-section">
          <h2>What You Get</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <span className="benefit-icon">🎖️</span>
              <span className="benefit-text">Supporter Badge on Profile</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💬</span>
              <span className="benefit-text">Exclusive Discord Role</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🎯</span>
              <span className="benefit-text">Early Access to Features</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💎</span>
              <span className="benefit-text">Special Profile Themes</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🏆</span>
              <span className="benefit-text">Recognition on Leaderboard</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">❤️</span>
              <span className="benefit-text">Our Eternal Gratitude</span>
            </div>
          </div>
        </div>

        <div className="donation-sections">
          <TopSupporters />
          <RecentDonations />
        </div>
      </div>

      {showDonationModal && <DonationModal />}
    </div>
  );
};

export default DonationSystem;