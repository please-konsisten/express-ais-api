import { type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@src/lib/prisma-client';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';
import type { RegisterAccountRequest } from '@src/types/auth-type';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

const login = async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  try {
    const account = await prisma.account.findUnique({ where: { email } });
    if (!account) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const accessToken = generateAccessToken(account);
    const refreshToken = await generateRefreshToken(account.id);

    res.json({
      message: 'Login berhasil',
      accessToken,
      refreshToken
    });
  } catch (e) {
    next(e)
  }
}

const register = async (
  req: Request <unknown, unknown, RegisterAccountRequest>, 
  res: Response, next: NextFunction) => 
{
  try {
    const { username, email, password } = req.body;

    const result = await 
  } catch (e) {
    next(e)
  }
}
const refresh_token = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token tidak ditemukan' });
  }

  try {
    const savedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { account: true } 
    });

    if (!savedToken) {
      return res.status(403).json({ message: 'Refresh token tidak valid' });
    }

    if (new Date() > savedToken.expiredAt) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      return res.status(403).json({ message: 'Refresh token telah kedaluwarsa, silakan login ulang' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err: any) => {
      if (err) {
        return res.status(403).json({ message: 'Verifikasi Refresh Token gagal' });
      }

      const newAccessToken = generateAccessToken({
        id: savedToken.account.id,
        email: savedToken.account.email,
        username: savedToken.account.username
      });

      res.json({
        accessToken: newAccessToken
      });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server saat me-refresh token' });
  }
}

export default {
  login,
  register,
  refresh_token
}