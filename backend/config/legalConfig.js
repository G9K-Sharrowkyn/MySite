const readValue = (name, fallback = '') =>
  String(process.env[name] || fallback).trim();

export const getLegalConfig = () => ({
  operatorName: readValue('LEGAL_ENTITY_NAME', 'VersusVerseVault operator'),
  privacyEmail: readValue('PRIVACY_CONTACT_EMAIL'),
  supportEmail: readValue('SUPPORT_CONTACT_EMAIL'),
  jurisdiction: readValue('LEGAL_JURISDICTION', 'the operator’s registered jurisdiction'),
  minimumAge: Number.parseInt(readValue('MINIMUM_AGE', '16'), 10) || 16,
  policyVersion: readValue('LEGAL_POLICY_VERSION', '2026-07-28')
});

export const assertProductionLegalConfiguration = () => {
  if (process.env.NODE_ENV !== 'production') return;
  const required = [
    'LEGAL_ENTITY_NAME',
    'PRIVACY_CONTACT_EMAIL',
    'SUPPORT_CONTACT_EMAIL',
    'LEGAL_JURISDICTION',
    'MINIMUM_AGE'
  ];
  const missing = required.filter((name) => !readValue(name));
  if (missing.length > 0) {
    throw new Error(
      `Production legal configuration is incomplete: ${missing.join(', ')}`
    );
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !emailPattern.test(readValue('PRIVACY_CONTACT_EMAIL')) ||
    !emailPattern.test(readValue('SUPPORT_CONTACT_EMAIL'))
  ) {
    throw new Error('Production legal contact addresses must be valid emails.');
  }
  const minimumAge = Number(readValue('MINIMUM_AGE'));
  if (!Number.isInteger(minimumAge) || minimumAge < 13 || minimumAge > 21) {
    throw new Error('MINIMUM_AGE must be an integer between 13 and 21.');
  }
};
