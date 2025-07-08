import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App component', () => {
  test('renders App component without crashing', () => {
    render(<App />);
    // Assuming App component has a text or element with 'app' or similar
    const appElement = screen.getByText(/app/i);
    expect(appElement).toBeInTheDocument();
  });
});
