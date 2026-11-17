import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@src/generated/prisma/client";
import { prismaClient } from "@src/shared/lib/database";
import { signAccessToken } from "@src/shared/lib/jwt";
import { hashPassword, verifyPassword } from "@src/shared/lib/password";
import { ResponseError } from "@src/shared/errors/response-error";
import type { ChangePasswordInput, LoginInput } from "./auth.schema";

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type TokenOwner = { id: string; roleId: string };
type Db = Prisma.TransactionClient | typeof prismaClient;

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

/*---- Login Service ----*/
export const login = async (input: LoginInput) => {
  const identifier = input.identifier.toLowerCase();

  const user = await prismaClient.account.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { ...userSelect, hashPassword: true },
  });

  const passwordMatches = await verifyPassword(input.password, user?.hashPassword);

  if (!user || !passwordMatches) {
    throw new ResponseError(401, "Identifier atau password salah");
  }

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

/*---- Refresh Token Service ----*/
export const refresh = async (input: any | undefined) => {
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
    const { count } = await tx.refreshToken.updateMany({
      where: {id: stored.id, revokedAt: null},
      data: {
        revokedAt: new Date(),
      },
    });

    if (count !== 1) {
      throw new ResponseError(401, "Refresh token tidak valid atau sudah digunakan");
    }

    const tokens = await issueTokens(stored.account, tx);

    return {
      ...tokens,
      user: stored.account,
    };
  });
};

/*---- Logout Service ----*/
export const logout = async (rawToken: string | undefined) => {
  if (!rawToken) return;

  await prismaClient.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/*---- Change Password Service ----*/
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
    throw new ResponseError(400, "Password lama salah");
  }

  const newHash = await hashPassword(input.newPassword);

  await prismaClient.$transaction([
    prismaClient.account.update({ where: { id: userId }, data: { hashPassword: newHash } }),
    prismaClient.refreshToken.deleteMany({ where: { accountId: userId } }),
  ]);
};