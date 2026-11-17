import Joi from "joi";

// Catatan: file di folder ini hanya memvalidasi BENTUK data (format, panjang, rentang,
// relasi antar-field dalam satu payload). Aturan yang butuh database
// (NIM sudah terdaftar? jadwal dosen bentrok? dst.) ada di service.
//
// Tipe DTO ditulis manual di samping schema dan dipasang lewat Joi.object<Tipe>().
// Tipe menggambarkan nilai SETELAH validasi (default sudah terisi, tanggal sudah jadi Date).

export const uuid = Joi.string().uuid({ version: "uuidv4" });

export const requiredUuid = uuid.required();

export type IdParam = { id: string };

export const idParamSchema = Joi.object<IdParam>({
  id: requiredUuid,
});

export type PaginationQuery = {
  page: number;
  limit: number;
  search?: string;
  sortOrder: "asc" | "desc";
};

// Dipisah supaya bisa di-spread ke schema list lain dengan filter tambahan
// tanpa kehilangan tipe (.keys() tidak mengubah tipe generiknya).
export const paginationKeys = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).allow("").optional(),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
};

export const paginationQuerySchema = Joi.object<PaginationQuery>(paginationKeys);

// Format jam "HH:mm" (24 jam)
export const timeString = Joi.string()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
  .messages({
    "string.pattern.base": "{#label} harus berformat HH:mm (contoh: 08:30)",
  });
