import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 10;

// Dipakai agar waktu respons login tetap mirip walau user tidak ditemukan
// (mencegah orang menebak identifier mana yang terdaftar lewat selisih waktu).
const DUMMY_HASH = bcrypt.hashSync("dummy-password", BCRYPT_ROUNDS);

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);

// hash boleh undefined (user tidak ditemukan): tetap menjalankan bcrypt.compare agar waktunya konsisten.
export const verifyPassword = (plain: string, hash: string | undefined) =>
  bcrypt.compare(plain, hash ?? DUMMY_HASH);
