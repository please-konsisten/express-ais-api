// Aturan field akun yang dipakai bersama oleh modul auth dan user,
// supaya format email/username/password tidak berbeda antara register, login, dan ganti password.
import Joi from "joi";

// bcrypt hanya memakai 72 byte pertama. Joi.max() menghitung karakter, sedangkan karakter
// non-ASCII bisa lebih dari 1 byte, jadi byte-nya dicek terpisah.
const MAX_PASSWORD_BYTES = 72;

export const email = Joi.string().trim().lowercase().email().max(255);

export const username = Joi.string()
  .trim()
  .lowercase()
  .min(3)
  .max(255)
  .pattern(/^[a-z0-9._-]+$/)
  .messages({
    "string.pattern.base": "Username hanya boleh huruf kecil, angka, titik, underscore, dan strip",
  });

// Password baru (register, reset, ganti password). Untuk login dan password lama
// jangan pakai ini: aturan komposisi tidak boleh membuat akun lama gagal login.
export const strongPassword = Joi.string()
  .min(8)
  .max(MAX_PASSWORD_BYTES)
  .pattern(/[a-z]/, "huruf kecil")
  .pattern(/[A-Z]/, "huruf besar")
  .pattern(/\d/, "angka")
  .custom((value: string, helpers) =>
    Buffer.byteLength(value, "utf8") > MAX_PASSWORD_BYTES ? helpers.error("string.maxBytes") : value,
  )
  .messages({
    "string.pattern.name": "Password harus mengandung {#name}",
    "string.maxBytes": `Password maksimal ${MAX_PASSWORD_BYTES} byte`,
  });

// Password yang sudah ada (login, konfirmasi password lama): hanya dibatasi panjangnya.
export const existingPassword = Joi.string().max(MAX_PASSWORD_BYTES);
