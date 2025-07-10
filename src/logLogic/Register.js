import React, { useState } from 'react';
import axios from 'axios';
import Notification from '../notificationLogic/Notification';
import '../Auth.css'; // Wspólny plik CSS dla autentykacji

const Register = ({ setIsLoggedIn }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    consent: {
      privacyPolicy: false,
      termsOfService: false,
      cookies: false,
      marketingEmails: false
    }
  });
  const [notification, setNotification] = useState(null);

  const { username, email, password, password2, consent } = formData;

  const onChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onConsentChange = (e) => {
    setFormData({
      ...formData,
      consent: {
        ...formData.consent,
        [e.target.name]: e.target.checked
      }
    });
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
  };

  const clearNotification = () => {
    setNotification(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== password2) {
      showNotification('Hasła nie pasują do siebie', 'error');
      return;
    }

    if (!consent.privacyPolicy || !consent.termsOfService || !consent.cookies) {
      showNotification('Musisz zaakceptować wymagane zgody', 'error');
      return;
    }

    try {
      const newUser = {
        username,
        email,
        password,
        consent
      };

      const config = {
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const body = JSON.stringify(newUser);

      const res = await axios.post('/api/auth/register', body, config);
      console.log('Register response:', res.data);
      if (!res.data.userId) {
        showNotification('Błąd rejestracji: brak userId w odpowiedzi serwera.', 'error');
        return;
      }
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('userId', res.data.userId);
      setIsLoggedIn(true);
      showNotification('Rejestracja udana!', 'success');
    } catch (err) {
      console.error(err.response.data);
      const errorMsg = err.response?.data?.message || err.response?.data?.msg || 'Błąd rejestracji';
      showNotification(errorMsg, 'error');
    }
  };

  return (
    <div className="auth-container">
      <h1>Zarejestruj się</h1>
      <Notification message={notification?.message} type={notification?.type} onClose={clearNotification} />
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <input
            type="text"
            placeholder="Nazwa użytkownika"
            name="username"
            value={username}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="email"
            placeholder="Adres Email"
            name="email"
            value={email}
            onChange={onChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            placeholder="Hasło"
            name="password"
            value={password}
            onChange={onChange}
            minLength="6"
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            placeholder="Potwierdź Hasło"
            name="password2"
            value={password2}
            onChange={onChange}
            minLength="6"
            required
          />
        </div>

        {/* GDPR Consent Section */}
        <div className="consent-section">
          <h3>Zgody wymagane</h3>
          
          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                name="privacyPolicy"
                checked={consent.privacyPolicy}
                onChange={onConsentChange}
                required
              />
              Akceptuję <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">Politykę Prywatności</a> *
            </label>
          </div>

          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                name="termsOfService"
                checked={consent.termsOfService}
                onChange={onConsentChange}
                required
              />
              Akceptuję <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">Regulamin</a> *
            </label>
          </div>

          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                name="cookies"
                checked={consent.cookies}
                onChange={onConsentChange}
                required
              />
              Akceptuję wykorzystanie <a href="/cookies" target="_blank" rel="noopener noreferrer">plików cookies</a> *
            </label>
          </div>

          <div className="consent-item">
            <label>
              <input
                type="checkbox"
                name="marketingEmails"
                checked={consent.marketingEmails}
                onChange={onConsentChange}
              />
              Wyrażam zgodę na otrzymywanie wiadomości marketingowych (opcjonalne)
            </label>
          </div>

          <p className="consent-note">* - pola wymagane</p>
        </div>

        <input type="submit" value="Zarejestruj" className="btn btn-primary" />
      </form>
    </div>
  );
};

export default Register;
