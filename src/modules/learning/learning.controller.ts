import type { Request, Response } from "express";
import { getAuthUser } from "@src/shared/middleware/auth.middleware";
import type { IdParam } from "@src/shared/schemas/common.schema";
import * as learningService from "./learning.service";
import type {
  BulkUpsertGradeInput,
  CreateAssignmentInput,
  CreateMaterialInput,
  CreateSubmissionInput,
  GradeSubmissionInput,
  UpdateAssignmentInput,
  UpdateMaterialInput,
  UpdateSubmissionInput,
  UpsertGradeInput,
} from "./learning.schema";

// Express 5 meneruskan error dari handler async ke error handler secara otomatis.
// Body/params sudah divalidasi oleh middleware validate di route.
//
// Untuk handler "list ... per offering" (listMaterials, listAssignments, listGrades),
// req.params.id adalah id course offering, mis. GET /course-offerings/:id/materials.
// Untuk listSubmissions, req.params.id adalah id tugas: GET /assignments/:id/submissions.

// ---------- material ----------
export const createMaterial = async (req: Request, res: Response) => {
  const data = await learningService.createMaterial(getAuthUser(req), req.body as CreateMaterialInput);
  res.status(201).json({ data });
};

export const listMaterials = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.listMaterials(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const getMaterial = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.getMaterial(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateMaterial = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.updateMaterial(getAuthUser(req), req.params.id, req.body as UpdateMaterialInput);
  res.status(200).json({ data });
};

export const deleteMaterial = async (req: Request<IdParam>, res: Response) => {
  await learningService.deleteMaterial(getAuthUser(req), req.params.id);
  res.status(200).json({ message: "Materi berhasil dihapus" });
};

// ---------- assignment ----------
export const createAssignment = async (req: Request, res: Response) => {
  const data = await learningService.createAssignment(getAuthUser(req), req.body as CreateAssignmentInput);
  res.status(201).json({ data });
};

export const listAssignments = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.listAssignments(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const getAssignment = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.getAssignment(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateAssignment = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.updateAssignment(
    getAuthUser(req),
    req.params.id,
    req.body as UpdateAssignmentInput,
  );
  res.status(200).json({ data });
};

export const deleteAssignment = async (req: Request<IdParam>, res: Response) => {
  await learningService.deleteAssignment(getAuthUser(req), req.params.id);
  res.status(200).json({ message: "Tugas berhasil dihapus" });
};

// ---------- submission ----------
export const createSubmission = async (req: Request, res: Response) => {
  const data = await learningService.createSubmission(getAuthUser(req), req.body as CreateSubmissionInput);
  res.status(201).json({ data });
};

export const listSubmissions = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.listSubmissions(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateSubmission = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.updateSubmission(
    getAuthUser(req),
    req.params.id,
    req.body as UpdateSubmissionInput,
  );
  res.status(200).json({ data });
};

export const gradeSubmission = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.gradeSubmission(
    getAuthUser(req),
    req.params.id,
    req.body as GradeSubmissionInput,
  );
  res.status(200).json({ data });
};

// ---------- grade ----------
export const upsertGrade = async (req: Request, res: Response) => {
  const data = await learningService.upsertGrade(getAuthUser(req), req.body as UpsertGradeInput);
  res.status(200).json({ data });
};

export const bulkUpsertGrades = async (req: Request, res: Response) => {
  const data = await learningService.bulkUpsertGrades(getAuthUser(req), req.body as BulkUpsertGradeInput);
  res.status(200).json({ data });
};

export const listGrades = async (req: Request<IdParam>, res: Response) => {
  const data = await learningService.listGrades(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const deleteGrade = async (req: Request<IdParam>, res: Response) => {
  await learningService.deleteGrade(getAuthUser(req), req.params.id);
  res.status(200).json({ message: "Nilai berhasil dihapus" });
};
