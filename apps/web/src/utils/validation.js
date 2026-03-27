export const isNonEmptyString = (value, maxLength = 500) => {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
};

export const normalizeEmail = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

export const isEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email) return false;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(email);
};

export const normalizePhone = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const hasPlusPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return '';

  return hasPlusPrefix ? `+${digits}` : digits;
};

export const isPhone = (value) => {
  return Boolean(normalizePhone(value));
};

export const isTimeHHMM = (value) => {
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

export const isStrongPassword = (value) => {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > 128) return false;

  return /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
};

export const getStrongPasswordMessage = () => {
  return 'Password must be 8+ chars with uppercase, lowercase, number, and special character.';
};
