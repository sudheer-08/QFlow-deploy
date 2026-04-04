const {
  isEmail,
  normalizePhone,
  isUuid,
  isSubdomain,
  isTimeHHMM,
  isIsoDate
} = require('./validation');

describe('validation utils', () => {
  test('accepts and rejects email formats correctly', () => {
    expect(isEmail('admin@citycare.com')).toBe(true);
    expect(isEmail('bad-email')).toBe(false);
  });

  test('normalizes phone numbers', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('98765 43210')).toBe('9876543210');
    expect(normalizePhone('123')).toBeNull();
  });

  test('validates uuid values', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  test('validates subdomain format', () => {
    expect(isSubdomain('citycare')).toBe(true);
    expect(isSubdomain('city-care')).toBe(true);
    expect(isSubdomain('-bad')).toBe(false);
  });

  test('validates date and time formats', () => {
    expect(isIsoDate('2026-04-04')).toBe(true);
    expect(isIsoDate('04-04-2026')).toBe(false);
    expect(isTimeHHMM('09:30')).toBe(true);
    expect(isTimeHHMM('25:99')).toBe(false);
  });
});
