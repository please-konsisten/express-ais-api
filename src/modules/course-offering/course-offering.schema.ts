// Course offering beserta semua yang menempel padanya: jadwal, enrollment, dan absensi.
// Semuanya selalu diakses lewat offeringId, jadi dikelompokkan dalam satu file.
import Joi from "joi";
import { paginationKeys, requiredUuid, timeString, uuid } from "@src/shared/schemas/common.schema";
import type { PaginationQuery } from "@src/shared/schemas/common.schema";

// ---------- tipe ----------
export type CreateCourseOfferingInput = {
  termId: string;
  subjectId: string;
  classId: string;
  teacherId: string;
};
export type UpdateCourseOfferingInput = { teacherId?: string };
export type ListCourseOfferingQuery = PaginationQuery & {
  termId?: string;
  subjectId?: string;
  classId?: string;
  teacherId?: string;
};

export type CreateScheduleInput = {
  offeringId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
};
export type UpdateScheduleInput = {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  room?: string | null;
};

export type EnrollStudentsInput = { offeringId: string; studentIds: string[] };
export type UnenrollStudentInput = { offeringId: string; studentId: string };

export type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPA";
export type CreateAttendanceSessionInput = {
  offeringId: string;
  meetingNo: number;
  meetingDate: Date;
};
export type UpdateAttendanceSessionInput = { meetingNo?: number; meetingDate?: Date };
export type RecordAttendanceInput = {
  sessionId: string;
  records: { studentId: string; status: AttendanceStatus }[];
};
export type UpdateAttendanceRecordInput = { status: AttendanceStatus };

// ---------- course offering ----------
// Kombinasi term/subject/class sudah ada? Dosen valid? Dicek di service.
export const createCourseOfferingSchema = Joi.object<CreateCourseOfferingInput>({
  termId: requiredUuid,
  subjectId: requiredUuid,
  classId: requiredUuid,
  teacherId: requiredUuid,
});

export const updateCourseOfferingSchema = Joi.object<UpdateCourseOfferingInput>({
  teacherId: uuid,
}).min(1);

export const listCourseOfferingQuerySchema = Joi.object<ListCourseOfferingQuery>({
  ...paginationKeys,
  termId: uuid.optional(),
  subjectId: uuid.optional(),
  classId: uuid.optional(),
  teacherId: uuid.optional(),
});

// ---------- schedule ----------
// dayOfWeek: 1 = Senin ... 7 = Minggu
const dayOfWeek = Joi.number().integer().min(1).max(7);

// Hanya membandingkan dua field dalam payload yang sama.
// Bentrok dengan jadwal dosen/ruangan lain dicek di service.
// Pada update, jika hanya salah satu jam yang dikirim, bandingkan dengan data di database (service).
const endAfterStart = (value: { startTime?: string; endTime?: string }, helpers: Joi.CustomHelpers) => {
  if (value.startTime && value.endTime && value.endTime <= value.startTime) {
    return helpers.error("any.invalid", { message: "endTime harus setelah startTime" });
  }
  return value;
};

export const createScheduleSchema = Joi.object<CreateScheduleInput>({
  offeringId: requiredUuid,
  dayOfWeek: dayOfWeek.required(),
  startTime: timeString.required(),
  endTime: timeString.required(),
  room: Joi.string().trim().max(50).allow(null, "").optional(),
})
  .custom(endAfterStart)
  .messages({ "any.invalid": "endTime harus setelah startTime" });

export const updateScheduleSchema = Joi.object<UpdateScheduleInput>({
  dayOfWeek: dayOfWeek,
  startTime: timeString,
  endTime: timeString,
  room: Joi.string().trim().max(50).allow(null, ""),
})
  .min(1)
  .custom(endAfterStart)
  .messages({ "any.invalid": "endTime harus setelah startTime" });

// ---------- enrollment ----------
// Mahasiswa sudah terdaftar / kelas penuh? Dicek di service.
// Daftarkan satu atau banyak mahasiswa ke course offering
export const enrollStudentsSchema = Joi.object<EnrollStudentsInput>({
  offeringId: requiredUuid,
  studentIds: Joi.array().items(requiredUuid).unique().min(1).max(500).required(),
});

export const unenrollStudentSchema = Joi.object<UnenrollStudentInput>({
  offeringId: requiredUuid,
  studentId: requiredUuid,
});

// ---------- attendance ----------
const attendanceStatus = Joi.string().valid("HADIR", "IZIN", "SAKIT", "ALPA");

// Nomor pertemuan sudah dipakai / mahasiswa terdaftar di offering? Dicek di service.
export const createAttendanceSessionSchema = Joi.object<CreateAttendanceSessionInput>({
  offeringId: requiredUuid,
  meetingNo: Joi.number().integer().min(1).max(32767).required(),
  meetingDate: Joi.date().iso().required(),
});

export const updateAttendanceSessionSchema = Joi.object<UpdateAttendanceSessionInput>({
  meetingNo: Joi.number().integer().min(1).max(32767),
  meetingDate: Joi.date().iso(),
}).min(1);

// Input absensi massal untuk satu pertemuan
export const recordAttendanceSchema = Joi.object<RecordAttendanceInput>({
  sessionId: requiredUuid,
  records: Joi.array()
    .items(
      Joi.object({
        studentId: requiredUuid,
        status: attendanceStatus.required(),
      })
    )
    .min(1)
    .unique("studentId")
    .required(),
});

export const updateAttendanceRecordSchema = Joi.object<UpdateAttendanceRecordInput>({
  status: attendanceStatus.required(),
});
