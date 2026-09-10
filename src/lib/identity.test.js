import { it, expect } from 'vitest';
import { loginKey } from './identity.js';
it('matches Uzbek phone formats without confusing textual logins', () => {
  expect(loginKey('+998 (90) 123-45-67')).toBe(loginKey('901234567'));
  expect(loginKey('998901234567')).toBe(loginKey('901234567'));
  expect(loginKey(' Admin.Local ')).toBe('admin.local');
  expect(loginKey('admin123')).not.toBe(loginKey('123'));
});
