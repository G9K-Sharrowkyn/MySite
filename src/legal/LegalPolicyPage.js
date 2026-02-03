import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './LegalPolicyPage.css';

const LegalPolicyPage = ({ endpoint, title }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await axios.get(endpoint);
        setContent(response.data?.content || '');
        setLastUpdated(response.data?.lastUpdated || null);
      } catch (e) {
        setError('Failed to load policy content.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [endpoint]);

  return (
    <div className="legal-page">
      <div className="legal-card">
        <h1>{title}</h1>
        {lastUpdated && (
          <p className="legal-updated">
            Last updated: {new Date(lastUpdated).toLocaleDateString()}
          </p>
        )}
        {loading && <p>Loading...</p>}
        {error && <p className="legal-error">{error}</p>}
        {!loading && !error && (
          <pre className="legal-content">{content}</pre>
        )}
      </div>
    </div>
  );
};

export default LegalPolicyPage;

