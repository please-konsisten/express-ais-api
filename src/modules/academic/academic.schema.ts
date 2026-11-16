// Data master akademik: periode (academic term), mata kuliah (subject), dan kelas (class).
import Joi from "joi";
import { paginationKeys } from "@src/shared/validation/common-validation";
import type { PaginationQuery } from "@src/shared/validation/common-validation";

// ---------- tipe ----------
export type CreateAcademicTermInput = {
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
};
export type UpdateAcademicTermInput = {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
};

export type CreateSubjectInput = { code: string; name: string; credits?: number | null };
export type UpdateSubjectInput = { code?: string; name?: string; credits?: number | null };
export type ListSubjectQuery = PaginationQuery;

export type CreateClassInput = { name: string };
export type UpdateClassInput = { name: string };
export type ListClassQuery = PaginationQuery;

// ---------- academic term ----------
// Periode tumpang tindih / hanya satu yang aktif? Dicek di service.
export const createAcademicTermSchema = Joi.object<CreateAcademicTermInput>({
  name: Joi.string().trim().min(2).max(100).required(), // contoh: "Ganjil 2026/2027"
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")).required().messages({
    "date.greater": "endDate harus setelah startDate",
  }),
  isActive: Joi.boolean().default(false),
});

// Jika hanya salah satu tanggal yang dikirim, perbandingannya dengan tanggal di database
// dicek di service.
export const updateAcademicTermSchema = Joi.object<UpdateAcademicTermInput>({
  name: Joi.string().trim().min(2).max(100),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().when("startDate", {
    is: Joi.exist(),
    then: Joi.date().greater(Joi.ref("startDate")),
  }),
  isActive: Joi.boolean(),
}).min(1);

// ---------- subject ----------
// Kode mata kuliah sudah dipakai? Dicek di service.
const code = Joi.string().trim().uppercase().max(20);

export const createSubjectSchema = Joi.object<CreateSubjectInput>({
  code: code.required(),
  name: Joi.string().trim().min(2).max(255).required(),
  credits: Joi.number().integer().min(0).max(32767).allow(null).optional(),
});

export const updateSubjectSchema = Joi.object<UpdateSubjectInput>({
  code: code,
  name: Joi.string().trim().min(2).max(255),
  credits: Joi.number().integer().min(0).max(32767).allow(null),
}).min(1);

export const listSubjectQuerySchema = Joi.object<ListSubjectQuery>(paginationKeys);

// ---------- class ----------
export const createClassSchema = Joi.object<CreateClassInput>({
  name: Joi.string().trim().min(1).max(100).required(),
});

export const updateClassSchema = Joi.object<UpdateClassInput>({
  name: Joi.string().trim().min(1).max(100).required(),
});

export const listClassQuerySchema = Joi.object<ListClassQuery>(paginationKeys);