import type { NextFunction, Request, Response } from "express";
import type { ObjectSchema } from "joi";

type Target = "body" | "query" | "params";

// Middleware generik. Contoh: router.post("/", validate(createUserSchema), handler)
export const validate =
  (schema: ObjectSchema, target: Target = "body") =>
    (req: Request, res: Response, next: NextFunction) => {
      const { error, value } = schema.validate(req[target], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        return res.status(400).json({
          message: "Validasi gagal",
          errors: error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message.replace(/"/g, ""),
          })),
        });
      }

      // req.query bersifat read-only di Express 5, jadi simpan hasilnya di properti lain
      if (target === "query") {
        (req as Request & { validatedQuery?: unknown }).validatedQuery = value;
      } else {
        req[target] = value;
      }

      next();
    };