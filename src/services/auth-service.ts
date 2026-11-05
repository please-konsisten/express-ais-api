// import bcrypt from "bcrypt";

// import { prisma } from "@src/lib/prisma-client"
// import { loginAccountValidation, registerAccountValidation } from "@src/validation/auth-validation"
// import { validate } from "@src/validation/validation"
// import { ResponseError } from "@src/error/response-error";
// import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

// import jwt from "jsonwebtoken";

// import type { LoginAccountRequest, LoginAccountResponse, RegisterAccountRequest } from "@src/types/auth-type"


// const login = async (dataRequest: LoginAccountRequest): Promise<LoginAccountResponse> => {
//   const accountValidation = validate(loginAccountValidation, dataRequest)
//   const { identifier, password } = accountValidation

//   const account = await prisma.account.findFirst({
//     where: {
//       OR: [
//         { email: identifier },
//         { username: identifier }
//       ]
//     }
//   });

//   if (!account) {
//     throw new ResponseError(401, 'Email atau password salah');
//   }

//   const isPasswordValid = await bcrypt.compare(password, account.password);
//   if (!isPasswordValid) {
//     throw new ResponseError(401, 'Email atau password salah');
//   }

//   const accessToken = generateAccessToken(account);
//   const refreshToken = await generateRefreshToken(account.id);

//   return {
//     accessToken,
//     refreshToken
//   }
// }

// const register = async (dataRequest: RegisterAccountRequest) => {
//   const accountValidation = validate(registerAccountValidation, dataRequest)
//   const { email, username, password } = accountValidation

//   const existingAccount = await prisma.account.count({
//     where: {
//       OR: [{ email }, { username }]
//     }
//   });

//   if (existingAccount === 1) {
//     throw new ResponseError(400, "Username already exists");
//   }

//   const saltRounds = 10;
//   const hashedPassword = await bcrypt.hash(password, saltRounds);

//   const newAccount = await prisma.account.create({
//     data: {
//       username,
//       email,
//       password: hashedPassword
//     }
//   });

//   return newAccount
// }

// const refresh_token = async (cookieToken: string) => {
//   if (!cookieToken) {
//     throw new ResponseError(401, "Refresh token tidak ditemukan");
//   }

//   const decoded = jwt.verify(cookieToken, process.env.REFRESH_TOKEN_SECRET as string) as any;

//   const newAccessToken = jwt.sign(
//     { id: decoded.id, email: decoded.email },
//     process.env.ACCESS_TOKEN_SECRET as string,
//     { expiresIn: '15m' }
//   );

//   const newRefreshToken = jwt.sign(
//     { id: decoded.id, email: decoded.email },
//     process.env.REFRESH_TOKEN_SECRET as string,
//     { expiresIn: '7d' }
//   );

//   return {
//     newAccessToken,
//     newRefreshToken
//   };
// }

// export default {
//   register,
//   login,
//   refresh_token
// }

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';

import { prisma } from '@src/lib/prisma-client';
import { loginAccountValidation, registerAccountValidation } from '@src/validation/auth-validation';
import { validate } from '@src/validation/validation';
import { ResponseError } from '@src/error/response-error';

import type { LoginAccountRequest, LoginAccountResponse, RegisterAccountRequest } from '@src/types/auth-type';

// ---------------------------------------------------------------------------
// Konfigurasi
// ---------------------------------------------------------------------------

// Aplikasi sengaja gagal start kalau secret tidak ada (tanpa fallback hardcoded).
// Pastikan dotenv sudah di-load sebelum file ini di-import.
const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} wajib diisi`);
  }
  return value;
};

const ACCESS_TOKEN_SECRET = getRequiredEnv('ACCESS_TOKEN_SECRET');
const REFRESH_TOKEN_SECRET = getRequiredEnv('REFRESH_TOKEN_SECRET');

if (ACCESS_TOKEN_SECRET === REFRESH_TOKEN_SECRET) {
  throw new Error('ACCESS_TOKEN_SECRET dan REFRESH_TOKEN_SECRET harus berbeda');
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 menit
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 hari
const BCRYPT_ROUNDS = 12;

// Hash palsu untuk menyamakan waktu respons saat akun tidak ditemukan
// (mencegah user enumeration lewat timing attack).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

type AccountIdentity = { id: string; email: string; role: string };

// ---------------------------------------------------------------------------
// Helper token
// ---------------------------------------------------------------------------

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const generateAccessToken = (account: AccountIdentity) => {
  return jwt.sign(
    { id: account.id, email: account.email, role: account.role, type: 'access' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL_SECONDS, algorithm: 'HS256' }
  );
};

// Membuat refresh token baru dan menyimpan HASH-nya ke database.
// jwtid (jti) memastikan setiap token unik walau dibuat di detik yang sama.
const issueRefreshToken = async (account: AccountIdentity) => {
  const token = jwt.sign(
    { id: account.id, type: 'refresh' },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
      jwtid: randomUUID(),
    }
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256(token),
      accountId: account.id,
      expiredAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });

  return token;
};

const verifyRefreshJwt = (token: string): { id: string } => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'string' || decoded.type !== 'refresh' || !decoded.id) {
      throw new Error('Payload refresh token tidak valid');
    }

    return { id: decoded.id as string };
  } catch {
    throw new ResponseError(401, 'Refresh token tidak valid atau sudah kedaluwarsa');
  }
};

const revokeAllTokensOfAccount = (accountId: string) => {
  return prisma.refreshToken.updateMany({
    where: { accountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const login = async (dataRequest: LoginAccountRequest): Promise<LoginAccountResponse> => {
  const { identifier, password } = validate(loginAccountValidation, dataRequest);

  const account = await prisma.account.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
  });

  const isPasswordValid = await bcrypt.compare(password, account?.password ?? DUMMY_HASH);

  if (!account || !isPasswordValid) {
    throw new ResponseError(401, 'Email atau password salah');
  }

  const accessToken = generateAccessToken(account);
  const refreshToken = await issueRefreshToken(account);

  return { accessToken, refreshToken };
};

const register = async (dataRequest: RegisterAccountRequest) => {
  const { email, username, password } = validate(registerAccountValidation, dataRequest);

  const existingAccount = await prisma.account.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
    select: { id: true },
  });

  if (existingAccount) {
    throw new ResponseError(409, 'Username atau email sudah digunakan');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    // select: hanya field aman yang dikembalikan, hash password TIDAK ikut
    return await prisma.account.create({
      data: { username, email, password: hashedPassword },
      select: { id: true, username: true, email: true, role: true },
    });
  } catch (e) {
    // Race condition: dua request bersamaan lolos pengecekan di atas,
    // unique constraint database yang menjadi penjaga terakhir.
    if ((e as { code?: string })?.code === 'P2002') {
      throw new ResponseError(409, 'Username atau email sudah digunakan');
    }
    throw e;
  }
};

const refresh_token = async (cookieToken?: string) => {
  if (!cookieToken) {
    throw new ResponseError(401, 'Refresh token tidak ditemukan');
  }

  // 1. Verifikasi signature, expiry, algoritma, dan tipe token
  const decoded = verifyRefreshJwt(cookieToken);

  // 2. Token harus ada di database
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(cookieToken) },
  });

  if (!stored || stored.accountId !== decoded.id) {
    throw new ResponseError(401, 'Refresh token tidak valid');
  }

  // 3. Token yang sudah dicabut tapi dipakai lagi = indikasi pencurian (reuse detection).
  //    Cabut semua sesi akun ini dan paksa login ulang.
  if (stored.revokedAt) {
    await revokeAllTokensOfAccount(stored.accountId);
    throw new ResponseError(401, 'Sesi tidak valid, silakan login ulang');
  }

  if (stored.expiredAt < new Date()) {
    throw new ResponseError(401, 'Refresh token sudah kedaluwarsa');
  }

  // 4. Akun harus masih ada (kalau dihapus/dinonaktifkan, tambahkan pengecekan status di sini)
  const account = await prisma.account.findUnique({
    where: { id: stored.accountId },
    select: { id: true, email: true, role: true },
  });

  if (!account) {
    await revokeAllTokensOfAccount(stored.accountId);
    throw new ResponseError(401, 'Akun tidak ditemukan');
  }

  // 5. Rotation: cabut token lama secara atomik.
  //    updateMany + syarat revokedAt: null memastikan hanya SATU request yang berhasil
  //    kalau token yang sama dipakai bersamaan.
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (revoked.count !== 1) {
    await revokeAllTokensOfAccount(stored.accountId);
    throw new ResponseError(401, 'Sesi tidak valid, silakan login ulang');
  }

  // 6. Terbitkan pasangan token baru
  const newAccessToken = generateAccessToken(account);
  const newRefreshToken = await issueRefreshToken(account);

  return { newAccessToken, newRefreshToken };
};

// Idempotent: tidak melempar error kalau token tidak valid / sudah dicabut,
// karena tujuannya hanya memastikan sesi ini tidak bisa dipakai lagi.
const logout = async (cookieToken: string) => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(cookieToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// Opsional: panggil berkala (cron) untuk membersihkan token kedaluwarsa dari DB.
const cleanupExpiredRefreshTokens = async () => {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { expiredAt: { lt: new Date() } },
  });
  return count;
};

export default {
  register,
  login,
  refresh_token,
  logout,
  cleanupExpiredRefreshTokens,
};