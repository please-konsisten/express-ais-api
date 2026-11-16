// Satu-satunya sumber slug permission. Dipakai route (requirePermission) dan prisma/seed.ts,
// jadi slug yang dipakai route pasti ikut ter-seed ke tabel permissions.
export const PERMISSIONS = {
  USER_READ: "user.read",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_RESET_PASSWORD: "user.reset-password",
  STUDENT_READ: "student.read",
  STUDENT_UPDATE: "student.update",
  TEACHER_READ: "teacher.read",
  TEACHER_UPDATE: "teacher.update",
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionSlug, string> = {
  "user.read": "Melihat daftar dan detail akun pengguna",
  "user.create": "Membuat akun pengguna beserta profil mahasiswa/dosen",
  "user.update": "Mengubah email, username, role, dan status aktif akun",
  "user.reset-password": "Mereset password akun pengguna",
  "student.read": "Melihat daftar dan detail mahasiswa",
  "student.update": "Mengubah data resmi mahasiswa (NIM, prodi, semester, status akademik)",
  "teacher.read": "Melihat daftar dan detail dosen",
  "teacher.update": "Mengubah data resmi dosen (NIP, NIDN, gelar, departemen, status)",
};