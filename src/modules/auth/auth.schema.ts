// src/modules/auth/auth.schema.ts
import Joi from "joi";
import { existingPassword, strongPassword } from "@src/shared/schemas/account.schema";

export type LoginInput = {
  identifier: string;
  password: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};

export type LogoutInput = {
  refreshToken: string;
};

export type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// identifier = email atau username. Formatnya sengaja tidak dicek ketat (username boleh
// mengandung titik, underscore, dan strip): kecocokan sebenarnya ditentukan di database.
// Password login juga tidak dicek komposisinya, supaya akun lama tetap bisa masuk dan
// mendapat 401 (bukan 400) saat password salah.
export const loginSchema = Joi.object<LoginInput>({
  identifier: Joi.string().trim().lowercase().min(3).max(255).required(),
  password: existingPassword.required(),
});

// Refresh token acak 48 byte base64url = 64 karakter.
const refreshToken = Joi.string().trim().max(128).required();

export const refreshTokenSchema = Joi.object<RefreshTokenInput>({
  refreshToken,
});

export const changePasswordSchema = Joi.object<ChangePasswordInput>({
  oldPassword: existingPassword.required(),
  newPassword: strongPassword
    .invalid(Joi.ref("oldPassword"))
    .required()
    .messages({ "any.invalid": "Password baru tidak boleh sama dengan password lama" }),
  confirmPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Konfirmasi password tidak cocok" }),
});