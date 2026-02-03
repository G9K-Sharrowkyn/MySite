import React from 'react';
import { Link } from 'react-router-dom';
import './LegalQuickLinks.css';

const LegalQuickLinks = () => (
  <div className="legal-quick-links">
    <Link to="/privacy-policy">Privacy Policy</Link>
    <span>•</span>
    <Link to="/terms">Terms</Link>
    <span>•</span>
    <Link to="/cookie-policy">Cookie Policy</Link>
  </div>
);

export default LegalQuickLinks;

