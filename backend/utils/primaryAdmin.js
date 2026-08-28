export const normalizeEmail = (value) =>
  String(value || '').trim().toLowerCase();

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);

export const getPrimaryAdminEmails = () => {
  const configured = parseCsv(process.env.PRIMARY_ADMIN_EMAIL || '');
  return new Set(configured);
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
