// Jalankan: npx prisma db seed   (idempotent, aman dijalankan berulang)
//
// Seed ini mengisi:
//   1. Data master  : permission, role, dan hak akses per role
//   2. Data demo    : akun admin/dosen/mahasiswa, semester, mata kuliah, kelas, penawaran mata kuliah,
//                     jadwal, KRS (enrollment), materi, tugas, pengumpulan, presensi, dan nilai
//
// SEMUA akun demo memakai password yang sama: Test.12345
// (bisa diganti lewat env SEED_PASSWORD; email/username admin lewat SEED_ADMIN_EMAIL / SEED_ADMIN_USERNAME)
//
// Data demo memakai UUID tetap, jadi menjalankan seed berulang kali tidak membuat data ganda.
// Password akun demo selalu di-reset ke nilai di atas setiap seed dijalankan.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import type { AttendanceStatus } from "../src/generated/prisma/client.ts";
import { PERMISSIONS as PERMISSION_SLUGS, PERMISSION_DESCRIPTIONS } from "../src/shared/constants/permissions.ts";
import { hashPassword } from "../src/shared/lib/password.ts";
import { email as emailRule, strongPassword, username as usernameRule } from "../src/shared/schemas/account.schema.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
});

const DEMO_PASSWORD = process.env["SEED_PASSWORD"] ?? "Test.12345";

// ---------- helper ----------
// UUID deterministik: prefix menentukan jenis data, n nomor urutnya.
const uid = (prefix: number, n: number) =>
  `${prefix.toString(16).padStart(8, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const time = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`); // kolom @db.Time(0)
const date = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`); // kolom @db.Date

// ---------- 1. data master ----------
const PERMISSIONS = Object.values(PERMISSION_SLUGS).map((slug) => ({
  slug,
  description: PERMISSION_DESCRIPTIONS[slug],
}));

// Nama "student" dan "teacher" dipakai user.service untuk mewajibkan profil yang sesuai.
const ROLES = [
  { name: "admin", isSuperAdmin: true },
  { name: "teacher", isSuperAdmin: false },
  { name: "student", isSuperAdmin: false },
];

// Admin = super admin (lolos semua permission), jadi tidak perlu daftar di sini.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  teacher: [PERMISSION_SLUGS.STUDENT_READ, PERMISSION_SLUGS.TEACHER_READ],
  student: [],
};

// Slug versi awal yang sudah digantikan permission granular (role_permissions ikut terhapus via cascade).
const LEGACY_PERMISSION_SLUGS = ["user.manage", "student.manage", "teacher.manage"];

const seedMaster = async () => {
  await prisma.permission.deleteMany({ where: { slug: { in: LEGACY_PERMISSION_SLUGS } } });

  const permissionIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { description: p.description },
      create: p,
    });
    permissionIds.set(p.slug, permission.id);
  }

  const roleIds = new Map<string, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
    roleIds.set(r.name, role.id);
  }

  for (const [roleName, slugs] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds.get(roleName)!;
    for (const slug of slugs) {
      const permissionId = permissionIds.get(slug)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  return roleIds;
};

// ---------- 2. akun ----------
// Pakai aturan validasi yang sama dengan API, supaya data seed selalu valid di mata aplikasi.
const validated = (rawEmail: string, rawUsername: string, rawPassword: string) => {
  const email = emailRule.validate(rawEmail);
  const username = usernameRule.validate(rawUsername);
  const password = strongPassword.validate(rawPassword);
  const error = email.error ?? username.error ?? password.error;
  if (error) {
    throw new Error(`Data akun seed tidak valid (${rawEmail}): ${error.message}`);
  }
  return { email: email.value as string, username: username.value as string, password: password.value as string };
};

type AccountSeed = { id: string; email: string; username: string; roleId: string };

const upsertAccount = async (a: AccountSeed, passwordHash: string) =>
  prisma.account.upsert({
    where: { id: a.id },
    update: { email: a.email, username: a.username, hashPassword: passwordHash, roleId: a.roleId, isActive: true },
    create: { id: a.id, email: a.email, username: a.username, hashPassword: passwordHash, roleId: a.roleId },
  });

const TEACHERS = [
  {
    n: 1,
    nip: "198503122010121001",
    nidn: "0012038501",
    titlePrefix: "Dr.",
    fullName: "Budi Santoso",
    titleSuffix: "M.Kom.",
    phoneNumber: "081234560001",
    department: "Teknik Informatika",
    officeLocation: "Gedung D2 Lantai 2",
    expertise: "Basis Data, Data Mining",
  },
  {
    n: 2,
    nip: "198709152012122002",
    nidn: "0015098701",
    titlePrefix: "Dra.",
    fullName: "Siti Rahmawati",
    titleSuffix: "M.T.",
    phoneNumber: "081234560002",
    department: "Teknik Informatika",
    officeLocation: "Gedung D2 Lantai 3",
    expertise: "Pemrograman Web, Rekayasa Perangkat Lunak",
  },
  {
    n: 3,
    nip: "199011202015031003",
    nidn: "0020119001",
    titlePrefix: null,
    fullName: "Agus Prasetyo",
    titleSuffix: "S.Kom., M.Cs.",
    phoneNumber: "081234560003",
    department: "Teknik Informatika",
    officeLocation: "Gedung D2 Lantai 1",
    expertise: "Jaringan Komputer, Keamanan Siber",
  },
];

const STUDENT_NAMES = [
  "Ahmad Fauzi",
  "Dewi Lestari",
  "Rizky Ramadhan",
  "Putri Anggraini",
  "Muhammad Iqbal",
  "Nabila Safitri",
  "Fajar Nugroho",
  "Aulia Rahma",
  "Dimas Pratama",
  "Salsabila Putri",
];
const STUDENT_USERNAMES = [
  "ahmad.fauzi",
  "dewi.lestari",
  "rizky.ramadhan",
  "putri.anggraini",
  "muhammad.iqbal",
  "nabila.safitri",
  "fajar.nugroho",
  "aulia.rahma",
  "dimas.pratama",
  "salsabila.putri",
];

const seedAccounts = async (roleIds: Map<string, string>) => {
  const passwordHash = await hashPassword(validated("x@example.com", "xxx", DEMO_PASSWORD).password);

  // Admin
  const admin = validated(
    process.env["SEED_ADMIN_EMAIL"] ?? "admin@ais.example.com",
    process.env["SEED_ADMIN_USERNAME"] ?? "admin",
    DEMO_PASSWORD,
  );
  await upsertAccount(
    { id: uid(1, 1), email: admin.email, username: admin.username, roleId: roleIds.get("admin")! },
    passwordHash,
  );

  // Dosen
  const teacherIds: string[] = [];
  for (const t of TEACHERS) {
    const v = validated(`dosen${t.n}@ais.example.com`, `dosen${t.n}`, DEMO_PASSWORD);
    const account = await upsertAccount(
      { id: uid(2, t.n), email: v.email, username: v.username, roleId: roleIds.get("teacher")! },
      passwordHash,
    );
    const { n, ...profile } = t;
    const teacher = await prisma.teacherProfile.upsert({
      where: { id: uid(3, n) },
      update: { ...profile, isActive: true },
      create: { id: uid(3, n), ...profile, accountId: account.id },
    });
    teacherIds.push(teacher.id);
  }

  // Mahasiswa: 6 di kelas A, 4 di kelas B
  const studentIds: string[] = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const n = i + 1;
    const nim = `2024${String(n).padStart(4, "0")}`;
    const v = validated(`${STUDENT_USERNAMES[i]}@student.ais.example.com`, STUDENT_USERNAMES[i]!, DEMO_PASSWORD);
    const account = await upsertAccount(
      { id: uid(4, n), email: v.email, username: v.username, roleId: roleIds.get("student")! },
      passwordHash,
    );
    const profile = {
      nim,
      fullName: STUDENT_NAMES[i]!,
      phoneNumber: `0812345${String(n).padStart(5, "0")}`,
      address: "Semarang, Jawa Tengah",
      studyProgram: "Teknik Informatika",
      batchYear: 2024,
      semester: 3,
      academicStatus: "ACTIVE" as const,
    };
    const student = await prisma.studentProfile.upsert({
      where: { id: uid(5, n) },
      update: profile,
      create: { id: uid(5, n), ...profile, accountId: account.id },
    });
    studentIds.push(student.id);
  }

  return { teacherIds, studentIds };
};

// ---------- 3. data akademik ----------
const SUBJECTS = [
  { n: 1, code: "IF201", name: "Basis Data", credits: 3 },
  { n: 2, code: "IF202", name: "Pemrograman Web", credits: 3 },
  { n: 3, code: "IF203", name: "Struktur Data", credits: 3 },
  { n: 4, code: "IF204", name: "Jaringan Komputer", credits: 2 },
];

const CLASSES = [
  { n: 1, name: "Teknik Informatika 2024 - A" },
  { n: 2, name: "Teknik Informatika 2024 - B" },
];

// subject / class / teacher memakai nomor urut di atas. Jadwal: dayOfWeek 1 = Senin ... 7 = Minggu.
const OFFERINGS = [
  { n: 1, subject: 1, cls: 1, teacher: 1, schedules: [{ day: 1, start: "08:00", end: "10:30", room: "D2-101" }] },
  { n: 2, subject: 2, cls: 1, teacher: 2, schedules: [{ day: 2, start: "10:00", end: "12:30", room: "Lab-1" }] },
  { n: 3, subject: 3, cls: 1, teacher: 3, schedules: [{ day: 3, start: "08:00", end: "10:30", room: "D2-102" }] },
  { n: 4, subject: 4, cls: 1, teacher: 3, schedules: [{ day: 4, start: "13:00", end: "14:40", room: "Lab-2" }] },
  { n: 5, subject: 2, cls: 2, teacher: 2, schedules: [{ day: 5, start: "08:00", end: "10:30", room: "Lab-1" }] },
];

const MEETING_DATES = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
const ATTENDANCE_PATTERN: AttendanceStatus[] = ["HADIR", "HADIR", "HADIR", "IZIN", "HADIR", "SAKIT", "HADIR", "ALPA"];

const seedAcademic = async (teacherIds: string[], studentIds: string[]) => {
  const term = await prisma.academicTerm.upsert({
    where: { id: uid(6, 1) },
    update: { name: "Ganjil 2026/2027", startDate: date("2026-09-01"), endDate: date("2027-01-31"), isActive: true },
    create: {
      id: uid(6, 1),
      name: "Ganjil 2026/2027",
      startDate: date("2026-09-01"),
      endDate: date("2027-01-31"),
      isActive: true,
    },
  });

  for (const s of SUBJECTS) {
    const { n, ...data } = s;
    await prisma.subject.upsert({ where: { code: s.code }, update: data, create: { id: uid(7, n), ...data } });
  }
  for (const c of CLASSES) {
    await prisma.classGroup.upsert({
      where: { id: uid(8, c.n) },
      update: { name: c.name },
      create: { id: uid(8, c.n), name: c.name },
    });
  }

  for (const o of OFFERINGS) {
    const offeringId = uid(9, o.n);
    const keys = {
      termId: term.id,
      subjectId: uid(7, o.subject),
      classId: uid(8, o.cls),
      teacherId: teacherIds[o.teacher - 1]!,
    };
    await prisma.courseOffering.upsert({
      where: { id: offeringId },
      update: keys,
      create: { id: offeringId, ...keys },
    });

    for (const [i, s] of o.schedules.entries()) {
      const data = { dayOfWeek: s.day, startTime: time(s.start), endTime: time(s.end), room: s.room, offeringId };
      await prisma.schedule.upsert({
        where: { id: uid(10, o.n * 10 + i) },
        update: data,
        create: { id: uid(10, o.n * 10 + i), ...data },
      });
    }

    // KRS: kelas A = mahasiswa 1-6, kelas B = mahasiswa 7-10
    const classStudents = o.cls === 1 ? studentIds.slice(0, 6) : studentIds.slice(6);
    const enrollmentIds: string[] = [];
    for (const studentId of classStudents) {
      const enrollment = await prisma.enrollment.upsert({
        where: { offeringId_studentId: { offeringId, studentId } },
        update: {},
        create: { id: uid(11, o.n * 100 + studentIds.indexOf(studentId) + 1), offeringId, studentId },
      });
      enrollmentIds.push(enrollment.id);
    }

    // Nilai per komponen (angka deterministik, bervariasi antar mahasiswa)
    for (const [i, enrollmentId] of enrollmentIds.entries()) {
      const base = 70 + ((i * 7 + o.n * 3) % 25);
      const components = { TUGAS: base + 3, UTS: base - 2, UAS: base + 1 };
      for (const [component, score] of Object.entries(components)) {
        await prisma.grade.upsert({
          where: { enrollmentId_component: { enrollmentId, component } },
          update: { score: Math.min(score, 100) },
          create: { enrollmentId, component, score: Math.min(score, 100) },
        });
      }
    }

    // Materi
    for (const m of [1, 2]) {
      const data = {
        title: `Pertemuan ${m}: Pengantar ${SUBJECTS[o.subject - 1]!.name}`,
        description: `Materi pertemuan ${m} untuk mata kuliah ${SUBJECTS[o.subject - 1]!.name}.`,
        fileUrl: `https://example.com/materi/${SUBJECTS[o.subject - 1]!.code.toLowerCase()}-pertemuan-${m}.pdf`,
        offeringId,
      };
      await prisma.material.upsert({
        where: { id: uid(12, o.n * 10 + m) },
        update: data,
        create: { id: uid(12, o.n * 10 + m), ...data },
      });
    }

    // Tugas + pengumpulan (mahasiswa urutan genap belum mengumpulkan / belum dinilai)
    const assignmentId = uid(13, o.n);
    const assignmentData = {
      title: `Tugas 1 - ${SUBJECTS[o.subject - 1]!.name}`,
      description: "Kerjakan soal pada modul dan kumpulkan dalam format PDF.",
      dueAt: new Date("2026-10-05T16:59:00.000Z"),
      maxScore: 100,
      offeringId,
    };
    await prisma.assignment.upsert({
      where: { id: assignmentId },
      update: assignmentData,
      create: { id: assignmentId, ...assignmentData },
    });
    for (const [i, studentId] of classStudents.entries()) {
      if (i % 4 === 3) continue; // belum mengumpulkan
      const graded = i % 2 === 0;
      const data = {
        fileUrl: `https://example.com/submission/${o.n}-${i + 1}.pdf`,
        submittedAt: new Date("2026-10-04T10:00:00.000Z"),
        score: graded ? 75 + ((i * 5) % 20) : null,
        feedback: graded ? "Sudah baik, pertahankan." : null,
        assignmentId,
        studentId,
      };
      await prisma.submission.upsert({
        where: { assignmentId_studentId: { assignmentId, studentId } },
        update: data,
        create: { id: uid(14, o.n * 100 + i + 1), ...data },
      });
    }

    // Presensi: 4 pertemuan
    for (const [m, meetingDate] of MEETING_DATES.entries()) {
      const meetingNo = m + 1;
      const session = await prisma.attendanceSession.upsert({
        where: { offeringId_meetingNo: { offeringId, meetingNo } },
        update: { meetingDate: date(meetingDate) },
        create: { id: uid(15, o.n * 10 + meetingNo), offeringId, meetingNo, meetingDate: date(meetingDate) },
      });
      for (const [i, studentId] of classStudents.entries()) {
        const status = ATTENDANCE_PATTERN[(i + m) % ATTENDANCE_PATTERN.length]!;
        await prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId } },
          update: { status },
          create: { sessionId: session.id, studentId, status },
        });
      }
    }
  }
};

const main = async () => {
  const roleIds = await seedMaster();
  console.log("Master data (permission, role) selesai");

  const { teacherIds, studentIds } = await seedAccounts(roleIds);
  console.log(`Akun demo selesai: 1 admin, ${teacherIds.length} dosen, ${studentIds.length} mahasiswa`);

  await seedAcademic(teacherIds, studentIds);
  console.log("Data akademik selesai");
  console.log(`Semua akun demo memakai password: ${DEMO_PASSWORD}`);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());