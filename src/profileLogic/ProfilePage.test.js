import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfilePage from './profileLogic/ProfilePage';

describe('ProfilePage component', () => {
  test('renders ProfilePage component without crashing', () => {
    render(<ProfilePage />);
    // Assuming ProfilePage has a heading or element with text 'Profile'
    const profileElement = screen.getByText(/profile/i);
    expect(profileElement).toBeInTheDocument();
  });
});
