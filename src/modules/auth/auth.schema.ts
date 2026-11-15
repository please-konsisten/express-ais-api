// src/modules/auth/auth.schema.ts
import Joi from "joi";

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

export const loginSchema = Joi.object<LoginInput>({
  identifier: Joi.alternatives().try(
    Joi.string().trim().email().max(100).required(),
    Joi.string().trim().alphanum().min(3).max(100).required()
  ).required().messages({
    'alternatives.match': 'Identifier harus berupa email atau username yang valid'
  }),
  password: Joi.string().min(8).max(72).required(),
});

export const refreshTokenSchema = Joi.object<RefreshTokenInput>({
  refreshToken: Joi.string().trim().required(),
});

export const logoutSchema = Joi.object<LogoutInput>({
  refreshToken: Joi.string().trim().required(),
});

export const changePasswordSchema = Joi.object<ChangePasswordInput>({
  oldPassword: Joi.string().min(8).max(72).required(),
  newPassword: Joi.string()
    .min(8)
    .max(72)
    .pattern(/[a-z]/, "lowercase")
    .pattern(/[A-Z]/, "uppercase")
    .pattern(/\d/, "digit")
    .invalid(Joi.ref("oldPassword"))
    .required()
    .messages({
      "string.pattern.name": "Password baru harus mengandung huruf besar, huruf kecil, dan angka ({#name})",
      "any.invalid": "Password baru tidak boleh sama dengan password lama",
    }),
  confirmPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Konfirmasi password tidak cocok" }),
});