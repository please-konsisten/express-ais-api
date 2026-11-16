// Akun user beserta profil student & teacher (profil dibuat bersamaan dengan akun,
// jadi dikelompokkan dalam satu file).
import Joi from "joi";
import { paginationKeys, requiredUuid, uuid } from "@src/shared/validation/common-validation";
import type { PaginationQuery } from "@src/shared/validation/common-validation";
import { email, strongPassword as password, username } from "@src/shared/validation/account-validation";

// ---------- field bersama (Akun & Identitas Resmi - Admin) ----------
const fullName = Joi.string().trim().min(2).max(255);
const nim = Joi.string().trim().max(30);
const nip = Joi.string().trim().max(30);
const nidn = Joi.string().trim().max(30).allow(null, "");
const studyProgram = Joi.string().trim().max(100);
const batchYear = Joi.number().integer().min(2000).max(2100);
const semester = Joi.number().integer().min(1).max(14);
const academicStatus = Joi.string().valid("ACTIVE", "LEAVE", "GRADUATED", "INACTIVE");
const department = Joi.string().trim().max(100).allow(null, "");
const titlePrefix = Joi.string().trim().max(50).allow(null, "");
const titleSuffix = Joi.string().trim().max(100).allow(null, "");

// ---------- field bersama (Data Personal - User / Self-Service) ----------
const phoneNumber = Joi.string()
  .trim()
  .max(20)
  .pattern(/^[0-9+\-\s()]+$/)
  .allow(null, "")
  .messages({
    "string.pattern.base": "Format nomor telepon tidak valid",
  });
const address = Joi.string().trim().max(1000).allow(null, "");
// Hanya http/https: skema lain (javascript:, data:) berbahaya bila URL ini dipakai sebagai src/href di frontend.
const avatarUrl = Joi.string().trim().uri({ scheme: ["http", "https"] }).max(1000).allow(null, "");
const officeLocation = Joi.string().trim().max(100).allow(null, "");
const expertise = Joi.string().trim().max(1000).allow(null, "");

// ---------- tipe ----------
export type AcademicStatusType = "ACTIVE" | "LEAVE" | "GRADUATED" | "INACTIVE";

export type StudentProfileInput = {
  nim: string;
  fullName: string;
  studyProgram: string;
  batchYear: number;
  semester?: number;
  academicStatus?: AcademicStatusType;
};

export type TeacherProfileInput = {
  nip: string;
  nidn?: string | null;
  titlePrefix?: string | null;
  fullName: string;
  titleSuffix?: string | null;
  department?: string | null;
};

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

// Tipe Update oleh Admin (Data Akademik/Kepegawaian Resmi)
export type UpdateStudentInput = {
  nim?: string;
  fullName?: string;
  studyProgram?: string;
  batchYear?: number;
  semester?: number;
  academicStatus?: AcademicStatusType;
};
export type ListStudentQuery = PaginationQuery & {
  classId?: string;
  studyProgram?: string;
  batchYear?: number;
  academicStatus?: AcademicStatusType;
};

export type UpdateTeacherInput = {
  nip?: string;
  nidn?: string | null;
  titlePrefix?: string | null;
  fullName?: string;
  titleSuffix?: string | null;
  department?: string | null;
  isActive?: boolean;
};
export type ListTeacherQuery = PaginationQuery & { department?: string; isActive?: boolean };

// Tipe Update oleh User Sendiri (Data Personal & Kontak)
export type UpdateMyStudentProfileInput = {
  phoneNumber?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

export type UpdateMyTeacherProfileInput = {
  phoneNumber?: string | null;
  officeLocation?: string | null;
  expertise?: string | null;
  avatarUrl?: string | null;
};

// ---------- user (Admin) ----------
const studentProfile = Joi.object<StudentProfileInput>({
  nim: nim.required(),
  fullName: fullName.required(),
  studyProgram: studyProgram.required(),
  batchYear: batchYear.required(),
  semester: semester.default(1),
  academicStatus: academicStatus.default("ACTIVE"),
});

const teacherProfile = Joi.object<TeacherProfileInput>({
  nip: nip.required(),
  nidn: nidn.optional(),
  titlePrefix: titlePrefix.optional(),
  fullName: fullName.required(),
  titleSuffix: titleSuffix.optional(),
  department: department.optional(),
});

// Register akun (khusus admin). Profil student/teacher dibuat bersamaan sesuai role.
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

// ---------- student (Admin) ----------
export const updateStudentSchema = Joi.object<UpdateStudentInput>({
  nim: nim,
  fullName: fullName,
  studyProgram: studyProgram,
  batchYear: batchYear,
  semester: semester,
  academicStatus: academicStatus,
}).min(1);

export const listStudentQuerySchema = Joi.object<ListStudentQuery>({
  ...paginationKeys,
  classId: uuid.optional(),
  studyProgram: studyProgram.optional(),
  batchYear: batchYear.optional(),
  academicStatus: academicStatus.optional(),
});

// ---------- teacher (Admin) ----------
export const updateTeacherSchema = Joi.object<UpdateTeacherInput>({
  nip: nip,
  nidn: nidn,
  titlePrefix: titlePrefix,
  fullName: fullName,
  titleSuffix: titleSuffix,
  department: department,
  isActive: Joi.boolean(),
}).min(1);

export const listTeacherQuerySchema = Joi.object<ListTeacherQuery>({
  ...paginationKeys,
  department: department.optional(),
  isActive: Joi.boolean().optional(),
});

// ---------- self-service profile (User: Student & Teacher) ----------
export const updateMyStudentProfileSchema = Joi.object<UpdateMyStudentProfileInput>({
  phoneNumber: phoneNumber,
  address: address,
  avatarUrl: avatarUrl,
}).min(1);

export const updateMyTeacherProfileSchema = Joi.object<UpdateMyTeacherProfileInput>({
  phoneNumber: phoneNumber,
  officeLocation: officeLocation,
  expertise: expertise,
  avatarUrl: avatarUrl,
}).min(1);