const FALLBACK_PRIMARY_ADMIN_EMAIL = 'ak4maaru@gmail.com';

export const normalizeEmail = (value) =>
  String(value || '').trim().toLowerCase();

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

export const getPrimaryAdminEmails = () => {
  const configured = parseCsv(process.env.PRIMARY_ADMIN_EMAIL || '');
  const emails = new Set(configured);
  emails.add(FALLBACK_PRIMARY_ADMIN_EMAIL);
  return emails;
};

export const isPrimaryAdminEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getPrimaryAdminEmails().has(normalized);
};

export const ensurePrimaryAdminRole = (user) => {
  if (!user || !isPrimaryAdminEmail(user.email)) {
    return false;
  }
  if (user.role === 'admin') {
    return false;
  }
  user.role = 'admin';
  user.updatedAt = new Date().toISOString();
  return true;
};
