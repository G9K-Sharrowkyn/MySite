const readValue = (name) => String(process.env[name] || '').trim();

const isSecurePublicUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch (_error) {
    return false;
  }
};

const isEmailAddress = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

export const assertProductionRuntimeConfiguration = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = readValue('JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }

  if (!isSecurePublicUrl(readValue('FRONTEND_URL'))) {
    throw new Error('FRONTEND_URL must be a valid HTTPS URL in production.');
  }

  if (!isSecurePublicUrl(readValue('API_ORIGIN'))) {
    throw new Error('API_ORIGIN must be a valid HTTPS URL in production.');
  }

  if (!isEmailAddress(readValue('PRIMARY_ADMIN_EMAIL'))) {
    throw new Error(
      'PRIMARY_ADMIN_EMAIL must be a valid email address in production.'
    );
  }
};
