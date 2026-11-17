// src/modules/auth/auth.schema.ts
import Joi from "joi";
import { existingPassword, strongPassword } from "@src/shared/schemas/account.schema";

export type LoginInput = {
  identifier: string;
  password: string;
};

export type ChangePasswordInput = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const loginSchema = Joi.object<LoginInput>({
  identifier: Joi.string().trim().lowercase().min(3).max(255).required(),
  password: existingPassword.required(),
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