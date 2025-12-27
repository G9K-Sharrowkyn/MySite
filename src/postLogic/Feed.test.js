import React from 'react';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import Feed from './Feed';
import { LanguageContext } from '../i18n/LanguageContext';
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

describe('Feed component', () => {
  test('renders Feed component without crashing', async () => {
    renderWithLanguage(<Feed />);
    expect(await screen.findByText(/noPosts/i)).toBeInTheDocument();
  });
});
