import type { Prisma } from "@src/generated/prisma/client";
import { ResponseError } from "@src/shared/errors/response-error";
import { prismaClient } from "@src/shared/lib/database";
import { pageMeta, toSkipTake } from "@src/shared/lib/pagination";
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

// ======================================================================
// Academic term (periode akademik)
// ======================================================================
const academicTermSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  isActive: true,
} satisfies Prisma.AcademicTermSelect;

// Dua periode tumpang tindih jika masing-masing mulai sebelum yang lain berakhir (batas dihitung inklusif).
const assertTermNotOverlapping = async (startDate: Date, endDate: Date, excludeId?: string) => {
  const overlap = await prismaClient.academicTerm.findFirst({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { name: true },
  });
  if (overlap) {
    throw new ResponseError(409, `Rentang tanggal bertabrakan dengan periode "${overlap.name}"`);
  }
};

const findAcademicTermOrFail = async (id: string) => {
  const term = await prismaClient.academicTerm.findUnique({ where: { id }, select: academicTermSelect });
  if (!term) {
    throw new ResponseError(404, "Periode akademik tidak ditemukan");
  }
  return term;
};

export const createAcademicTerm = async (input: CreateAcademicTermInput) => {
  const { name, startDate, endDate, isActive } = input;

  await assertTermNotOverlapping(startDate, endDate);

  // Hanya satu periode yang boleh aktif: mengaktifkan periode baru menonaktifkan yang lama.
  return prismaClient.$transaction(async (tx) => {
    if (isActive) {
      await tx.academicTerm.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    return tx.academicTerm.create({ data: { name, startDate, endDate, isActive }, select: academicTermSelect });
  });
};

export const listAcademicTerms = async (query: ListAcademicTermQuery) => {
  const { page, limit, search, sortOrder, isActive } = query;

  const where: Prisma.AcademicTermWhereInput = {
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [items, total] = await prismaClient.$transaction([
    prismaClient.academicTerm.findMany({
      where,
      select: academicTermSelect,
      orderBy: [{ startDate: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.academicTerm.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getAcademicTerm = (id: string) => findAcademicTermOrFail(id);

export const updateAcademicTerm = async (id: string, input: UpdateAcademicTermInput) => {
  const current = await findAcademicTermOrFail(id);

  // Jika hanya satu tanggal yang dikirim, bandingkan dengan tanggal yang tersimpan.
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate <= startDate) {
    throw new ResponseError(400, "endDate harus setelah startDate");
  }
  if (input.startDate || input.endDate) {
    await assertTermNotOverlapping(startDate, endDate, id);
  }

  return prismaClient.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.academicTerm.updateMany({ where: { isActive: true, NOT: { id } }, data: { isActive: false } });
    }
    return tx.academicTerm.update({ where: { id }, data: input, select: academicTermSelect });
  });
};

export const deleteAcademicTerm = async (id: string) => {
  await findAcademicTermOrFail(id);

  const used = await prismaClient.courseOffering.count({ where: { termId: id } });
  if (used > 0) {
    throw new ResponseError(409, "Periode masih dipakai oleh course offering, tidak dapat dihapus");
  }

  await prismaClient.academicTerm.delete({ where: { id } });
};

// ======================================================================
// Subject (mata kuliah)
// ======================================================================
const subjectSelect = {
  id: true,
  code: true,
  name: true,
  credits: true,
} satisfies Prisma.SubjectSelect;

const assertSubjectCodeUnique = async (code: string, excludeId?: string) => {
  const found = await prismaClient.subject.findFirst({
    where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (found) {
    throw new ResponseError(409, "Kode mata kuliah sudah dipakai");
  }
};

const findSubjectOrFail = async (id: string) => {
  const subject = await prismaClient.subject.findUnique({ where: { id }, select: subjectSelect });
  if (!subject) {
    throw new ResponseError(404, "Mata kuliah tidak ditemukan");
  }
  return subject;
};

export const createSubject = async (input: CreateSubjectInput) => {
  await assertSubjectCodeUnique(input.code);
  return prismaClient.subject.create({ data: input, select: subjectSelect });
};

export const listSubjects = async (query: ListSubjectQuery) => {
  const { page, limit, search, sortOrder } = query;

  const where: Prisma.SubjectWhereInput = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [items, total] = await prismaClient.$transaction([
    prismaClient.subject.findMany({
      where,
      select: subjectSelect,
      orderBy: [{ code: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.subject.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getSubject = (id: string) => findSubjectOrFail(id);

export const updateSubject = async (id: string, input: UpdateSubjectInput) => {
  await findSubjectOrFail(id);
  if (input.code) await assertSubjectCodeUnique(input.code, id);

  return prismaClient.subject.update({ where: { id }, data: input, select: subjectSelect });
};

export const deleteSubject = async (id: string) => {
  await findSubjectOrFail(id);

  const used = await prismaClient.courseOffering.count({ where: { subjectId: id } });
  if (used > 0) {
    throw new ResponseError(409, "Mata kuliah masih dipakai oleh course offering, tidak dapat dihapus");
  }

  await prismaClient.subject.delete({ where: { id } });
};

// ======================================================================
// Class (kelas / rombongan belajar)
// ======================================================================
const classSelect = {
  id: true,
  name: true,
} satisfies Prisma.ClassGroupSelect;

const findClassOrFail = async (id: string) => {
  const classGroup = await prismaClient.classGroup.findUnique({ where: { id }, select: classSelect });
  if (!classGroup) {
    throw new ResponseError(404, "Kelas tidak ditemukan");
  }
  return classGroup;
};

export const createClass = (input: CreateClassInput) =>
  prismaClient.classGroup.create({ data: input, select: classSelect });

export const listClasses = async (query: ListClassQuery) => {
  const { page, limit, search, sortOrder } = query;

  const where: Prisma.ClassGroupWhereInput = search ? { name: { contains: search, mode: "insensitive" } } : {};

  const [items, total] = await prismaClient.$transaction([
    prismaClient.classGroup.findMany({
      where,
      select: classSelect,
      orderBy: [{ name: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.classGroup.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getClass = (id: string) => findClassOrFail(id);

export const updateClass = async (id: string, input: UpdateClassInput) => {
  await findClassOrFail(id);
  return prismaClient.classGroup.update({ where: { id }, data: input, select: classSelect });
};

export const deleteClass = async (id: string) => {
  await findClassOrFail(id);

  const used = await prismaClient.courseOffering.count({ where: { classId: id } });
  if (used > 0) {
    throw new ResponseError(409, "Kelas masih dipakai oleh course offering, tidak dapat dihapus");
  }

  await prismaClient.classGroup.delete({ where: { id } });
};