import type { Request, Response } from "express";
import type { IdParam } from "@src/shared/schemas/common.schema";
import * as academicService from "./academic.service";
import type {
  CreateAcademicTermInput,
  CreateClassInput,
  CreateSubjectInput,
  ListAcademicTermQuery,
  ListClassQuery,
  ListSubjectQuery,
  UpdateAcademicTermInput,
  UpdateClassInput,
  UpdateSubjectInput,
} from "./academic.schema";

// Express 5 meneruskan error dari handler async ke error handler secara otomatis.
// Body/params/query sudah divalidasi oleh middleware validate di route (hasil validasi query
// ada di req.validatedQuery karena req.query read-only).

// ---------- academic term ----------
export const createAcademicTerm = async (req: Request, res: Response) => {
  const data = await academicService.createAcademicTerm(req.body as CreateAcademicTermInput);
  res.status(201).json({ data });
};

export const listAcademicTerms = async (req: Request, res: Response) => {
  const { items, meta } = await academicService.listAcademicTerms(req.validatedQuery as ListAcademicTermQuery);
  res.status(200).json({ data: items, meta });
};

export const getAcademicTerm = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.getAcademicTerm(req.params.id);
  res.status(200).json({ data });
};

export const updateAcademicTerm = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.updateAcademicTerm(req.params.id, req.body as UpdateAcademicTermInput);
  res.status(200).json({ data });
};

export const deleteAcademicTerm = async (req: Request<IdParam>, res: Response) => {
  await academicService.deleteAcademicTerm(req.params.id);
  res.status(200).json({ message: "Periode akademik berhasil dihapus" });
};

// ---------- subject ----------
export const createSubject = async (req: Request, res: Response) => {
  const data = await academicService.createSubject(req.body as CreateSubjectInput);
  res.status(201).json({ data });
};

export const listSubjects = async (req: Request, res: Response) => {
  const { items, meta } = await academicService.listSubjects(req.validatedQuery as ListSubjectQuery);
  res.status(200).json({ data: items, meta });
};

export const getSubject = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.getSubject(req.params.id);
  res.status(200).json({ data });
};

export const updateSubject = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.updateSubject(req.params.id, req.body as UpdateSubjectInput);
  res.status(200).json({ data });
};

export const deleteSubject = async (req: Request<IdParam>, res: Response) => {
  await academicService.deleteSubject(req.params.id);
  res.status(200).json({ message: "Mata kuliah berhasil dihapus" });
};

// ---------- class ----------
export const createClass = async (req: Request, res: Response) => {
  const data = await academicService.createClass(req.body as CreateClassInput);
  res.status(201).json({ data });
};

export const listClasses = async (req: Request, res: Response) => {
  const { items, meta } = await academicService.listClasses(req.validatedQuery as ListClassQuery);
  res.status(200).json({ data: items, meta });
};

export const getClass = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.getClass(req.params.id);
  res.status(200).json({ data });
};

export const updateClass = async (req: Request<IdParam>, res: Response) => {
  const data = await academicService.updateClass(req.params.id, req.body as UpdateClassInput);
  res.status(200).json({ data });
};

export const deleteClass = async (req: Request<IdParam>, res: Response) => {
  await academicService.deleteClass(req.params.id);
  res.status(200).json({ message: "Kelas berhasil dihapus" });
};