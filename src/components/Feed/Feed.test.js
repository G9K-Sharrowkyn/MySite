import React from 'react';
import { render, screen } from '@testing-library/react';
import Feed from './Feed';

describe('Feed component', () => {
  test('renders Feed component without crashing', () => {
    render(<Feed />);
    // Assuming Feed component has a heading or element with text 'Feed'
    const feedElement = screen.getByText(/feed/i);
    expect(feedElement).toBeInTheDocument();
  });
});
