export const getUserDisplayName = (userLike) => {
  if (!userLike) return 'User';
  const value =
    userLike.displayName ||
    userLike.authorDisplayName ||
    userLike.profile?.displayName ||
    userLike.username ||
    userLike.authorUsername;
  if (typeof value !== 'string') return 'User';
  const normalized = value.trim();
  return normalized || 'User';
};

