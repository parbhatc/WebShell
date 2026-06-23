import crypto from 'crypto';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  getRefreshExpiryDate,
} from '../lib/jwt.js';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

async function createRefreshToken(userId: number): Promise<string> {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await RefreshToken.create({
    tokenHash: hashToken(refreshToken),
    userId,
    expiresAt: getRefreshExpiryDate(),
  });
  return refreshToken;
}

export const register = async (username: string, password: string) => {
  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password_hash });
  return user;
};

export const login = async (username: string, password: string) => {
  const user = await User.findOne({ where: { username } });

  if (!user) {
    throw new Error('User not found');
  }

  const passwordMatch = await bcrypt.compare(password, user.get('password_hash') as string);
  if (!passwordMatch) {
    throw new Error('Invalid password');
  }

  const userId = user.get('id') as number;
  const accessToken = createAccessToken(userId);
  const refreshToken = await createRefreshToken(userId);

  return { user, accessToken, refreshToken };
};

export const refresh = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ where: { tokenHash } });

  if (!stored || stored.get('revokedAt') || new Date() > (stored.get('expiresAt') as Date)) {
    throw new Error('Invalid refresh token');
  }

  const userId = stored.get('userId') as number;
  await stored.update({ revokedAt: new Date() });

  const accessToken = createAccessToken(userId);
  const newRefreshToken = await createRefreshToken(userId);

  return { accessToken, refreshToken: newRefreshToken };
};

export const logout = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ where: { tokenHash } });
  if (stored && !stored.get('revokedAt')) {
    await stored.update({ revokedAt: new Date() });
  }
};
