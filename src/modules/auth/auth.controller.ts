import type { Request, Response } from "express";
import { getAuthUser } from "@src/shared/middleware/auth.middleware";
import * as authService from "./auth.service";
import type { ChangePasswordInput, LoginInput } from "./auth.schema";

const cookieSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : true;

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);

  const { refreshToken, ...data } = result;

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    maxAge: authService.REFRESH_TOKEN_TTL_MS,
    path: "/api/auth",
  });

  res.status(200).json({ data });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken

  if (!refreshToken) {
    return res.status(401).json({
      message: 'Refresh token tidak ditemukan',
    })
  }

  const result = await authService.refresh({ refreshToken })

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    maxAge: authService.REFRESH_TOKEN_TTL_MS,
    path: '/api/auth',
  })

  res.status(200).json({
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
};

export const logout = async (req: Request, res: Response) => {
  try {
    await authService.logout(req.cookies?.refreshToken);
  } finally {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "lax",
      path: "/api/auth",
    });
  }
  res.status(200).json({ message: "Logout berhasil" });
};

export const changePassword = async (req: Request, res: Response) => {
  await authService.changePassword(getAuthUser(req).id, req.body as ChangePasswordInput);
  res.status(200).json({ message: "Password berhasil diubah. Silakan login kembali." });
};