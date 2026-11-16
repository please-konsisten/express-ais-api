import type { Prisma } from "@src/generated/prisma/client";
import { ResponseError } from "@src/shared/errors/response-error";
import { prismaClient } from "@src/shared/lib/database";
import { emptyToNull } from "@src/shared/lib/nullable";
import {
  assertCanManageOffering,
  getEnrolledStudentId,
  getOfferingAccess,
  type Actor,
} from "@src/shared/lib/offering-access";
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

// Aturan akses (lihat shared/lib/offering-access.ts):
//   - materi, tugas, nilai, penilaian: admin atau dosen pengampu
//   - membaca materi/tugas: admin, dosen pengampu, atau mahasiswa terdaftar
//   - mengumpulkan tugas: mahasiswa terdaftar (studentId diambil dari token, bukan body)
//   - nilai dan pengumpulan tugas: mahasiswa hanya melihat miliknya sendiri
// Nilai bertipe Decimal di database; Prisma mengirimnya ke klien sebagai string (mis. "85.50").

// ---------- select ----------
const materialSelect = {
  id: true,
  offeringId: true,
  title: true,
  description: true,
  fileUrl: true,
  createdAt: true,
} satisfies Prisma.MaterialSelect;

const assignmentSelect = {
  id: true,
  offeringId: true,
  title: true,
  description: true,
  dueAt: true,
  maxScore: true,
  createdAt: true,
} satisfies Prisma.AssignmentSelect;

const studentBriefSelect = { id: true, nim: true, fullName: true } satisfies Prisma.StudentProfileSelect;

const submissionSelect = {
  id: true,
  assignmentId: true,
  fileUrl: true,
  submittedAt: true,
  score: true,
  feedback: true,
  student: { select: studentBriefSelect },
} satisfies Prisma.SubmissionSelect;

const gradeSelect = {
  id: true,
  enrollmentId: true,
  component: true,
  score: true,
} satisfies Prisma.GradeSelect;

// ======================================================================
// Material
// ======================================================================
const findMaterialOrFail = async (id: string) => {
  const material = await prismaClient.material.findUnique({ where: { id }, select: materialSelect });
  if (!material) {
    throw new ResponseError(404, "Materi tidak ditemukan");
  }
  return material;
};

export const createMaterial = async (actor: Actor, input: CreateMaterialInput) => {
  await assertCanManageOffering(actor, input.offeringId);

  return prismaClient.material.create({
    data: {
      offeringId: input.offeringId,
      title: input.title,
      description: emptyToNull(input.description) ?? null,
      fileUrl: emptyToNull(input.fileUrl) ?? null,
    },
    select: materialSelect,
  });
};

export const listMaterials = async (actor: Actor, offeringId: string) => {
  await getOfferingAccess(actor, offeringId);

  return prismaClient.material.findMany({
    where: { offeringId },
    select: materialSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
};

export const getMaterial = async (actor: Actor, id: string) => {
  const material = await findMaterialOrFail(id);
  await getOfferingAccess(actor, material.offeringId);
  return material;
};

export const updateMaterial = async (actor: Actor, id: string, input: UpdateMaterialInput) => {
  const material = await findMaterialOrFail(id);
  await assertCanManageOffering(actor, material.offeringId);

  return prismaClient.material.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) ?? null } : {}),
      ...(input.fileUrl !== undefined ? { fileUrl: emptyToNull(input.fileUrl) ?? null } : {}),
    },
    select: materialSelect,
  });
};

export const deleteMaterial = async (actor: Actor, id: string) => {
  const material = await findMaterialOrFail(id);
  await assertCanManageOffering(actor, material.offeringId);

  await prismaClient.material.delete({ where: { id } });
};

// ======================================================================
// Assignment
// ======================================================================
const findAssignmentOrFail = async (id: string) => {
  const assignment = await prismaClient.assignment.findUnique({ where: { id }, select: assignmentSelect });
  if (!assignment) {
    throw new ResponseError(404, "Tugas tidak ditemukan");
  }
  return assignment;
};

export const createAssignment = async (actor: Actor, input: CreateAssignmentInput) => {
  await assertCanManageOffering(actor, input.offeringId);

  return prismaClient.assignment.create({
    data: {
      offeringId: input.offeringId,
      title: input.title,
      description: emptyToNull(input.description) ?? null,
      dueAt: input.dueAt ?? null,
      maxScore: input.maxScore,
    },
    select: assignmentSelect,
  });
};

// Dosen/admin melihat jumlah pengumpulan per tugas; mahasiswa melihat pengumpulan miliknya.
export const listAssignments = async (actor: Actor, offeringId: string) => {
  const access = await getOfferingAccess(actor, offeringId);

  if (access === "student") {
    return prismaClient.assignment.findMany({
      where: { offeringId },
      select: {
        ...assignmentSelect,
        submissions: {
          where: { student: { accountId: actor.id } },
          select: { id: true, fileUrl: true, submittedAt: true, score: true, feedback: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    });
  }

  return prismaClient.assignment.findMany({
    where: { offeringId },
    select: { ...assignmentSelect, _count: { select: { submissions: true } } },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
  });
};

export const getAssignment = async (actor: Actor, id: string) => {
  const assignment = await findAssignmentOrFail(id);
  await getOfferingAccess(actor, assignment.offeringId);
  return assignment;
};

export const updateAssignment = async (actor: Actor, id: string, input: UpdateAssignmentInput) => {
  const assignment = await findAssignmentOrFail(id);
  await assertCanManageOffering(actor, assignment.offeringId);

  // maxScore tidak boleh lebih kecil dari nilai yang sudah diberikan.
  if (input.maxScore !== undefined) {
    const { _max } = await prismaClient.submission.aggregate({
      where: { assignmentId: id },
      _max: { score: true },
    });
    if (_max.score && _max.score.greaterThan(input.maxScore)) {
      throw new ResponseError(409, `maxScore tidak boleh kurang dari nilai tertinggi yang sudah diberikan (${_max.score})`);
    }
  }

  return prismaClient.assignment.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: emptyToNull(input.description) ?? null } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      ...(input.maxScore !== undefined ? { maxScore: input.maxScore } : {}),
    },
    select: assignmentSelect,
  });
};

// Pengumpulan tugas ikut terhapus oleh cascade, jadi tugas yang sudah dikumpulkan tidak boleh dihapus.
export const deleteAssignment = async (actor: Actor, id: string) => {
  const assignment = await findAssignmentOrFail(id);
  await assertCanManageOffering(actor, assignment.offeringId);

  const submissions = await prismaClient.submission.count({ where: { assignmentId: id } });
  if (submissions > 0) {
    throw new ResponseError(409, "Tugas sudah memiliki pengumpulan mahasiswa, tidak dapat dihapus");
  }

  await prismaClient.assignment.delete({ where: { id } });
};

// ======================================================================
// Submission
// ======================================================================
const isPastDue = (dueAt: Date | null) => dueAt !== null && dueAt.getTime() < Date.now();

export const createSubmission = async (actor: Actor, input: CreateSubmissionInput) => {
  const assignment = await findAssignmentOrFail(input.assignmentId);
  const studentId = await getEnrolledStudentId(actor, assignment.offeringId);

  if (isPastDue(assignment.dueAt)) {
    throw new ResponseError(400, "Batas waktu pengumpulan tugas sudah lewat");
  }

  const existing = await prismaClient.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
    select: { id: true },
  });
  if (existing) {
    throw new ResponseError(409, "Anda sudah mengumpulkan tugas ini, gunakan fitur ubah pengumpulan");
  }

  return prismaClient.submission.create({
    data: { assignmentId: assignment.id, studentId, fileUrl: input.fileUrl },
    select: submissionSelect,
  });
};

// Dosen/admin melihat semua pengumpulan; mahasiswa hanya miliknya.
export const listSubmissions = async (actor: Actor, assignmentId: string) => {
  const assignment = await findAssignmentOrFail(assignmentId);
  const access = await getOfferingAccess(actor, assignment.offeringId);

  return prismaClient.submission.findMany({
    where: { assignmentId, ...(access === "student" ? { student: { accountId: actor.id } } : {}) },
    select: submissionSelect,
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });
};

// Hanya pemilik yang boleh mengubah, selama belum dinilai dan belum lewat tenggat.
export const updateSubmission = async (actor: Actor, id: string, input: UpdateSubmissionInput) => {
  const submission = await prismaClient.submission.findUnique({
    where: { id },
    select: {
      id: true,
      score: true,
      student: { select: { accountId: true } },
      assignment: { select: { dueAt: true } },
    },
  });
  if (!submission) {
    throw new ResponseError(404, "Pengumpulan tugas tidak ditemukan");
  }
  if (submission.student.accountId !== actor.id) {
    throw new ResponseError(403, "Anda hanya dapat mengubah pengumpulan tugas milik sendiri");
  }
  if (submission.score !== null) {
    throw new ResponseError(409, "Pengumpulan yang sudah dinilai tidak dapat diubah");
  }
  if (isPastDue(submission.assignment.dueAt)) {
    throw new ResponseError(400, "Batas waktu pengumpulan tugas sudah lewat");
  }

  return prismaClient.submission.update({
    where: { id },
    data: { fileUrl: input.fileUrl, submittedAt: new Date() },
    select: submissionSelect,
  });
};

export const gradeSubmission = async (actor: Actor, id: string, input: GradeSubmissionInput) => {
  const submission = await prismaClient.submission.findUnique({
    where: { id },
    select: { id: true, assignment: { select: { offeringId: true, maxScore: true } } },
  });
  if (!submission) {
    throw new ResponseError(404, "Pengumpulan tugas tidak ditemukan");
  }
  await assertCanManageOffering(actor, submission.assignment.offeringId);

  if (submission.assignment.maxScore.lessThan(input.score)) {
    throw new ResponseError(400, `Nilai tidak boleh melebihi maxScore tugas (${submission.assignment.maxScore})`);
  }

  return prismaClient.submission.update({
    where: { id },
    data: {
      score: input.score,
      ...(input.feedback !== undefined ? { feedback: emptyToNull(input.feedback) ?? null } : {}),
    },
    select: submissionSelect,
  });
};

// ======================================================================
// Grade (nilai per komponen: UTS, UAS, TUGAS, ...)
// ======================================================================
// Aman dipanggil ulang: komponen yang sudah ada diperbarui nilainya.
export const upsertGrade = async (actor: Actor, input: UpsertGradeInput) => {
  const enrollment = await prismaClient.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, offeringId: true },
  });
  if (!enrollment) {
    throw new ResponseError(404, "Pendaftaran mahasiswa tidak ditemukan");
  }
  await assertCanManageOffering(actor, enrollment.offeringId);

  return prismaClient.grade.upsert({
    where: { enrollmentId_component: { enrollmentId: enrollment.id, component: input.component } },
    create: { enrollmentId: enrollment.id, component: input.component, score: input.score },
    update: { score: input.score },
    select: gradeSelect,
  });
};

// Input nilai massal untuk satu komponen. Semua atau tidak sama sekali (satu transaksi).
export const bulkUpsertGrades = async (actor: Actor, input: BulkUpsertGradeInput) => {
  const { offeringId, component, grades } = input;
  await assertCanManageOffering(actor, offeringId);

  const enrollmentIds = grades.map((g) => g.enrollmentId);
  const valid = await prismaClient.enrollment.findMany({
    where: { offeringId, id: { in: enrollmentIds } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((e) => e.id));
  const invalid = enrollmentIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new ResponseError(400, `${invalid.length} enrollmentId bukan milik course offering ini`);
  }

  return prismaClient.$transaction(
    grades.map(({ enrollmentId, score }) =>
      prismaClient.grade.upsert({
        where: { enrollmentId_component: { enrollmentId, component } },
        create: { enrollmentId, component, score },
        update: { score },
        select: gradeSelect,
      }),
    ),
  );
};

// Dosen/admin melihat nilai seluruh mahasiswa di offering; mahasiswa hanya nilainya sendiri.
export const listGrades = async (actor: Actor, offeringId: string) => {
  const access = await getOfferingAccess(actor, offeringId);

  return prismaClient.enrollment.findMany({
    where: { offeringId, ...(access === "student" ? { student: { accountId: actor.id } } : {}) },
    select: {
      id: true,
      student: { select: studentBriefSelect },
      grades: { select: { id: true, component: true, score: true }, orderBy: { component: "asc" } },
    },
    orderBy: [{ student: { fullName: "asc" } }, { id: "asc" }],
  });
};

export const deleteGrade = async (actor: Actor, id: string) => {
  const grade = await prismaClient.grade.findUnique({
    where: { id },
    select: { id: true, enrollment: { select: { offeringId: true } } },
  });
  if (!grade) {
    throw new ResponseError(404, "Nilai tidak ditemukan");
  }
  await assertCanManageOffering(actor, grade.enrollment.offeringId);

  await prismaClient.grade.delete({ where: { id } });
};
