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

  if (!readValue('UPLOADS_DIR')) {
    throw new Error('UPLOADS_DIR must point to persistent storage in production.');
  }

  const tronRole = readValue('TRON_REALTIME_ROLE') || 'authority';
  if (!['authority', 'disabled'].includes(tronRole)) {
    throw new Error('TRON_REALTIME_ROLE must be authority or disabled.');
  }

  const workerCount = Number.parseInt(
    readValue('WEB_CONCURRENCY') || readValue('NODE_APP_INSTANCE_COUNT') || '1',
    10
  );
  if (tronRole === 'authority' && Number.isFinite(workerCount) && workerCount > 1) {
    throw new Error(
      'TRON rooms require one authoritative realtime process. Run the TRON authority with WEB_CONCURRENCY=1 and set TRON_REALTIME_ROLE=disabled on additional API processes.'
    );
  }

  const backgroundJobsRole = readValue('BACKGROUND_JOBS_ROLE') || 'authority';
  if (!['authority', 'disabled'].includes(backgroundJobsRole)) {
    throw new Error('BACKGROUND_JOBS_ROLE must be authority or disabled.');
  }
  if (
    backgroundJobsRole === 'authority' &&
    Number.isFinite(workerCount) &&
    workerCount > 1
  ) {
    throw new Error(
      'Scheduled jobs require one authority process. Run it with WEB_CONCURRENCY=1 and set BACKGROUND_JOBS_ROLE=disabled on additional API processes.'
    );
  }

  const multiInstance = readValue('MULTI_INSTANCE').toLowerCase() === 'true';
  if ((multiInstance || workerCount > 1) && !readValue('REDIS_URL')) {
    throw new Error(
      'REDIS_URL is required when MULTI_INSTANCE=true or more than one Node worker is configured.'
    );
  }
};

export const isTronRealtimeAuthority = () =>
  (readValue('TRON_REALTIME_ROLE') || 'authority') === 'authority';

export const isBackgroundJobsAuthority = () =>
  (readValue('BACKGROUND_JOBS_ROLE') || 'authority') === 'authority';
