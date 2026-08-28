import React from 'react';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import App from './App';

jest.mock('axios');

describe('App component', () => {
  test('renders App component without crashing', async () => {
    axios.get.mockRejectedValue({ response: { status: 401 } });
    axios.post.mockResolvedValue({ data: {} });
    global.fetch = jest.fn().mockResolvedValue({
      text: async () => '<html>test version</html>'
    });
    render(<App />);
    expect((await screen.findAllByAltText(/VersusVerseVault/i)).length).toBeGreaterThan(0);
  });
});
