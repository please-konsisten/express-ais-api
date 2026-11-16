// Pengecekan "akun ini boleh menyentuh course offering yang mana?". Permission di route hanya menjawab
// "boleh memakai fitur ini?", sedangkan kepemilikan data (dosen pengampu, mahasiswa terdaftar)
// dijawab di sini, dipakai oleh modul course-offering dan learning.
import { ResponseError } from "@src/shared/errors/response-error";
import { prismaClient } from "@src/shared/lib/database";

// Pemanggil service (akun yang login). Sama dengan bentuk req.user.
export type Actor = { id: string; isSuperAdmin: boolean };

export type OfferingAccess = "admin" | "teacher" | "student";

// Super admin: semua offering. Dosen: offering yang diampunya. Mahasiswa: offering yang diikutinya.
export const getOfferingAccess = async (actor: Actor, offeringId: string): Promise<OfferingAccess> => {
  const offering = await prismaClient.courseOffering.findUnique({
    where: { id: offeringId },
    select: { teacher: { select: { accountId: true } } },
  });
  if (!offering) {
    throw new ResponseError(404, "Course offering tidak ditemukan");
  }

  if (actor.isSuperAdmin) return "admin";
  if (offering.teacher.accountId === actor.id) return "teacher";

  const enrollment = await prismaClient.enrollment.findFirst({
    where: { offeringId, student: { accountId: actor.id } },
    select: { id: true },
  });
  if (enrollment) return "student";

  throw new ResponseError(403, "Anda tidak memiliki akses ke course offering ini");
};

// Untuk aksi mengelola isi offering (materi, tugas, nilai, absensi): hanya admin dan dosen pengampu.
export const assertCanManageOffering = async (actor: Actor, offeringId: string): Promise<void> => {
  const access = await getOfferingAccess(actor, offeringId);
  if (access === "student") {
    throw new ResponseError(403, "Hanya dosen pengampu atau admin yang dapat melakukan aksi ini");
  }
};

// Untuk aksi yang hanya boleh dilakukan mahasiswa terdaftar (mengumpulkan tugas): mengembalikan
// id profil mahasiswa dari akun yang login.
export const getEnrolledStudentId = async (actor: Actor, offeringId: string): Promise<string> => {
  const student = await prismaClient.studentProfile.findUnique({
    where: { accountId: actor.id },
    select: { id: true },
  });
  if (!student) {
    throw new ResponseError(403, "Akun ini tidak memiliki profil mahasiswa");
  }

  const enrollment = await prismaClient.enrollment.findUnique({
    where: { offeringId_studentId: { offeringId, studentId: student.id } },
    select: { id: true },
  });
  if (!enrollment) {
    throw new ResponseError(403, "Anda tidak terdaftar pada course offering ini");
  }
  return student.id;
};
