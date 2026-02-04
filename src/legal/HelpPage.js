import React from 'react';
import { Link } from 'react-router-dom';
import './HelpPage.css';

const HelpPage = () => {
  return (
    <div className="help-page">
      <div className="help-card">
        <h1>Help Center</h1>
        <p className="help-lead">
          Quick links for account, privacy, and policy information.
        </p>

        <div className="help-links">
          <Link to="/privacy-policy" className="help-link">
            Privacy Policy
          </Link>
          <Link to="/terms" className="help-link">
            Terms of Service
          </Link>
          <Link to="/cookie-policy" className="help-link">
            Cookie Policy
          </Link>
        </div>

        <p className="help-note">
          Need help from moderation? Use the report button on the site and include as much detail as possible.
        </p>
      </div>
    </div>
  );
};

export default HelpPage;
