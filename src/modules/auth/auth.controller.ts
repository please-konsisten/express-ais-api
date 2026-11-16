import type { Request, Response } from "express";
import { getAuthUser } from "@src/shared/middleware/auth.middleware";
import * as authService from "./auth.service";
import type { ChangePasswordInput, LoginInput, LogoutInput, RefreshTokenInput } from "./auth.schema";

// Express 5 meneruskan error dari handler async ke error handler secara otomatis,
// jadi tidak perlu try/catch. Body sudah divalidasi oleh middleware validate di route.

export const login = async (req: Request, res: Response) => {
  const data = await authService.login(req.body as LoginInput);
  res.status(200).json({ data });
};

export const refresh = async (req: Request, res: Response) => {
  const data = await authService.refresh(req.body as RefreshTokenInput);
  res.status(200).json({ data });
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req.body as LogoutInput);
  res.status(200).json({ message: "Logout berhasil" });
};

// Butuh middleware authenticate yang mengisi req.user
export const changePassword = async (req: Request, res: Response) => {
  await authService.changePassword(getAuthUser(req).id, req.body as ChangePasswordInput);
  res.status(200).json({ message: "Password berhasil diubah. Silakan login kembali." });
};