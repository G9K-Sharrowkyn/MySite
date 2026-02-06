import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CoinBalance from './CoinBalance';
import './TransactionHistory.css';

const TransactionHistory = ({ userId }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(null);

  const token = localStorage.getItem('token');
  const currentUserId = userId || localStorage.getItem('userId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [transactionsResponse, statsResponse] = await Promise.all([
          axios.get(`/api/coins/transactions/${currentUserId}?page=${page}&limit=20`, {
            headers: token ? { 'x-auth-token': token } : {}
          }),
          axios.get(`/api/coins/stats/${currentUserId}`, {
            headers: token ? { 'x-auth-token': token } : {}
          })
        ]);

        setTransactions(transactionsResponse.data.transactions);
        setTotalPages(transactionsResponse.data.totalPages);
        setStats(statsResponse.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching transaction data:', err);
        setError('Failed to load transaction history');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUserId, page, token]);

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'earned':
      case 'daily_activity':
        return '🟢';
      case 'spent':
        return '🔴';
      case 'bet_won':
        return '🏆';
      case 'bet_lost':
        return '💸';
      case 'purchase':
        return '🛒';
      default:
        return '💰';
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'earned':
      case 'daily_activity':
      case 'bet_won':
        return 'positive';
      case 'spent':
      case 'bet_lost':
        return 'negative';
      default:
        return 'neutral';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="transaction-history">
        <div className="loading">Loading transaction history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transaction-history">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="transaction-history">
      <div className="history-header">
        <h2>🪙 Eurodolary Transaction History</h2>
        <CoinBalance userId={currentUserId} showLabel={true} className="profile" />
      </div>

      {stats && (
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-label">Total Earned</div>
            <div className="stat-value positive">🟢 {stats.totalEarned?.toLocaleString() || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value negative">🔴 {stats.totalSpent?.toLocaleString() || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Current Balance</div>
            <div className="stat-value neutral">💰 {stats.currentBalance?.toLocaleString() || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Transactions</div>
            <div className="stat-value neutral">📊 {stats.totalTransactions || 0}</div>
          </div>
        </div>
      )}

      <div className="transactions-section">
        <h3>Recent Transactions</h3>
        
        {transactions.length > 0 ? (
          <div className="transactions-list">
            {transactions.map(transaction => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-icon">
                  {getTransactionIcon(transaction.type)}
                </div>
                
                <div className="transaction-details">
                  <div className="transaction-description">
                    {transaction.description}
                  </div>
                  <div className="transaction-date">
                    {formatDate(transaction.createdAt)}
                  </div>
                </div>
                
                <div className="transaction-amount">
                  <span className={`amount ${getTransactionColor(transaction.type)}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                  </span>
                  <div className="balance-after">
                    Balance: {transaction.balance?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-transactions">
            <p>No transactions found</p>
            <p className="subtitle">Start earning eurodolary by posting, commenting, and voting!</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              ← Previous
            </button>
            
            <span className="page-info">
              Page {page} of {totalPages}
            </span>
            
            <button
              className="page-btn"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <div className="earning-tips">
        <h3>💡 How to Earn Eurodolary</h3>
        <div className="tips-grid">
          <div className="tip-item">
            <span className="tip-icon">📝</span>
            <div className="tip-content">
              <strong>First Post of the Day:</strong> 100 eurodolary
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">💬</span>
            <div className="tip-content">
              <strong>First Comment of the Day:</strong> 50 eurodolary
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">👍</span>
            <div className="tip-content">
              <strong>First Reaction of the Day:</strong> 50 eurodolary
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔑</span>
            <div className="tip-content">
              <strong>First Login of the Day:</strong> 50 eurodolary
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">✉️</span>
            <div className="tip-content">
              <strong>First Message of the Day:</strong> 50 eurodolary
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🎯</span>
            <div className="tip-content">
              <strong>Win Bets:</strong> Variable winnings
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory; 

