import { type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@src/lib/prisma-client';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret';

const login = async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
}

const register = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Semua field wajib diisi' });
  }

  try {
    const existingUser = await prisma.account.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email atau Username sudah digunakan' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newAccount = await prisma.account.create({
      data: {
        id: `acc_${Date.now()}`,
        username,
        email,
        password: hashedPassword
      }
    });

    res.status(201).json({
      message: 'Registrasi berhasil',
      userId: newAccount.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server saat registrasi' });
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