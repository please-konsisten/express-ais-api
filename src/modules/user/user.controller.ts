import type { Request, Response } from "express";
import type { IdParam } from "@src/shared/validation/common-validation";
import { getAuthUser } from "@src/shared/middleware/auth-middleware";
import * as userService from "./user.service";
import type {
  CreateUserInput,
  ListStudentQuery,
  ListTeacherQuery,
  ListUserQuery,
  ResetUserPasswordInput,
  UpdateMyStudentProfileInput,
  UpdateMyTeacherProfileInput,
  UpdateStudentInput,
  UpdateTeacherInput,
  UpdateUserInput,
} from "./user.schema";

// Express 5 meneruskan error dari handler async ke error handler secara otomatis.
// Body/params/query sudah divalidasi oleh middleware validate di route (hasil validasi query
// ada di req.validatedQuery karena req.query read-only).

// ---------- self-service ----------
export const getMe = async (req: Request, res: Response) => {
  const data = await userService.getMe(getAuthUser(req).id);
  res.status(200).json({ data });
};

export const updateMyStudentProfile = async (req: Request, res: Response) => {
  const data = await userService.updateMyStudentProfile(getAuthUser(req).id, req.body as UpdateMyStudentProfileInput);
  res.status(200).json({ data });
};

export const updateMyTeacherProfile = async (req: Request, res: Response) => {
  const data = await userService.updateMyTeacherProfile(getAuthUser(req).id, req.body as UpdateMyTeacherProfileInput);
  res.status(200).json({ data });
};

// ---------- akun (admin) ----------
export const createUser = async (req: Request, res: Response) => {
  const data = await userService.createUser(getAuthUser(req), req.body as CreateUserInput);
  res.status(201).json({ data });
};

export const listUsers = async (req: Request, res: Response) => {
  const { items, meta } = await userService.listUsers(req.validatedQuery as ListUserQuery);
  res.status(200).json({ data: items, meta });
};

export const getUser = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.getUser(req.params.id);
  res.status(200).json({ data });
};

export const updateUser = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.updateUser(getAuthUser(req), req.params.id, req.body as UpdateUserInput);
  res.status(200).json({ data });
};

export const resetUserPassword = async (req: Request<IdParam>, res: Response) => {
  await userService.resetUserPassword(getAuthUser(req), req.params.id, req.body as ResetUserPasswordInput);
  res.status(200).json({ message: "Password berhasil direset. Semua sesi pengguna telah dicabut." });
};

// ---------- mahasiswa (admin) ----------
export const listStudents = async (req: Request, res: Response) => {
  const { items, meta } = await userService.listStudents(req.validatedQuery as ListStudentQuery);
  res.status(200).json({ data: items, meta });
};

export const getStudent = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.getStudent(req.params.id);
  res.status(200).json({ data });
};

export const updateStudent = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.updateStudent(req.params.id, req.body as UpdateStudentInput);
  res.status(200).json({ data });
};

// ---------- dosen (admin) ----------
export const listTeachers = async (req: Request, res: Response) => {
  const { items, meta } = await userService.listTeachers(req.validatedQuery as ListTeacherQuery);
  res.status(200).json({ data: items, meta });
};

export const getTeacher = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.getTeacher(req.params.id);
  res.status(200).json({ data });
};

export const updateTeacher = async (req: Request<IdParam>, res: Response) => {
  const data = await userService.updateTeacher(req.params.id, req.body as UpdateTeacherInput);
  res.status(200).json({ data });
};