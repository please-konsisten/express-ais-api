// Aktivitas belajar-mengajar dalam satu course offering: materi, tugas, pengumpulan tugas, dan nilai.
import Joi from "joi";
import { requiredUuid } from "@src/shared/schemas/common.schema";

// ---------- tipe ----------
export type CreateMaterialInput = {
  offeringId: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
};
export type UpdateMaterialInput = {
  title?: string;
  description?: string | null;
  fileUrl?: string | null;
};

export type CreateAssignmentInput = {
  offeringId: string;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
  maxScore: number;
};
export type UpdateAssignmentInput = {
  title?: string;
  description?: string | null;
  dueAt?: Date | null;
  maxScore?: number;
};

export type CreateSubmissionInput = { assignmentId: string; fileUrl: string };
export type UpdateSubmissionInput = { fileUrl: string };
export type GradeSubmissionInput = { score: number; feedback?: string | null };

export type UpsertGradeInput = {
  enrollmentId: string;
  component: string;
  score: number;
};
export type BulkUpsertGradeInput = {
  offeringId: string;
  component: string;
  grades: { enrollmentId: string; score: number }[];
};

// ---------- material ----------
export const createMaterialSchema = Joi.object<CreateMaterialInput>({
  offeringId: requiredUuid,
  title: Joi.string().trim().min(2).max(255).required(),
  description: Joi.string().trim().allow(null, "").optional(),
  fileUrl: Joi.string().trim().uri().max(500).allow(null, "").optional(),
});

export const updateMaterialSchema = Joi.object<UpdateMaterialInput>({
  title: Joi.string().trim().min(2).max(255),
  description: Joi.string().trim().allow(null, ""),
  fileUrl: Joi.string().trim().uri().max(500).allow(null, ""),
}).min(1);

// ---------- assignment ----------
const assignmentMaxScore = Joi.number().precision(2).positive().max(999.99);

export const createAssignmentSchema = Joi.object<CreateAssignmentInput>({
  offeringId: requiredUuid,
  title: Joi.string().trim().min(2).max(255).required(),
  description: Joi.string().trim().allow(null, "").optional(),
  dueAt: Joi.date().iso().allow(null).optional(),
  maxScore: assignmentMaxScore.default(100),
});

export const updateAssignmentSchema = Joi.object<UpdateAssignmentInput>({
  title: Joi.string().trim().min(2).max(255),
  description: Joi.string().trim().allow(null, ""),
  dueAt: Joi.date().iso().allow(null),
  maxScore: assignmentMaxScore,
}).min(1);

// ---------- submission ----------
// Mahasiswa mengumpulkan tugas (studentId diambil dari token, bukan body).
// Sudah lewat tenggat / sudah pernah mengumpulkan? Dicek di service.
export const createSubmissionSchema = Joi.object<CreateSubmissionInput>({
  assignmentId: requiredUuid,
  fileUrl: Joi.string().trim().uri().max(500).required(),
});

export const updateSubmissionSchema = Joi.object<UpdateSubmissionInput>({
  fileUrl: Joi.string().trim().uri().max(500).required(),
});

// Dosen memberi nilai pada pengumpulan tugas.
// score <= maxScore milik assignment-nya dicek di service (butuh data assignment).
export const gradeSubmissionSchema = Joi.object<GradeSubmissionInput>({
  score: Joi.number().precision(2).min(0).max(999.99).required(),
  feedback: Joi.string().trim().allow(null, "").optional(),
});

// ---------- grade ----------
const component = Joi.string().trim().uppercase().min(1).max(30); // UTS, UAS, TUGAS, dst.
const score = Joi.number().precision(2).min(0).max(100);

// enrollmentId milik offering yang benar? Dicek di service.
export const upsertGradeSchema = Joi.object<UpsertGradeInput>({
  enrollmentId: requiredUuid,
  component: component.required(),
  score: score.required(),
});

// Input nilai massal untuk satu komponen pada satu course offering
export const bulkUpsertGradeSchema = Joi.object<BulkUpsertGradeInput>({
  offeringId: requiredUuid,
  component: component.required(),
  grades: Joi.array()
    .items(
      Joi.object({
        enrollmentId: requiredUuid,
        score: score.required(),
      })
    )
    .min(1)
    .unique("enrollmentId")
    .required(),
});
