export const AUTH_COOKIE_NAME = 'vvv_session';
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader || !name) return null;
  const prefix = `${name}=`;
  const entry = String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch (_error) {
    return null;
  }
};

export const getAuthCookieToken = (cookieHeader) =>
  getCookieValue(cookieHeader, AUTH_COOKIE_NAME);

export const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/'
  });
};

export const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
};
