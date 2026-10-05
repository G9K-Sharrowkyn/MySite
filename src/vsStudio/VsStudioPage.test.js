import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthContext } from '../auth/AuthContext';
import VsStudioPage from './VsStudioPage';

test('keeps VS Graphic Studio loaded during the StrictMode effect cycle', () => {
  render(
    <StrictMode>
      <VsStudioPage />
    </StrictMode>,
  );

  expect(screen.getByTitle('VS Graphic Studio')).toHaveAttribute(
    'src',
    '/apps/vs-studio/index.html?v=20260919-darkseid-3',
  );
});

test('passes moderator access to the embedded studio', () => {
  render(
    <AuthContext.Provider value={{ user: { role: 'moderator' } }}>
      <VsStudioPage />
    </AuthContext.Provider>,
  );

  const iframe = screen.getByTitle('VS Graphic Studio');
  const postMessage = jest.spyOn(iframe.contentWindow, 'postMessage');
  fireEvent.load(iframe);

  expect(postMessage).toHaveBeenCalledWith(
    { type: 'vvv-studio-access', role: 'moderator', language: 'en' },
    window.location.origin,
  );
});

test('resends access after the embedded studio announces it is ready', () => {
  render(
    <AuthContext.Provider value={{ user: { role: 'admin' } }}>
      <VsStudioPage />
    </AuthContext.Provider>,
  );

  const iframe = screen.getByTitle('VS Graphic Studio');
  const postMessage = jest.spyOn(iframe.contentWindow, 'postMessage');
  fireEvent(
    window,
    new MessageEvent('message', {
      data: { type: 'vvv-studio-ready' },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }),
  );

  expect(postMessage).toHaveBeenCalledWith(
    { type: 'vvv-studio-access', role: 'admin', language: 'en' },
    window.location.origin,
  );
});

test('fills the viewport while the embedded Darkseid sequence is active', () => {
  const onImmersiveChange = jest.fn();
  render(<VsStudioPage onImmersiveChange={onImmersiveChange} />);

  const iframe = screen.getByTitle('VS Graphic Studio');
  fireEvent(
    window,
    new MessageEvent('message', {
      data: { type: 'vvv-studio-darkseid-mode', active: true },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }),
  );

  expect(screen.getByRole('main')).toHaveClass('vs-studio-page--immersive');
  expect(onImmersiveChange).toHaveBeenCalledWith(true);
});

test('forwards Escape to the embedded Darkseid sequence', () => {
  render(<VsStudioPage />);

  const iframe = screen.getByTitle('VS Graphic Studio');
  fireEvent(
    window,
    new MessageEvent('message', {
      data: { type: 'vvv-studio-darkseid-mode', active: true },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }),
  );
  const postMessage = jest.spyOn(iframe.contentWindow, 'postMessage');
  fireEvent.keyDown(window, { key: 'Escape' });

  expect(postMessage).toHaveBeenCalledWith(
    { type: 'vvv-studio-exit-darkseid' },
    window.location.origin,
  );
});
