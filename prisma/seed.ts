/ Jalankan: npx prisma db seed   (idempotent, aman dijalankan berulang)
//
// Akun admin dibuat dari environment (tidak ada password bawaan):
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, dan opsional SEED_ADMIN_USERNAME (default "admin")
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PERMISSIONS as PERMISSION_SLUGS, PERMISSION_DESCRIPTIONS } from "../src/shared/constants/permissions.ts";
import { hashPassword } from "../src/shared/lib/password.ts";
import { email as emailRule, strongPassword, username as usernameRule } from "../src/shared/validation/account-validation.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env["DATABASE_URL"]! }),
});

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

const seedAdminAccount = async (adminRoleId: string) => {
  const rawEmail = process.env["SEED_ADMIN_EMAIL"];
  const rawPassword = process.env["SEED_ADMIN_PASSWORD"];
  if (!rawEmail || !rawPassword) {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD tidak diset, akun admin dilewati");
    return;
  }

  // Pakai aturan validasi yang sama dengan API, supaya admin awal tidak lolos dengan password lemah.
  const email = emailRule.validate(rawEmail);
  const username = usernameRule.validate(process.env["SEED_ADMIN_USERNAME"] ?? "admin");
  const password = strongPassword.validate(rawPassword);
  const error = email.error ?? username.error ?? password.error;
  if (error) {
    throw new Error(`Konfigurasi admin seed tidak valid: ${error.message}`);
  }

  const existing = await prisma.account.findFirst({
    where: { OR: [{ email: email.value }, { username: username.value }] },
    select: { id: true },
  });
  if (existing) {
    console.log("Akun admin sudah ada, dilewati (password tidak diubah)");
    return;
  }

  await prisma.account.create({
    data: {
      email: email.value,
      username: username.value,
      hashPassword: await hashPassword(password.value),
      roleId: adminRoleId,
    },
  });
  console.log(`Akun admin dibuat: ${username.value}`);
};

// Slug versi awal yang sudah digantikan permission granular (role_permissions ikut terhapus via cascade).
const LEGACY_PERMISSION_SLUGS = ["user.manage", "student.manage", "teacher.manage"];

const main = async () => {
  await prisma.permission.deleteMany({ where: { slug: { in: LEGACY_PERMISSION_SLUGS } } });

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { slug: p.slug }, update: { description: p.description }, create: p });
  }

  const roles = new Map<string, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
    roles.set(r.name, role.id);
  }

  await seedAdminAccount(roles.get("admin")!);
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());