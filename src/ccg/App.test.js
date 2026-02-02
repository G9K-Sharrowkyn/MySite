import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import App from './App';

const renderWithProviders = (ui, { user = null, token = null } = {}) => {
  return render(
    <AuthContext.Provider value={{ user, token, loading: false }}>
      <MemoryRouter basename="/ccg" initialEntries={['/']}>
        {ui}
      </MemoryRouter>
    </AuthContext.Provider>
  );
};

test('renders CCG lobby when authorized', () => {
  renderWithProviders(<App />, {
    user: { username: 'moderator', role: 'moderator' },
    token: 'test-token'
  });

  expect(screen.getByText(/Lobby/i)).toBeInTheDocument();
});
