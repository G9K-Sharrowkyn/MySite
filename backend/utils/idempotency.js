const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export const getIdempotencyKey = (req) => {
  const rawValue = req.get('Idempotency-Key');
  if (rawValue === undefined) return null;

  const value = String(rawValue).trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(value)) {
    const error = new Error(
      'Idempotency-Key must contain 8-128 letters, numbers, dots, underscores, colons or dashes'
    );
    error.code = 'INVALID_IDEMPOTENCY_KEY';
    throw error;
  }

  return value;
};
