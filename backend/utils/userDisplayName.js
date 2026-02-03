export const normalizeDisplayName = (value) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
};

export const getUserDisplayName = (user) => {
  if (!user) return 'User';
  const profile = user.profile || {};
  const profileDisplayName = normalizeDisplayName(profile.displayName);
  if (profileDisplayName) return profileDisplayName;
  const rootDisplayName = normalizeDisplayName(user.displayName);
  if (rootDisplayName) return rootDisplayName;
  const username = normalizeDisplayName(user.username);
  return username || 'User';
};

