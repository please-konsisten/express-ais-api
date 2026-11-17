import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@src/generated/prisma/client";
import { prismaClient } from "@src/shared/lib/database";
import { signAccessToken } from "@src/shared/lib/jwt";
import { hashPassword, verifyPassword } from "@src/shared/lib/password";
import { ResponseError } from "@src/shared/errors/response-error";
import type { ChangePasswordInput, LoginInput, LogoutInput, RefreshTokenInput } from "./auth.schema";

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type TokenOwner = { id: string; roleId: string };
type Db = Prisma.TransactionClient | typeof prismaClient;

// Refresh token acak disimpan dalam bentuk hash, jadi kebocoran database
// tidak langsung memberi token yang bisa dipakai.
const issueTokens = async (user: TokenOwner, db: Db = prismaClient) => {
  const refreshToken = randomBytes(48).toString("base64url");

  await db.refreshToken.create({
    data: {
      accountId: user.id,
      tokenHash: sha256(refreshToken),
      expiredAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return {
    accessToken: signAccessToken({ sub: user.id, roleId: user.roleId }),
    refreshToken,
  };
};

const userSelect = {
  id: true,
  email: true,
  username: true,
  roleId: true,
  isActive: true,
  role: { select: { name: true, isSuperAdmin: true } },
} satisfies Prisma.AccountSelect;

export const login = async (input: LoginInput) => {
  // email dan username disimpan lowercase saat register
  const identifier = input.identifier.toLowerCase();

  const user = await prismaClient.account.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { ...userSelect, hashPassword: true },
  });

  // bcrypt.compare tetap dijalankan walau user tidak ada, supaya waktu respons tidak membocorkan
  // apakah identifier terdaftar.
  const passwordMatches = await verifyPassword(input.password, user?.hashPassword);
  if (!user || !passwordMatches) {
    throw new ResponseError(401, "Identifier atau password salah");
  }
  // Dicek setelah password benar, supaya status akun tidak bisa ditebak tanpa password.
  if (!user.isActive) {
    throw new ResponseError(403, "Akun tidak aktif");
  }

  const tokens = await issueTokens(user);

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.name,
      isSuperAdmin: user.role.isSuperAdmin,
    },
  };
};

// Refresh token dirotasi: token lama dihapus, token baru diterbitkan.
export const refresh = async (input: RefreshTokenInput) => {
  const stored = await prismaClient.refreshToken.findUnique({
    where: { tokenHash: sha256(input.refreshToken) },
    include: { account: { select: userSelect } },
  });

  if (!stored || stored.revokedAt !== null || stored.expiredAt <= new Date()) {
    throw new ResponseError(401, "Refresh token tidak valid atau sudah kedaluwarsa");
  }
  if (!stored.account.isActive) {
    throw new ResponseError(403, "Akun tidak aktif");
  }

  return prismaClient.$transaction(async (tx) => {
    // deleteMany + cek count: kalau dua request memakai token yang sama bersamaan,
    // hanya satu yang berhasil menghapus, yang lain ditolak.
    const { count } = await tx.refreshToken.deleteMany({ where: { id: stored.id } });
    if (count !== 1) {
      throw new ResponseError(401, "Refresh token tidak valid atau sudah kedaluwarsa");
    }
    return issueTokens(stored.account, tx);
  });
};

// Idempotent: token yang sudah tidak ada tidak dianggap error.
export const logout = async (rawToken: string | undefined) => {
  if (!rawToken) return;

  await prismaClient.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

// Setelah password berubah, semua sesi (refresh token) user dicabut, termasuk di perangkat lain.
export const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await prismaClient.account.findUnique({
    where: { id: userId },
    select: { hashPassword: true },
  });
  if (!user) {
    throw new ResponseError(404, "User tidak ditemukan");
  }

  const oldPasswordMatches = await verifyPassword(input.oldPassword, user.hashPassword);
  if (!oldPasswordMatches) {
    // 400, bukan 401, supaya klien tidak mengira sesinya habis lalu logout otomatis
    throw new ResponseError(400, "Password lama salah");
  }

  const newHash = await hashPassword(input.newPassword);

  await prismaClient.$transaction([
    prismaClient.account.update({ where: { id: userId }, data: { hashPassword: newHash } }),
    prismaClient.refreshToken.deleteMany({ where: { accountId: userId } }),
  ]);
};