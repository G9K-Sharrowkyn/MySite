import React from 'react';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import PostPage from './PostPage';
import { LanguageContext } from '../i18n/LanguageContext';
import { AuthContext } from '../auth/AuthContext';
import { __setMockParams } from 'react-router-dom';
import { createMockAxios } from '../testUtils/mockAxios';

jest.mock('axios');

beforeEach(() => {
  const mockAxios = createMockAxios();
  axios.get.mockImplementation(mockAxios.get);
  axios.post.mockImplementation(mockAxios.post);
  axios.put.mockImplementation(mockAxios.put);
  axios.delete.mockImplementation(mockAxios.delete);
  axios.create.mockImplementation(mockAxios.create);
});

const renderWithProviders = (ui) => {
  const languageValue = {
    currentLanguage: 'en',
    changeLanguage: jest.fn(),
    isDarkMode: true,
    toggleDarkMode: jest.fn(),
    t: (key) => key
  };
  const authValue = {
    user: null,
    token: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    updateUser: jest.fn()
  };
  return render(
    <AuthContext.Provider value={authValue}>
      <LanguageContext.Provider value={languageValue}>
        {ui}
      </LanguageContext.Provider>
    </AuthContext.Provider>
  );
};

describe('PostPage component', () => {
  test('renders PostPage component without crashing', async () => {
    __setMockParams({ postId: 'mock-post' });
    renderWithProviders(<PostPage />);
    expect(await screen.findByText(/mock post/i)).toBeInTheDocument();
  });
});
