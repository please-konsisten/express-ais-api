// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { prisma } from '@src/lib/prisma-client';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

export const generateAccessToken = (account: { id: string; email: string; username: string }) => {
  return jwt.sign(
    { id: account.id, email: account.email, username: account.username },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

export const generateRefreshToken = async (accountId: string) => {
  const token = jwt.sign({ id: accountId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      id: `rt_${Date.now()}`,
      token: token,
      expiredAt: expiredAt,
      accountId: accountId
    }
  });

  return token;
};
