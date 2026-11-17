import express from "express";
import * as authController from "@src/modules/auth/auth.controller";
import { changePasswordSchema, loginSchema, refreshTokenSchema } from "@src/modules/auth/auth.schema";
import * as userController from "@src/modules/user/user.controller";
import {
  createUserSchema,
  listStudentQuerySchema,
  listTeacherQuerySchema,
  listUserQuerySchema,
  resetUserPasswordSchema,
  updateMyStudentProfileSchema,
  updateMyTeacherProfileSchema,
  updateStudentSchema,
  updateTeacherSchema,
  updateUserSchema,
} from "@src/modules/user/user.schema";
import { PERMISSIONS as P } from "@src/shared/constants/permissions";
import { authenticate, requirePermission } from "@src/shared/middleware/auth.middleware";
import { idParamSchema } from "@src/shared/schemas/common.schema";
import { validate } from "@src/shared/middleware/validate.middleware";

// Semua route API. Dipasang di web.ts pada /api, SETELAH dokumentasi (/api/docs),
// karena router.use(authenticate) di bawah berlaku untuk semua path setelahnya.
// Slug permission berasal dari shared/constants/permissions.ts (sama dengan yang di-seed ke DB);
// pengecekan akun super admin ada di user.service (lapis kedua).
export const routes = express.Router();

// ======================================================================
// Publik (tanpa access token)
// Pendaftaran akun tidak publik: akun dibuat admin lewat POST /api/users.
// ======================================================================
routes.post("/auth/login", validate(loginSchema), authController.login);
routes.post("/auth/refresh-token", validate(refreshTokenSchema), authController.refresh);
routes.post("/auth/logout", authController.logout);

// ======================================================================
// Wajib login
// ======================================================================
routes.use(authenticate);

// ---------- auth ----------
routes.post("/auth/change-password", validate(changePasswordSchema), authController.changePassword);

// ---------- self-service (semua user yang login, tanpa permission khusus) ----------
routes.get("/me", userController.getMe);
routes.patch("/me/student-profile", validate(updateMyStudentProfileSchema), userController.updateMyStudentProfile);
routes.patch("/me/teacher-profile", validate(updateMyTeacherProfileSchema), userController.updateMyTeacherProfile);

// ---------- akun (admin) ----------
routes.get("/users", requirePermission(P.USER_READ), validate(listUserQuerySchema, "query"), userController.listUsers);
routes.get("/users/:id", requirePermission(P.USER_READ), validate(idParamSchema, "params"), userController.getUser);
routes.post("/users", requirePermission(P.USER_CREATE), validate(createUserSchema), userController.createUser);
routes.patch("/users/:id", requirePermission(P.USER_UPDATE), validate(idParamSchema, "params"), validate(updateUserSchema), userController.updateUser);
routes.patch("/users/:id/password", requirePermission(P.USER_RESET_PASSWORD), validate(idParamSchema, "params"), validate(resetUserPasswordSchema), userController.resetUserPassword);

// ---------- mahasiswa (admin) ----------
routes.get("/students", requirePermission(P.STUDENT_READ), validate(listStudentQuerySchema, "query"), userController.listStudents);
routes.get("/students/:id", requirePermission(P.STUDENT_READ), validate(idParamSchema, "params"), userController.getStudent);
routes.patch("/students/:id", requirePermission(P.STUDENT_UPDATE), validate(idParamSchema, "params"), validate(updateStudentSchema), userController.updateStudent);

// ---------- dosen (admin) ----------
routes.get("/teachers", requirePermission(P.TEACHER_READ), validate(listTeacherQuerySchema, "query"), userController.listTeachers);
routes.get("/teachers/:id", requirePermission(P.TEACHER_READ), validate(idParamSchema, "params"), userController.getTeacher);
routes.patch("/teachers/:id", requirePermission(P.TEACHER_UPDATE), validate(idParamSchema, "params"), validate(updateTeacherSchema), userController.updateTeacher);