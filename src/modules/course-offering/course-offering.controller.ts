import type { Request, Response } from "express";
import { getAuthUser } from "@src/shared/middleware/auth.middleware";
import type { IdParam } from "@src/shared/schemas/common.schema";
import * as courseOfferingService from "./course-offering.service";
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

// Express 5 meneruskan error dari handler async ke error handler secara otomatis.
// Body/params/query sudah divalidasi oleh middleware validate di route (hasil validasi query
// ada di req.validatedQuery karena req.query read-only).
//
// Untuk handler "list ... per offering" (listSchedules, listEnrollments, listAttendanceSessions),
// req.params.id adalah id course offering, mis. GET /course-offerings/:id/schedules.

// ---------- course offering ----------
export const createCourseOffering = async (req: Request, res: Response) => {
  const data = await courseOfferingService.createCourseOffering(req.body as CreateCourseOfferingInput);
  res.status(201).json({ data });
};

export const listCourseOfferings = async (req: Request, res: Response) => {
  const { items, meta } = await courseOfferingService.listCourseOfferings(
    getAuthUser(req),
    req.validatedQuery as ListCourseOfferingQuery,
  );
  res.status(200).json({ data: items, meta });
};

export const getCourseOffering = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.getCourseOffering(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateCourseOffering = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.updateCourseOffering(req.params.id, req.body as UpdateCourseOfferingInput);
  res.status(200).json({ data });
};

export const deleteCourseOffering = async (req: Request<IdParam>, res: Response) => {
  await courseOfferingService.deleteCourseOffering(req.params.id);
  res.status(200).json({ message: "Course offering berhasil dihapus" });
};

// ---------- schedule ----------
export const createSchedule = async (req: Request, res: Response) => {
  const data = await courseOfferingService.createSchedule(req.body as CreateScheduleInput);
  res.status(201).json({ data });
};

export const listSchedules = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.listSchedules(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateSchedule = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.updateSchedule(req.params.id, req.body as UpdateScheduleInput);
  res.status(200).json({ data });
};

export const deleteSchedule = async (req: Request<IdParam>, res: Response) => {
  await courseOfferingService.deleteSchedule(req.params.id);
  res.status(200).json({ message: "Jadwal berhasil dihapus" });
};

// ---------- enrollment ----------
export const enrollStudents = async (req: Request, res: Response) => {
  const data = await courseOfferingService.enrollStudents(req.body as EnrollStudentsInput);
  res.status(201).json({ data });
};

export const listEnrollments = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.listEnrollments(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const unenrollStudent = async (req: Request, res: Response) => {
  await courseOfferingService.unenrollStudent(req.body as UnenrollStudentInput);
  res.status(200).json({ message: "Mahasiswa berhasil dikeluarkan dari course offering" });
};

// ---------- attendance ----------
export const createAttendanceSession = async (req: Request, res: Response) => {
  const data = await courseOfferingService.createAttendanceSession(
    getAuthUser(req),
    req.body as CreateAttendanceSessionInput,
  );
  res.status(201).json({ data });
};

export const listAttendanceSessions = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.listAttendanceSessions(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const getAttendanceSession = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.getAttendanceSession(getAuthUser(req), req.params.id);
  res.status(200).json({ data });
};

export const updateAttendanceSession = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.updateAttendanceSession(
    getAuthUser(req),
    req.params.id,
    req.body as UpdateAttendanceSessionInput,
  );
  res.status(200).json({ data });
};

export const deleteAttendanceSession = async (req: Request<IdParam>, res: Response) => {
  await courseOfferingService.deleteAttendanceSession(getAuthUser(req), req.params.id);
  res.status(200).json({ message: "Pertemuan berhasil dihapus" });
};

export const recordAttendance = async (req: Request, res: Response) => {
  const data = await courseOfferingService.recordAttendance(getAuthUser(req), req.body as RecordAttendanceInput);
  res.status(200).json({ data });
};

export const updateAttendanceRecord = async (req: Request<IdParam>, res: Response) => {
  const data = await courseOfferingService.updateAttendanceRecord(
    getAuthUser(req),
    req.params.id,
    req.body as UpdateAttendanceRecordInput,
  );
  res.status(200).json({ data });
};
