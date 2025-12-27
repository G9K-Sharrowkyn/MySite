import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App component', () => {
  test('renders App component without crashing', () => {
    render(<App />);
    expect(screen.getByText(/GeekFights/i)).toBeInTheDocument();
  });
});
