import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [donationCurrency, setDonationCurrency] = useState('USD');
  const [donationNotice, setDonationNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const presetAmounts = [1, 3, 5, 10, 25, 50];

  useEffect(() => {
    fetchDonationStats();
    fetchDonationConfig();
  }, []);

  const fetchDonationStats = async () => {
    try {
      const response = await axios.get('/api/donations/stats');
      setDonationStats(response.data);
    } catch (error) {
      console.error('Error fetching donation stats:', error);
    }
  };

  const fetchDonationConfig = async () => {
    try {
      const response = await axios.get('/api/donations/config');
      const providers = Array.isArray(response.data?.providers)
        ? response.data.providers
        : [];
      setPaymentProviders(providers);
      setSelectedPlatform(providers[0]?.id || '');
      setDonationCurrency(
        /^[A-Z]{3}$/.test(response.data?.currency)
          ? response.data.currency
          : 'USD'
      );
    } catch (error) {
      console.error('Error fetching donation configuration:', error);
      setPaymentProviders([]);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: donationCurrency,
      maximumFractionDigits: 2
    }).format(Number(amount) || 0);

  const handleDonation = async () => {
    setIsLoading(true);
    
    try {
      const amount = customAmount ? parseFloat(customAmount) : donationAmount;
      
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        setDonationNotice('Please enter a valid donation amount.');
        return;
      }

      const paymentUrl = getPaymentUrl(amount, donationMessage);
      if (!paymentUrl) {
        setDonationNotice('No verified payment provider is configured yet.');
        return;
      }
      const paymentWindow = window.open(
        paymentUrl,
        '_blank',
        'noopener,noreferrer'
      );
      if (!paymentWindow) {
        setDonationNotice('Allow pop-ups for this site to open the payment provider.');
        return;
      }

      // Reset form
      setDonationAmount(5);
      setCustomAmount('');
      setDonationMessage('');
      setShowDonationModal(false);
      
      setDonationNotice(
        'Payment provider opened. The donation is counted only after staff verifies its confirmation.'
      );
    } catch (error) {
      console.error('Error processing donation:', error);
      setDonationNotice('Unable to open the payment provider. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentUrl = (amount, message) => {
    const provider = paymentProviders.find(
      (entry) => entry.id === selectedPlatform
    );
    if (!provider?.url) return '';
    try {
      const url = new URL(provider.url);
      url.searchParams.set('amount', String(amount));
      url.searchParams.set('currency_code', donationCurrency);
      url.searchParams.set('message', message || 'Support for VersusVerseVault');
      return url.toString();
    } catch (_error) {
      return '';
    }
  };

  const DonationModal = () => (
    <div className="donation-modal-overlay" onClick={() => setShowDonationModal(false)}>
      <div className="donation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💝 Support VersusVerseVault</h2>
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
                  {formatCurrency(amount)}
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
              {paymentProviders.map((provider) => (
                <label className="platform-option" key={provider.id}>
                  <input
                    type="radio"
                    name="platform"
                    value={provider.id}
                    checked={selectedPlatform === provider.id}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                  />
                  <div className="platform-info">
                    <span>{provider.name}</span>
                  </div>
                </label>
              ))}
              {paymentProviders.length === 0 && (
                <p>Donations are temporarily unavailable.</p>
              )}
            </div>
          </div>

          <div className="donation-summary">
            <div className="summary-item">
              <span>Amount:</span>
              <span className="amount">
                {formatCurrency(customAmount || donationAmount)}
              </span>
            </div>
            <div className="summary-item">
              <span>Platform:</span>
              <span className="platform">
                {paymentProviders.find((entry) => entry.id === selectedPlatform)?.name ||
                  'Unavailable'}
              </span>
            </div>
          </div>
          {donationNotice && (
            <p className="donation-notice" role="status">
              {donationNotice}
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button 
            className="donate-btn"
            onClick={handleDonation}
            disabled={isLoading || paymentProviders.length === 0}
          >
            {isLoading
              ? 'Processing...'
              : `Donate ${formatCurrency(customAmount || donationAmount)}`}
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
          <span className="stat-number">
            {formatCurrency(donationStats.totalAmount)}
          </span>
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
          <span className="goal-amount">
            {formatCurrency(donationStats.monthlyProgress)} /{' '}
            {formatCurrency(donationStats.monthlyGoal)}
          </span>
        </div>
        
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        
        <p className="goal-description">
          Help us reach our monthly goal to keep VersusVerseVault running and add new features!
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
              <span className="supporter-amount">
                {formatCurrency(donor.totalAmount)}
              </span>
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
              <span className="donation-amount">
                {formatCurrency(donation.amount)}
              </span>
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
        <h1>💝 Support VersusVerseVault</h1>
        <p>
          Help us keep VersusVerseVault running and add amazing new features!
          Your support makes this community possible.
        </p>
        <button 
          className="donate-now-btn"
          onClick={() => {
            setDonationNotice('');
            setShowDonationModal(true);
          }}
          disabled={paymentProviders.length === 0}
        >
          💝 Donate Now
        </button>
        {donationNotice && <p className="donation-notice">{donationNotice}</p>}
        {paymentProviders.length === 0 && (
          <p className="donation-notice">
            Donations are disabled until a verified provider is configured.
          </p>
        )}
      </div>

      <DonationStats />
      <MonthlyGoalProgress />

      <div className="donation-content">
        <div className="content-section">
          <h2>Why Support VersusVerseVault?</h2>
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
          <h2>Donation transparency</h2>
          <div className="benefits-grid">
            <div className="benefit-item">
              <span className="benefit-text">
                Payment is completed on the selected provider's website.
              </span>
            </div>
            <div className="benefit-item">
              <span className="benefit-text">
                Public totals include only donations verified by staff.
              </span>
            </div>
            <div className="benefit-item">
              <span className="benefit-text">
                A donation does not purchase in-app advantages or guaranteed rewards.
              </span>
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
