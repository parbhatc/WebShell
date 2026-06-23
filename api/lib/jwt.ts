import type { SignOptions } from 'jsonwebtoken';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'a-super-secret-key-that-should-be-long-and-random';

export const ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] = (process.env.ACCESS_TOKEN_EXPIRES_IN ||
  '15m') as SignOptions['expiresIn'];

export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

export function getRefreshExpiryDate(): Date {
  const exp = REFRESH_TOKEN_EXPIRES_IN;
  const match = exp.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 30 * 86400000);
  const multipliers: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
  return new Date(Date.now() + parseInt(match[1], 10) * multipliers[match[2]]);
}
