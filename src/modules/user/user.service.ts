import type { Prisma } from "@src/generated/prisma/client";
import { ResponseError } from "@src/shared/errors/response-error";
import { prismaClient } from "@src/shared/lib/database";
import { pageMeta, toSkipTake } from "@src/shared/lib/pagination";
import { hashPassword } from "@src/shared/lib/password";
import type {
  CreateUserInput,
  ListStudentQuery,
  ListTeacherQuery,
  ListUserQuery,
  ResetUserPasswordInput,
  TeacherProfileInput,
  UpdateMyStudentProfileInput,
  UpdateMyTeacherProfileInput,
  UpdateStudentInput,
  UpdateTeacherInput,
  UpdateUserInput,
} from "./user.schema";

// ---------- select (hashPassword tidak pernah ikut dikembalikan) ----------
const roleSelect = { id: true, name: true, isSuperAdmin: true } satisfies Prisma.RoleSelect;

const studentSelect = {
  id: true,
  nim: true,
  fullName: true,
  phoneNumber: true,
  address: true,
  studyProgram: true,
  batchYear: true,
  semester: true,
  academicStatus: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StudentProfileSelect;

const teacherSelect = {
  id: true,
  nip: true,
  nidn: true,
  titlePrefix: true,
  fullName: true,
  titleSuffix: true,
  phoneNumber: true,
  department: true,
  officeLocation: true,
  expertise: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeacherProfileSelect;

const accountSummarySelect = {
  id: true,
  email: true,
  username: true,
  isActive: true,
} satisfies Prisma.AccountSelect;

const accountSelect = {
  ...accountSummarySelect,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: roleSelect },
  student: { select: studentSelect },
  teacher: { select: teacherSelect },
} satisfies Prisma.AccountSelect;

const studentWithAccountSelect = {
  ...studentSelect,
  account: { select: accountSummarySelect },
} satisfies Prisma.StudentProfileSelect;

const teacherWithAccountSelect = {
  ...teacherSelect,
  account: { select: accountSummarySelect },
} satisfies Prisma.TeacherProfileSelect;

// ---------- helper ----------
// Role bernama "student" / "teacher" wajib punya profil yang sesuai; role lain (admin, dst.) tidak punya profil.
// Nama role ini dibuat oleh prisma/seed.ts.
const ROLE_STUDENT = "student";
const ROLE_TEACHER = "teacher";

type ProfileKind = "student" | "teacher" | null;

const profileKindOf = (roleName: string): ProfileKind => {
  const name = roleName.toLowerCase();
  if (name === ROLE_STUDENT) return "student";
  if (name === ROLE_TEACHER) return "teacher";
  return null;
};

// Field opsional boleh dikirim "" untuk mengosongkan, tapi di database harus NULL
// (kolom unik seperti nidn tidak boleh menyimpan "" lebih dari satu baris).
const blankToNull = <T extends object>(data: T, keys: readonly (keyof T)[]): T => {
  const out = { ...data } as Record<keyof T, unknown>;
  for (const key of keys) {
    if (out[key] === "") out[key] = null;
  }
  return out as T;
};

const TEACHER_NULLABLE = ["nidn", "titlePrefix", "titleSuffix", "department"] as const;

// Pemanggil service (user yang login). Service tidak mempercayai route begitu saja:
// permission di route hanya menjawab "boleh mengelola akun?", sedangkan "akun mana?" dijawab di sini.
export type Actor = { id: string; isSuperAdmin: boolean };

// Eskalasi hak akses: pemegang user.* yang bukan super admin tidak boleh membuat, mengubah,
// mereset password, atau menonaktifkan akun super admin, dan tidak boleh menjadikan akun lain super admin.
const assertCanManageRole = (actor: Actor, role: { isSuperAdmin: boolean }) => {
  if (role.isSuperAdmin && !actor.isSuperAdmin) {
    throw new ResponseError(403, "Hanya super admin yang dapat mengelola akun super admin");
  }
};

const findRoleOrFail = async (roleId: string) => {
  const role = await prismaClient.role.findUnique({ where: { id: roleId }, select: roleSelect });
  if (!role) {
    throw new ResponseError(404, "Role tidak ditemukan");
  }
  return role;
};

const assertAccountUnique = async (
  data: { email?: string | undefined; username?: string | undefined },
  excludeId?: string,
) => {
  const or: Prisma.AccountWhereInput[] = [];
  if (data.email) or.push({ email: data.email });
  if (data.username) or.push({ username: data.username });
  if (or.length === 0) return;

  const found = await prismaClient.account.findFirst({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { email: true, username: true },
  });
  if (found) {
    throw new ResponseError(409, found.email === data.email ? "Email sudah terdaftar" : "Username sudah dipakai");
  }
};

const assertNimUnique = async (nim: string, excludeId?: string) => {
  const found = await prismaClient.studentProfile.findFirst({
    where: { nim, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (found) {
    throw new ResponseError(409, "NIM sudah terdaftar");
  }
};

const assertTeacherUnique = async (
  data: { nip?: string | undefined; nidn?: string | null | undefined },
  excludeId?: string,
) => {
  const or: Prisma.TeacherProfileWhereInput[] = [];
  if (data.nip) or.push({ nip: data.nip });
  if (data.nidn) or.push({ nidn: data.nidn });
  if (or.length === 0) return;

  const found = await prismaClient.teacherProfile.findFirst({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { nip: true },
  });
  if (found) {
    throw new ResponseError(409, found.nip === data.nip ? "NIP sudah terdaftar" : "NIDN sudah terdaftar");
  }
};

// ======================================================================
// Akun (Admin)
// ======================================================================
export const createUser = async (actor: Actor, input: CreateUserInput) => {
  const role = await findRoleOrFail(input.roleId);
  assertCanManageRole(actor, role);
  const kind = profileKindOf(role.name);

  if (kind === "student" && !input.student) {
    throw new ResponseError(400, "Data mahasiswa wajib diisi untuk role student");
  }
  if (kind === "teacher" && !input.teacher) {
    throw new ResponseError(400, "Data dosen wajib diisi untuk role teacher");
  }
  if (kind !== "student" && input.student) {
    throw new ResponseError(400, "Role ini tidak memiliki profil mahasiswa");
  }
  if (kind !== "teacher" && input.teacher) {
    throw new ResponseError(400, "Role ini tidak memiliki profil dosen");
  }

  await assertAccountUnique({ email: input.email, username: input.username });
  if (input.student) await assertNimUnique(input.student.nim);

  const teacher: TeacherProfileInput | undefined = input.teacher && blankToNull(input.teacher, TEACHER_NULLABLE);
  if (teacher) await assertTeacherUnique({ nip: teacher.nip, nidn: teacher.nidn });

  const passwordHash = await hashPassword(input.password);

  // Akun dan profil dibuat dalam satu operasi (nested create), jadi tidak ada akun tanpa profil.
  return prismaClient.account.create({
    data: {
      email: input.email,
      username: input.username,
      hashPassword: passwordHash,
      isActive: input.isActive,
      roleId: input.roleId,
      ...(input.student ? { student: { create: input.student } } : {}),
      ...(teacher ? { teacher: { create: teacher } } : {}),
    },
    select: accountSelect,
  });
};

export const listUsers = async (query: ListUserQuery) => {
  const { page, limit, search, sortOrder, roleId, isActive } = query;

  const where: Prisma.AccountWhereInput = {
    ...(roleId ? { roleId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { student: { fullName: { contains: search, mode: "insensitive" } } },
            { student: { nim: { contains: search, mode: "insensitive" } } },
            { teacher: { fullName: { contains: search, mode: "insensitive" } } },
            { teacher: { nip: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prismaClient.$transaction([
    prismaClient.account.findMany({
      where,
      select: accountSelect,
      orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.account.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getUser = async (id: string) => {
  const user = await prismaClient.account.findUnique({ where: { id }, select: accountSelect });
  if (!user) {
    throw new ResponseError(404, "User tidak ditemukan");
  }
  return user;
};

export const updateUser = async (actor: Actor, id: string, input: UpdateUserInput) => {
  const account = await prismaClient.account.findUnique({
    where: { id },
    select: {
      id: true,
      roleId: true,
      role: { select: { isSuperAdmin: true } },
      student: { select: { id: true } },
      teacher: { select: { id: true } },
    },
  });
  if (!account) {
    throw new ResponseError(404, "User tidak ditemukan");
  }

  // Akun super admin hanya boleh disentuh super admin (email, username, status, role).
  assertCanManageRole(actor, account.role);

  const roleChanged = input.roleId !== undefined && input.roleId !== account.roleId;

  // Admin tidak boleh mengunci dirinya sendiri keluar dari sistem. Aturan ini sekaligus menjamin
  // selalu ada minimal satu super admin aktif: pelaku harus super admin aktif (lihat authenticate),
  // dan tidak bisa menonaktifkan atau menurunkan dirinya sendiri.
  if (actor.id === id) {
    if (input.isActive === false) {
      throw new ResponseError(400, "Anda tidak dapat menonaktifkan akun sendiri");
    }
    if (roleChanged) {
      throw new ResponseError(400, "Anda tidak dapat mengubah role akun sendiri");
    }
  }

  if (input.roleId !== undefined && roleChanged) {
    const newRole = await findRoleOrFail(input.roleId);
    assertCanManageRole(actor, newRole);
    // Profil mahasiswa/dosen hanya dibuat saat akun dibuat, jadi role yang terikat profil
    // tidak boleh diganti, dan role student/teacher tidak bisa dipasang ke akun tanpa profil.
    if (account.student || account.teacher || profileKindOf(newRole.name) !== null) {
      throw new ResponseError(
        400,
        "Role akun dengan profil mahasiswa/dosen tidak dapat diubah, dan role student/teacher hanya bisa dipilih saat akun dibuat",
      );
    }
  }

  await assertAccountUnique({ email: input.email, username: input.username }, id);

  return prismaClient.$transaction(async (tx) => {
    const updated = await tx.account.update({ where: { id }, data: input, select: accountSelect });
    // Akun yang dinonaktifkan tidak boleh bisa memperbarui sesi lagi.
    if (input.isActive === false) {
      await tx.refreshToken.deleteMany({ where: { accountId: id } });
    }
    return updated;
  });
};

// Password lama tidak diperlukan (admin). Semua sesi user dicabut agar password lama tidak bisa dipakai lagi.
export const resetUserPassword = async (actor: Actor, id: string, input: ResetUserPasswordInput) => {
  const account = await prismaClient.account.findUnique({
    where: { id },
    select: { id: true, role: { select: { isSuperAdmin: true } } },
  });
  if (!account) {
    throw new ResponseError(404, "User tidak ditemukan");
  }
  assertCanManageRole(actor, account.role);

  const passwordHash = await hashPassword(input.newPassword);

  await prismaClient.$transaction([
    prismaClient.account.update({ where: { id }, data: { hashPassword: passwordHash } }),
    prismaClient.refreshToken.deleteMany({ where: { accountId: id } }),
  ]);
};

// ======================================================================
// Mahasiswa (Admin)
// ======================================================================
export const listStudents = async (query: ListStudentQuery) => {
  const { page, limit, search, sortOrder, classId, studyProgram, batchYear, academicStatus } = query;

  const where: Prisma.StudentProfileWhereInput = {
    ...(studyProgram ? { studyProgram } : {}),
    ...(batchYear !== undefined ? { batchYear } : {}),
    ...(academicStatus ? { academicStatus } : {}),
    ...(classId ? { enrollments: { some: { offering: { classId } } } } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { nim: { contains: search, mode: "insensitive" } },
            { account: { email: { contains: search, mode: "insensitive" } } },
            { account: { username: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prismaClient.$transaction([
    prismaClient.studentProfile.findMany({
      where,
      select: studentWithAccountSelect,
      orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.studentProfile.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getStudent = async (id: string) => {
  const student = await prismaClient.studentProfile.findUnique({ where: { id }, select: studentWithAccountSelect });
  if (!student) {
    throw new ResponseError(404, "Mahasiswa tidak ditemukan");
  }
  return student;
};

export const updateStudent = async (id: string, input: UpdateStudentInput) => {
  const exists = await prismaClient.studentProfile.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new ResponseError(404, "Mahasiswa tidak ditemukan");
  }
  if (input.nim) await assertNimUnique(input.nim, id);

  return prismaClient.studentProfile.update({ where: { id }, data: input, select: studentWithAccountSelect });
};

// ======================================================================
// Dosen (Admin)
// ======================================================================
export const listTeachers = async (query: ListTeacherQuery) => {
  const { page, limit, search, sortOrder, department, isActive } = query;

  const where: Prisma.TeacherProfileWhereInput = {
    ...(department ? { department } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { nip: { contains: search, mode: "insensitive" } },
            { nidn: { contains: search, mode: "insensitive" } },
            { account: { email: { contains: search, mode: "insensitive" } } },
            { account: { username: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prismaClient.$transaction([
    prismaClient.teacherProfile.findMany({
      where,
      select: teacherWithAccountSelect,
      orderBy: [{ createdAt: sortOrder }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.teacherProfile.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getTeacher = async (id: string) => {
  const teacher = await prismaClient.teacherProfile.findUnique({ where: { id }, select: teacherWithAccountSelect });
  if (!teacher) {
    throw new ResponseError(404, "Dosen tidak ditemukan");
  }
  return teacher;
};

export const updateTeacher = async (id: string, input: UpdateTeacherInput) => {
  const exists = await prismaClient.teacherProfile.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new ResponseError(404, "Dosen tidak ditemukan");
  }

  const data = blankToNull(input, TEACHER_NULLABLE);
  await assertTeacherUnique({ nip: data.nip, nidn: data.nidn }, id);

  return prismaClient.teacherProfile.update({ where: { id }, data, select: teacherWithAccountSelect });
};

// ======================================================================
// Self-service (user yang sedang login)
// ======================================================================
export const getMe = async (accountId: string) => getUser(accountId);

export const updateMyStudentProfile = async (accountId: string, input: UpdateMyStudentProfileInput) => {
  const profile = await prismaClient.studentProfile.findUnique({ where: { accountId }, select: { id: true } });
  if (!profile) {
    throw new ResponseError(404, "Akun ini tidak memiliki profil mahasiswa");
  }

  return prismaClient.studentProfile.update({
    where: { id: profile.id },
    data: blankToNull(input, ["phoneNumber", "address", "avatarUrl"]),
    select: studentSelect,
  });
};

export const updateMyTeacherProfile = async (accountId: string, input: UpdateMyTeacherProfileInput) => {
  const profile = await prismaClient.teacherProfile.findUnique({ where: { accountId }, select: { id: true } });
  if (!profile) {
    throw new ResponseError(404, "Akun ini tidak memiliki profil dosen");
  }

  return prismaClient.teacherProfile.update({
    where: { id: profile.id },
    data: blankToNull(input, ["phoneNumber", "officeLocation", "expertise", "avatarUrl"]),
    select: teacherSelect,
  });
};