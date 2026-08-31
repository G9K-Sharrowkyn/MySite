import { resolveApiUrl } from './apiFetch';

describe('resolveApiUrl', () => {
  test('keeps relative API paths during local development', () => {
    expect(resolveApiUrl('/api/health')).toBe('/api/health');
  });

  test('never rewrites an already absolute URL', () => {
    expect(resolveApiUrl('https://cdn.example.com/file.jpg')).toBe(
      'https://cdn.example.com/file.jpg'
    );
  });
});
