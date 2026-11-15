// Akun user beserta profil student & teacher (profil dibuat bersamaan dengan akun,
// jadi dikelompokkan dalam satu file).
import Joi from "joi";
import { paginationKeys, requiredUuid, uuid } from "@src/shared/validation/common-validation";
import type { PaginationQuery } from "@src/shared/validation/common-validation";

// ---------- field bersama ----------
const email = Joi.string().trim().lowercase().email().max(255);
const username = Joi.string()
  .trim()
  .lowercase()
  .min(3)
  .max(255)
  .pattern(/^[a-z0-9._-]+$/)
  .messages({
    "string.pattern.base": "Username hanya boleh huruf kecil, angka, titik, underscore, dan strip",
  });
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[a-z]/, "lowercase")
  .pattern(/[A-Z]/, "uppercase")
  .pattern(/\d/, "digit")
  .messages({
    "string.pattern.name": "Password harus mengandung huruf besar, huruf kecil, dan angka ({#name})",
  });
const fullName = Joi.string().trim().min(2).max(255);
const nim = Joi.string().trim().max(30);
const nip = Joi.string().trim().max(30);

// ---------- tipe ----------
export type StudentProfileInput = { nim: string; fullName: string };
export type TeacherProfileInput = { nip: string; fullName: string };

export type CreateUserInput = {
  email: string;
  username: string;
  password: string;
  roleId: string;
  isActive: boolean;
  student?: StudentProfileInput;
  teacher?: TeacherProfileInput;
};
export type UpdateUserInput = {
  email?: string;
  username?: string;
  roleId?: string;
  isActive?: boolean;
};
export type ResetUserPasswordInput = { newPassword: string };
export type ListUserQuery = PaginationQuery & { roleId?: string; isActive?: boolean };

export type UpdateStudentInput = { nim?: string; fullName?: string };
export type ListStudentQuery = PaginationQuery & { classId?: string };

export type UpdateTeacherInput = { nip?: string; fullName?: string };
export type ListTeacherQuery = PaginationQuery;

// ---------- user ----------
// Email/username/NIM/NIP sudah dipakai? Dicek di service.
const studentProfile = Joi.object<StudentProfileInput>({
  nim: nim.required(),
  fullName: fullName.required(),
});

const teacherProfile = Joi.object<TeacherProfileInput>({
  nip: nip.required(),
  fullName: fullName.required(),
});

// Register akun (khusus admin). Profil student/teacher dibuat bersamaan sesuai role.
// Kecocokan role dengan profil yang dikirim dicek di service.
export const createUserSchema = Joi.object<CreateUserInput>({
  email: email.required(),
  username: username.required(),
  password: password.required(),
  roleId: requiredUuid,
  isActive: Joi.boolean().default(true),
  student: studentProfile.optional(),
  teacher: teacherProfile.optional(),
}).oxor("student", "teacher");

export const updateUserSchema = Joi.object<UpdateUserInput>({
  email: email,
  username: username,
  roleId: uuid,
  isActive: Joi.boolean(),
}).min(1);

export const resetUserPasswordSchema = Joi.object<ResetUserPasswordInput>({
  newPassword: password.required(),
});

export const listUserQuerySchema = Joi.object<ListUserQuery>({
  ...paginationKeys,
  roleId: uuid.optional(),
  isActive: Joi.boolean().optional(),
});

// ---------- student ----------
export const updateStudentSchema = Joi.object<UpdateStudentInput>({
  nim: nim,
  fullName: fullName,
}).min(1);

export const listStudentQuerySchema = Joi.object<ListStudentQuery>({
  ...paginationKeys,
  classId: uuid.optional(),
});

// ---------- teacher ----------
export const updateTeacherSchema = Joi.object<UpdateTeacherInput>({
  nip: nip,
  fullName: fullName,
}).min(1);

export const listTeacherQuerySchema = Joi.object<ListTeacherQuery>(paginationKeys);
