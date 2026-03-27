const isNonEmptyString = (value, maxLength = 500) => {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const isEmail = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = normalizeEmail(value);
  if (!normalized) return false;

  // Practical email validation that blocks obvious malformed values.
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(normalized);
};

const normalizePhone = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasPlusPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;

  return hasPlusPrefix ? `+${digits}` : digits;
};

const isPhone = (value) => {
  return Boolean(normalizePhone(value));
};

const isSubdomain = (value) => {
  if (typeof value !== 'string') return false;
  return /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(value.trim().toLowerCase());
};

const isUuid = (value) => {
  if (typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
};

const isStrongPassword = (value) => {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > 128) return false;

  // At least one lowercase, one uppercase, one digit and one special character.
  return /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
};

const isIsoDate = (value) => {
  if (typeof value !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const isTimeHHMM = (value) => {
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

const assert = (condition, message) => {
  if (!condition) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
};

module.exports = {
  isNonEmptyString,
  normalizeEmail,
  isEmail,
  normalizePhone,
  isPhone,
  isSubdomain,
  isUuid,
  isStrongPassword,
  isIsoDate,
  isTimeHHMM,
  assert
};
