const boundedInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const parsePagination = (
  query = {},
  { defaultLimit = 20, maxLimit = 100 } = {}
) => ({
  page: boundedInteger(query.page, 1, 1, 1_000_000),
  limit: boundedInteger(query.limit, defaultLimit, 1, maxLimit)
});

export const parseLimit = (value, { fallback = 10, max = 100 } = {}) =>
  boundedInteger(value, fallback, 1, max);
