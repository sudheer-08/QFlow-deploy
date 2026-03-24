const isNonEmptyString = (value, maxLength = 500) => {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
};

const isEmail = (value) => {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
};

const isPhone = (value) => {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/[^0-9]/g, '');
  return digits.length >= 10 && digits.length <= 15;
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
  isEmail,
  isPhone,
  isIsoDate,
  isTimeHHMM,
  assert
};
