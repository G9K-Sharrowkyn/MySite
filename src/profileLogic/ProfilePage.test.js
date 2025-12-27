import React from 'react';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import ProfilePage from './ProfilePage';
import { LanguageContext } from '../i18n/LanguageContext';
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

const renderWithLanguage = (ui) => {
  const value = {
    currentLanguage: 'en',
    changeLanguage: jest.fn(),
    isDarkMode: true,
    toggleDarkMode: jest.fn(),
    t: (key) => key
  };
  return render(
    <LanguageContext.Provider value={value}>{ui}</LanguageContext.Provider>
  );
};

describe('ProfilePage component', () => {
  test('renders ProfilePage component without crashing', () => {
    __setMockParams({ userId: 'me' });
    renderWithLanguage(<ProfilePage />);
    expect(screen.getByText(/profileNotFound/i)).toBeInTheDocument();
  });
});
