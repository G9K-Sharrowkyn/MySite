import { assertProductionRuntimeConfiguration } from '../config/runtimeConfig.js';

describe('Production runtime configuration', () => {
  const original = {};
  const keys = [
    'NODE_ENV',
    'JWT_SECRET',
    'FRONTEND_URL',
    'API_ORIGIN',
    'PRIMARY_ADMIN_EMAIL'
  ];

  beforeEach(() => {
    keys.forEach((key) => {
      original[key] = process.env[key];
    });
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'runtime-config-test-secret-at-least-32-characters';
    process.env.FRONTEND_URL = 'https://www.example.com';
    process.env.PRIMARY_ADMIN_EMAIL = 'owner@example.com';
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
});
