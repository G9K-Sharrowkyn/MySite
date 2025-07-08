import React from 'react';
import { render, screen } from '@testing-library/react';
import PostPage from './PostPage';

describe('PostPage component', () => {
  test('renders PostPage component without crashing', () => {
    render(<PostPage />);
    // Assuming PostPage has a heading or element with text 'Post'
    const postElement = screen.getByText(/post/i);
    expect(postElement).toBeInTheDocument();
  });
});
