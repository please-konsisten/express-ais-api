import type { Prisma } from "@src/generated/prisma/client";
import { ResponseError } from "@src/shared/errors/response-error";
import { prismaClient } from "@src/shared/lib/database";
import {
  assertCanManageOffering,
  getOfferingAccess,
  type Actor,
} from "@src/shared/lib/offering-access";
import { emptyToNull } from "@src/shared/lib/nullable";
import { pageMeta, toSkipTake } from "@src/shared/lib/pagination";
import type {
  CreateAttendanceSessionInput,
  CreateCourseOfferingInput,
  CreateScheduleInput,
  EnrollStudentsInput,
  ListCourseOfferingQuery,
  RecordAttendanceInput,
  UnenrollStudentInput,
  UpdateAttendanceRecordInput,
  UpdateAttendanceSessionInput,
  UpdateCourseOfferingInput,
  UpdateScheduleInput,
} from "./course-offering.schema";

// Permission di route menjawab "boleh memakai fitur ini?". Kepemilikan data (dosen pengampu,
// mahasiswa terdaftar) dijawab di sini lewat shared/lib/offering-access.ts:
//   - mengatur offering, jadwal, dan enrollment: tingkat admin (dijaga permission di route)
//   - membaca offering/jadwal/absensi: admin, dosen pengampu, atau mahasiswa terdaftar
//   - mengelola absensi: admin atau dosen pengampu

// ---------- select ----------
const teacherBriefSelect = {
  id: true,
  nip: true,
  fullName: true,
  titlePrefix: true,
  titleSuffix: true,
} satisfies Prisma.TeacherProfileSelect;

const offeringSelect = {
  id: true,
  termId: true,
  subjectId: true,
  classId: true,
  teacherId: true,
  term: { select: { id: true, name: true, isActive: true } },
  subject: { select: { id: true, code: true, name: true, credits: true } },
  class: { select: { id: true, name: true } },
  teacher: { select: teacherBriefSelect },
  _count: { select: { enrollments: true } },
} satisfies Prisma.CourseOfferingSelect;

const scheduleSelect = {
  id: true,
  offeringId: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
} satisfies Prisma.ScheduleSelect;

const studentBriefSelect = {
  id: true,
  nim: true,
  fullName: true,
  studyProgram: true,
  semester: true,
  academicStatus: true,
} satisfies Prisma.StudentProfileSelect;

const attendanceSessionSelect = {
  id: true,
  offeringId: true,
  meetingNo: true,
  meetingDate: true,
} satisfies Prisma.AttendanceSessionSelect;

// ---------- helper ----------
// Kolom TIME di database dipetakan Prisma ke Date (tanggal 1970-01-01, zona UTC).
// API memakai string "HH:mm", jadi dikonversi bolak-balik di sini.
const toTimeDate = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const toHhmm = (date: Date) => date.toISOString().slice(11, 16);

const presentSchedule = <T extends { startTime: Date; endTime: Date }>(schedule: T) => ({
  ...schedule,
  startTime: toHhmm(schedule.startTime),
  endTime: toHhmm(schedule.endTime),
});

const assertEndAfterStart = (startTime: string, endTime: string) => {
  if (endTime <= startTime) {
    throw new ResponseError(400, "endTime harus setelah startTime");
  }
};

const findTeacherOrFail = async (teacherId: string) => {
  const teacher = await prismaClient.teacherProfile.findUnique({
    where: { id: teacherId },
    select: { id: true, isActive: true },
  });
  if (!teacher) {
    throw new ResponseError(404, "Dosen tidak ditemukan");
  }
  if (!teacher.isActive) {
    throw new ResponseError(400, "Dosen tidak aktif");
  }
  return teacher;
};

const findOfferingOrFail = async (id: string) => {
  const offering = await prismaClient.courseOffering.findUnique({
    where: { id },
    select: { id: true, termId: true, classId: true, teacherId: true },
  });
  if (!offering) {
    throw new ResponseError(404, "Course offering tidak ditemukan");
  }
  return offering;
};

type ScheduleSlot = { dayOfWeek: number; startTime: Date; endTime: Date; room: string | null | undefined };

// Jadwal bentrok jika, pada hari dan periode yang sama, jamnya beririsan dan:
// dosennya sama, kelasnya sama, atau ruangannya sama. Jam yang berurutan (selesai 10:00, mulai 10:00) tidak bentrok.
const assertNoScheduleConflict = async (
  offering: { termId: string; teacherId: string; classId: string },
  slot: ScheduleSlot,
  excludeScheduleId?: string,
) => {
  const room = emptyToNull(slot.room);

  const conflict = await prismaClient.schedule.findFirst({
    where: {
      dayOfWeek: slot.dayOfWeek,
      startTime: { lt: slot.endTime },
      endTime: { gt: slot.startTime },
      offering: { termId: offering.termId },
      ...(excludeScheduleId ? { NOT: { id: excludeScheduleId } } : {}),
      OR: [
        { offering: { teacherId: offering.teacherId } },
        { offering: { classId: offering.classId } },
        ...(room ? [{ room: { equals: room, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { room: true, offering: { select: { teacherId: true, classId: true } } },
  });
  if (!conflict) return;

  if (conflict.offering.teacherId === offering.teacherId) {
    throw new ResponseError(409, "Dosen sudah memiliki jadwal lain pada waktu tersebut");
  }
  if (conflict.offering.classId === offering.classId) {
    throw new ResponseError(409, "Kelas sudah memiliki jadwal lain pada waktu tersebut");
  }
  throw new ResponseError(409, "Ruangan sudah dipakai pada waktu tersebut");
};

// ======================================================================
// Course offering
// ======================================================================
export const createCourseOffering = async (input: CreateCourseOfferingInput) => {
  const { termId, subjectId, classId, teacherId } = input;

  const [term, subject, classGroup] = await Promise.all([
    prismaClient.academicTerm.findUnique({ where: { id: termId }, select: { id: true } }),
    prismaClient.subject.findUnique({ where: { id: subjectId }, select: { id: true } }),
    prismaClient.classGroup.findUnique({ where: { id: classId }, select: { id: true } }),
  ]);
  if (!term) throw new ResponseError(404, "Periode akademik tidak ditemukan");
  if (!subject) throw new ResponseError(404, "Mata kuliah tidak ditemukan");
  if (!classGroup) throw new ResponseError(404, "Kelas tidak ditemukan");
  await findTeacherOrFail(teacherId);

  const duplicate = await prismaClient.courseOffering.findUnique({
    where: { termId_subjectId_classId: { termId, subjectId, classId } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ResponseError(409, "Mata kuliah ini sudah dibuka untuk kelas dan periode tersebut");
  }

  return prismaClient.courseOffering.create({ data: input, select: offeringSelect });
};

// Super admin melihat semua. Akun lain hanya offering yang diampu (dosen) atau diikuti (mahasiswa).
export const listCourseOfferings = async (actor: Actor, query: ListCourseOfferingQuery) => {
  const { page, limit, search, sortOrder, termId, subjectId, classId, teacherId } = query;

  const scope: Prisma.CourseOfferingWhereInput = actor.isSuperAdmin
    ? {}
    : {
        OR: [
          { teacher: { accountId: actor.id } },
          { enrollments: { some: { student: { accountId: actor.id } } } },
        ],
      };

  const filters: Prisma.CourseOfferingWhereInput = {
    ...(termId ? { termId } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(classId ? { classId } : {}),
    ...(teacherId ? { teacherId } : {}),
    ...(search
      ? {
          OR: [
            { subject: { name: { contains: search, mode: "insensitive" } } },
            { subject: { code: { contains: search, mode: "insensitive" } } },
            { class: { name: { contains: search, mode: "insensitive" } } },
            { teacher: { fullName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const where: Prisma.CourseOfferingWhereInput = { AND: [scope, filters] };

  const [items, total] = await prismaClient.$transaction([
    prismaClient.courseOffering.findMany({
      where,
      select: offeringSelect,
      orderBy: [{ subject: { name: sortOrder } }, { id: "asc" }],
      ...toSkipTake(query),
    }),
    prismaClient.courseOffering.count({ where }),
  ]);

  return { items, meta: pageMeta(page, limit, total) };
};

export const getCourseOffering = async (actor: Actor, id: string) => {
  await getOfferingAccess(actor, id);

  const offering = await prismaClient.courseOffering.findUnique({ where: { id }, select: offeringSelect });
  if (!offering) {
    throw new ResponseError(404, "Course offering tidak ditemukan");
  }
  return offering;
};

// Hanya dosen pengampu yang bisa diganti. Term/mata kuliah/kelas tidak diubah (buat offering baru).
export const updateCourseOffering = async (id: string, input: UpdateCourseOfferingInput) => {
  const offering = await findOfferingOrFail(id);

  if (input.teacherId && input.teacherId !== offering.teacherId) {
    await findTeacherOrFail(input.teacherId);

    // Dosen baru tidak boleh bentrok dengan jadwal yang sudah ada di offering ini.
    const schedules = await prismaClient.schedule.findMany({ where: { offeringId: id }, select: scheduleSelect });
    for (const schedule of schedules) {
      await assertNoScheduleConflict(
        { termId: offering.termId, teacherId: input.teacherId, classId: offering.classId },
        schedule,
        schedule.id,
      );
    }
  }

  return prismaClient.courseOffering.update({ where: { id }, data: input, select: offeringSelect });
};

// Enrollment, materi, tugas, dan absensi ikut terhapus oleh cascade, termasuk nilai mahasiswa,
// jadi offering yang sudah berisi data tidak boleh dihapus begitu saja.
export const deleteCourseOffering = async (id: string) => {
  const offering = await prismaClient.courseOffering.findUnique({
    where: { id },
    select: {
      _count: { select: { enrollments: true, materials: true, assignments: true, attendanceSessions: true } },
    },
  });
  if (!offering) {
    throw new ResponseError(404, "Course offering tidak ditemukan");
  }

  const { enrollments, materials, assignments, attendanceSessions } = offering._count;
  if (enrollments + materials + assignments + attendanceSessions > 0) {
    throw new ResponseError(
      409,
      "Course offering sudah berisi mahasiswa, materi, tugas, atau absensi, sehingga tidak dapat dihapus",
    );
  }

  await prismaClient.courseOffering.delete({ where: { id } });
};

// ======================================================================
// Schedule
// ======================================================================
export const createSchedule = async (input: CreateScheduleInput) => {
  const offering = await findOfferingOrFail(input.offeringId);
  assertEndAfterStart(input.startTime, input.endTime);

  const slot: ScheduleSlot = {
    dayOfWeek: input.dayOfWeek,
    startTime: toTimeDate(input.startTime),
    endTime: toTimeDate(input.endTime),
    room: input.room,
  };
  await assertNoScheduleConflict(offering, slot);

  const schedule = await prismaClient.schedule.create({
    data: {
      offeringId: input.offeringId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: emptyToNull(input.room) ?? null,
    },
    select: scheduleSelect,
  });
  return presentSchedule(schedule);
};

export const listSchedules = async (actor: Actor, offeringId: string) => {
  await getOfferingAccess(actor, offeringId);

  const schedules = await prismaClient.schedule.findMany({
    where: { offeringId },
    select: scheduleSelect,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return schedules.map(presentSchedule);
};

export const updateSchedule = async (id: string, input: UpdateScheduleInput) => {
  const current = await prismaClient.schedule.findUnique({
    where: { id },
    select: { ...scheduleSelect, offering: { select: { termId: true, teacherId: true, classId: true } } },
  });
  if (!current) {
    throw new ResponseError(404, "Jadwal tidak ditemukan");
  }

  // Jika hanya salah satu jam yang dikirim, bandingkan dengan jam yang tersimpan.
  const startTime = input.startTime ?? toHhmm(current.startTime);
  const endTime = input.endTime ?? toHhmm(current.endTime);
  assertEndAfterStart(startTime, endTime);

  const slot: ScheduleSlot = {
    dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
    startTime: toTimeDate(startTime),
    endTime: toTimeDate(endTime),
    room: input.room !== undefined ? input.room : current.room,
  };
  await assertNoScheduleConflict(current.offering, slot, id);

  const schedule = await prismaClient.schedule.update({
    where: { id },
    data: {
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      ...(input.room !== undefined ? { room: emptyToNull(input.room) ?? null } : {}),
    },
    select: scheduleSelect,
  });
  return presentSchedule(schedule);
};

export const deleteSchedule = async (id: string) => {
  const exists = await prismaClient.schedule.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new ResponseError(404, "Jadwal tidak ditemukan");
  }
  await prismaClient.schedule.delete({ where: { id } });
};

// ======================================================================
// Enrollment
// ======================================================================
// Mendaftarkan satu atau banyak mahasiswa. Yang sudah terdaftar dilewati (bukan error),
// jadi aman dipanggil ulang dengan daftar yang sama.
export const enrollStudents = async (input: EnrollStudentsInput) => {
  const { offeringId, studentIds } = input;
  await findOfferingOrFail(offeringId);

  const students = await prismaClient.studentProfile.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, nim: true, academicStatus: true },
  });

  const foundIds = new Set(students.map((s) => s.id));
  const missing = studentIds.filter((studentId) => !foundIds.has(studentId));
  if (missing.length > 0) {
    throw new ResponseError(404, `${missing.length} mahasiswa tidak ditemukan`);
  }

  const notActive = students.filter((s) => s.academicStatus !== "ACTIVE");
  if (notActive.length > 0) {
    throw new ResponseError(
      400,
      `Mahasiswa dengan status akademik tidak aktif tidak dapat didaftarkan: ${notActive.map((s) => s.nim).join(", ")}`,
    );
  }

  const { count } = await prismaClient.enrollment.createMany({
    data: studentIds.map((studentId) => ({ offeringId, studentId })),
    skipDuplicates: true,
  });

  return { enrolled: count, skipped: studentIds.length - count };
};

export const listEnrollments = async (actor: Actor, offeringId: string) => {
  await assertCanManageOffering(actor, offeringId);

  return prismaClient.enrollment.findMany({
    where: { offeringId },
    select: { id: true, offeringId: true, student: { select: studentBriefSelect } },
    orderBy: [{ student: { fullName: "asc" } }, { id: "asc" }],
  });
};

export const unenrollStudent = async (input: UnenrollStudentInput) => {
  const { offeringId, studentId } = input;

  const enrollment = await prismaClient.enrollment.findUnique({
    where: { offeringId_studentId: { offeringId, studentId } },
    select: { id: true, _count: { select: { grades: true } } },
  });
  if (!enrollment) {
    throw new ResponseError(404, "Mahasiswa tidak terdaftar pada course offering ini");
  }
  // Nilai ikut terhapus oleh cascade, jadi pendaftaran yang sudah punya nilai ditolak.
  if (enrollment._count.grades > 0) {
    throw new ResponseError(409, "Mahasiswa sudah memiliki nilai pada course offering ini, tidak dapat dikeluarkan");
  }

  await prismaClient.enrollment.delete({ where: { id: enrollment.id } });
};

// ======================================================================
// Attendance
// ======================================================================
const findAttendanceSessionOrFail = async (id: string) => {
  const session = await prismaClient.attendanceSession.findUnique({
    where: { id },
    select: attendanceSessionSelect,
  });
  if (!session) {
    throw new ResponseError(404, "Pertemuan tidak ditemukan");
  }
  return session;
};

const assertMeetingNoFree = async (offeringId: string, meetingNo: number, excludeId?: string) => {
  const found = await prismaClient.attendanceSession.findFirst({
    where: { offeringId, meetingNo, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (found) {
    throw new ResponseError(409, `Pertemuan ke-${meetingNo} sudah ada`);
  }
};

export const createAttendanceSession = async (actor: Actor, input: CreateAttendanceSessionInput) => {
  await assertCanManageOffering(actor, input.offeringId);
  await assertMeetingNoFree(input.offeringId, input.meetingNo);

  return prismaClient.attendanceSession.create({ data: input, select: attendanceSessionSelect });
};

// Dosen/admin melihat jumlah catatan absensi per pertemuan; mahasiswa hanya melihat status miliknya.
export const listAttendanceSessions = async (actor: Actor, offeringId: string) => {
  const access = await getOfferingAccess(actor, offeringId);

  if (access === "student") {
    return prismaClient.attendanceSession.findMany({
      where: { offeringId },
      select: {
        ...attendanceSessionSelect,
        records: { where: { student: { accountId: actor.id } }, select: { id: true, status: true } },
      },
      orderBy: { meetingNo: "asc" },
    });
  }

  return prismaClient.attendanceSession.findMany({
    where: { offeringId },
    select: { ...attendanceSessionSelect, _count: { select: { records: true } } },
    orderBy: { meetingNo: "asc" },
  });
};

export const getAttendanceSession = async (actor: Actor, id: string) => {
  const session = await findAttendanceSessionOrFail(id);
  const access = await getOfferingAccess(actor, session.offeringId);

  const records = await prismaClient.attendanceRecord.findMany({
    where: { sessionId: id, ...(access === "student" ? { student: { accountId: actor.id } } : {}) },
    select: { id: true, status: true, student: { select: { id: true, nim: true, fullName: true } } },
    orderBy: [{ student: { fullName: "asc" } }, { id: "asc" }],
  });

  return { ...session, records };
};

export const updateAttendanceSession = async (actor: Actor, id: string, input: UpdateAttendanceSessionInput) => {
  const session = await findAttendanceSessionOrFail(id);
  await assertCanManageOffering(actor, session.offeringId);

  if (input.meetingNo !== undefined && input.meetingNo !== session.meetingNo) {
    await assertMeetingNoFree(session.offeringId, input.meetingNo, id);
  }

  return prismaClient.attendanceSession.update({ where: { id }, data: input, select: attendanceSessionSelect });
};

// Catatan absensi pertemuan ini ikut terhapus oleh cascade.
export const deleteAttendanceSession = async (actor: Actor, id: string) => {
  const session = await findAttendanceSessionOrFail(id);
  await assertCanManageOffering(actor, session.offeringId);

  await prismaClient.attendanceSession.delete({ where: { id } });
};

// Input absensi massal. Aman dipanggil ulang: status mahasiswa yang sudah tercatat diperbarui.
export const recordAttendance = async (actor: Actor, input: RecordAttendanceInput) => {
  const session = await findAttendanceSessionOrFail(input.sessionId);
  await assertCanManageOffering(actor, session.offeringId);

  const studentIds = input.records.map((r) => r.studentId);
  const enrolled = await prismaClient.enrollment.findMany({
    where: { offeringId: session.offeringId, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  const notEnrolled = studentIds.filter((studentId) => !enrolledIds.has(studentId));
  if (notEnrolled.length > 0) {
    throw new ResponseError(400, `${notEnrolled.length} mahasiswa tidak terdaftar pada course offering ini`);
  }

  await prismaClient.$transaction(
    input.records.map(({ studentId, status }) =>
      prismaClient.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId } },
        create: { sessionId: session.id, studentId, status },
        update: { status },
      }),
    ),
  );

  return getAttendanceSession(actor, session.id);
};

export const updateAttendanceRecord = async (actor: Actor, recordId: string, input: UpdateAttendanceRecordInput) => {
  const record = await prismaClient.attendanceRecord.findUnique({
    where: { id: recordId },
    select: { id: true, session: { select: { offeringId: true } } },
  });
  if (!record) {
    throw new ResponseError(404, "Catatan absensi tidak ditemukan");
  }
  await assertCanManageOffering(actor, record.session.offeringId);

  return prismaClient.attendanceRecord.update({
    where: { id: recordId },
    data: { status: input.status },
    select: { id: true, sessionId: true, status: true, student: { select: { id: true, nim: true, fullName: true } } },
  });
};
