import {
  assertProductionRuntimeConfiguration,
  isBackgroundJobsAuthority
} from '../config/runtimeConfig.js';

describe('Production runtime configuration', () => {
  const original = {};
  const keys = [
    'NODE_ENV',
    'JWT_SECRET',
    'FRONTEND_URL',
    'API_ORIGIN',
    'PRIMARY_ADMIN_EMAIL',
    'UPLOADS_DIR',
    'TRON_REALTIME_ROLE',
    'BACKGROUND_JOBS_ROLE',
    'WEB_CONCURRENCY',
    'NODE_APP_INSTANCE_COUNT',
    'MULTI_INSTANCE',
    'REDIS_URL'
  ];

  beforeEach(() => {
    keys.forEach((key) => {
      original[key] = process.env[key];
    });
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'runtime-config-test-secret-at-least-32-characters';
    process.env.FRONTEND_URL = 'https://www.example.com';
    process.env.PRIMARY_ADMIN_EMAIL = 'owner@example.com';
    process.env.UPLOADS_DIR = '/srv/versusversevault/uploads';
    process.env.TRON_REALTIME_ROLE = 'authority';
    process.env.BACKGROUND_JOBS_ROLE = 'authority';
    process.env.WEB_CONCURRENCY = '1';
    process.env.MULTI_INSTANCE = 'false';
    delete process.env.API_ORIGIN;
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  });

  test('requires an explicit trusted public API origin', () => {
    expect(() => assertProductionRuntimeConfiguration()).toThrow(/API_ORIGIN/);
  });

  test('accepts complete HTTPS origins', () => {
    process.env.API_ORIGIN = 'https://api.example.com';
    expect(() => assertProductionRuntimeConfiguration()).not.toThrow();
  });

  test('rejects multiple in-memory TRON authorities in one clustered app', () => {
    process.env.API_ORIGIN = 'https://api.example.com';
    process.env.WEB_CONCURRENCY = '2';
    expect(() => assertProductionRuntimeConfiguration()).toThrow(
      /one authoritative realtime process/i
    );
  });

  test('allows horizontally scaled API workers when TRON is delegated', () => {
    process.env.API_ORIGIN = 'https://api.example.com';
    process.env.WEB_CONCURRENCY = '4';
    process.env.TRON_REALTIME_ROLE = 'disabled';
    process.env.BACKGROUND_JOBS_ROLE = 'disabled';
    process.env.REDIS_URL = 'redis://cache.internal:6379';
    expect(() => assertProductionRuntimeConfiguration()).not.toThrow();
  });

  test('requires Redis for a multi-instance deployment', () => {
    process.env.API_ORIGIN = 'https://api.example.com';
    process.env.TRON_REALTIME_ROLE = 'disabled';
    process.env.MULTI_INSTANCE = 'true';
    delete process.env.REDIS_URL;
    expect(() => assertProductionRuntimeConfiguration()).toThrow(/REDIS_URL/);
  });

  test('rejects duplicate tournament scheduler authorities', () => {
    process.env.API_ORIGIN = 'https://api.example.com';
    process.env.TRON_REALTIME_ROLE = 'disabled';
    process.env.WEB_CONCURRENCY = '2';
    expect(() => assertProductionRuntimeConfiguration()).toThrow(
      /scheduled jobs require one authority process/i
    );
  });

  test('disables scheduled jobs on ordinary API workers', () => {
    process.env.BACKGROUND_JOBS_ROLE = 'disabled';
    expect(isBackgroundJobsAuthority()).toBe(false);
    process.env.BACKGROUND_JOBS_ROLE = 'authority';
    expect(isBackgroundJobsAuthority()).toBe(true);
  });
});
