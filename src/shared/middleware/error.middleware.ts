import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@src/generated/prisma/client";
import { ResponseError } from "@src/shared/errors/response-error";
import { logger } from "@src/shared/lib/logging";

// Error 4xx bawaan library (mis. body-parser saat JSON rusak) membawa status + expose = true.
const isExposableHttpError = (err: unknown): err is Error & { status: number; type?: string } =>
  err instanceof Error &&
  "status" in err &&
  typeof err.status === "number" &&
  err.status >= 400 &&
  err.status < 500 &&
  "expose" in err &&
  err.expose === true;

// Semua error API dikembalikan dengan bentuk { message }, sama seperti respons controller
// dan middleware validate. Pesan error tak terduga (500) tidak pernah dibocorkan ke klien.
const errorMiddleware = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ResponseError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Pengaman terakhir untuk race condition: dua request membuat data unik yang sama bersamaan,
    // lolos pengecekan di service, lalu salah satunya ditolak oleh constraint database.
    if (err.code === "P2002") {
      res.status(409).json({ message: "Data sudah terdaftar" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Data tidak ditemukan" });
      return;
    }
  }

  if (isExposableHttpError(err)) {
    const message = err.type === "entity.parse.failed" ? "Body request bukan JSON yang valid" : err.message;
    res.status(err.status).json({ message });
    return;
  }

  logger.error("Unhandled error", { error: err instanceof Error ? { message: err.message, stack: err.stack } : err });
  res.status(500).json({ message: "Terjadi kesalahan pada server" });
};

export { errorMiddleware };