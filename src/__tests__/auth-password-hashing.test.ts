/**
 * Unit tests for password hashing with bcrypt
 * Run with test runner configured in Story 0.4
 */
import bcrypt from 'bcryptjs';

describe('Password hashing', () => {
  it('hashes a password (not plaintext)', async () => {
    const plain = 'mypassword';
    const hashed = await bcrypt.hash(plain, 12);
    expect(hashed).not.toBe(plain);
    expect(hashed).toMatch(/^\$2[ab]\$/);
  });

  it('validates correct password against hash', async () => {
    const plain = 'mypassword';
    const hashed = await bcrypt.hash(plain, 12);
    const match = await bcrypt.compare(plain, hashed);
    expect(match).toBe(true);
  });

  it('rejects wrong password against hash', async () => {
    const plain = 'mypassword';
    const hashed = await bcrypt.hash(plain, 12);
    const match = await bcrypt.compare('wrongpassword', hashed);
    expect(match).toBe(false);
  });
});
