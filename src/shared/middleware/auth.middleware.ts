import type { NextFunction, Request, Response } from "express";
import type { PermissionSlug } from "@src/shared/constants/permissions";
import { ResponseError } from "@src/shared/errors/responseError";
import { prismaClient } from "@src/shared/lib/database";
import { verifyAccessToken } from "@src/shared/lib/jwt";

const extractBearerToken = (header: string | undefined): string | null => {
  const [scheme, token, ...rest] = header?.split(" ") ?? [];
  return scheme?.toLowerCase() === "bearer" && token && rest.length === 0 ? token : null;
};

// Memverifikasi access token, lalu memuat akun dari database pada setiap request. Dengan begitu
// akun yang dinonaktifkan atau diganti role-nya langsung berlaku, tidak menunggu token kedaluwarsa.
// Semua kegagalan memakai 401 supaya klien mencoba refresh token terlebih dahulu.
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw new ResponseError(401, "Akses ditolak, token tidak ditemukan");
  }

  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    throw new ResponseError(401, "Token tidak valid atau sudah kedaluwarsa");
  }

  const account = await prismaClient.account.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      roleId: true,
      role: {
        select: {
          isSuperAdmin: true,
          rolePermissions: { select: { permission: { select: { slug: true } } } },
        },
      },
    },
  });
  if (!account || !account.isActive) {
    throw new ResponseError(401, "Akun tidak ditemukan atau tidak aktif");
  }

  req.user = {
    id: account.id,
    roleId: account.roleId,
    isSuperAdmin: account.role.isSuperAdmin,
    permissions: account.role.rolePermissions.map((rp) => rp.permission.slug),
  };
  next();
};

// Dipakai setelah authenticate. Super admin lolos semua pengecekan.
// Contoh: router.get("/users", requirePermission("user.manage"), handler)
export const requirePermission =
  (...slugs: PermissionSlug[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (user.isSuperAdmin || slugs.every((slug) => user.permissions.includes(slug))) {
      next();
      return;
    }
    throw new ResponseError(403, "Anda tidak memiliki akses ke sumber daya ini");
  };

// Pengganti req.user! di controller: gagal jelas (401) kalau middleware authenticate lupa dipasang di route.
export const getAuthUser = (req: Request) => {
  if (!req.user) {
    throw new ResponseError(401, "Akses ditolak, silakan login");
  }
  return req.user;
};