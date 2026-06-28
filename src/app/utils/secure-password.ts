/**
 * Cryptographically secure random password for admin-created accounts.
 * Charset avoids ambiguous glyphs (0/O, 1/l/I).
 */
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*';

export function generateSecurePassword(length = 18): string {
  const classes = [UPPER, LOWER, DIGITS, SYMBOLS];
  const minLen = classes.length;
  const len = Math.max(length, minLen);
  const all = classes.join('');
  const rand = new Uint32Array(len + len);
  crypto.getRandomValues(rand);
  const chars: string[] = [];
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    chars.push(cls[rand[i] % cls.length]);
  }
  for (let i = classes.length; i < len; i++) {
    chars.push(all[rand[i] % all.length]);
  }
  let offset = len;
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand[offset++] % (i + 1);
    const t = chars[i];
    chars[i] = chars[j];
    chars[j] = t;
  }
  return chars.join('');
}
