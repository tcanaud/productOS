/**
 * Unit tests for auth validation logic
 * Run with test runner configured in Story 0.4
 */

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation
function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

describe('Email validation', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('noatsign')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('Password validation', () => {
  it('accepts passwords >= 8 characters', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('longpassword')).toBe(true);
  });

  it('rejects passwords < 8 characters', () => {
    expect(isValidPassword('short')).toBe(false);
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword('1234567')).toBe(false);
  });
});
