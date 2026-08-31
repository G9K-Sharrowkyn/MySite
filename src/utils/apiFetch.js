const normalizeApiBaseUrl = () => {
  const configured = String(process.env.REACT_APP_API_URL || '').trim();
  if (!/^https?:\/\//i.test(configured)) return '';

  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
  }

  return configured.replace(/\/$/, '');
};

export const resolveApiUrl = (path) => {
  const rawPath = String(path || '');
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const baseUrl = normalizeApiBaseUrl();
  if (!baseUrl) return rawPath;
  return `${baseUrl}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
};

export const apiFetch = (path, options = {}) =>
  fetch(resolveApiUrl(path), {
    ...options,
    credentials: options.credentials || 'include'
  });
