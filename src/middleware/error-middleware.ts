import {ResponseError} from "../error/response-error.js";

import type { 
  NextFunction,
  Request,
  Response } from "express";

const errorMiddleware = async (
  err: unknown,                 // Objek error bisa berbentuk apa saja (Error bawaan, Joi, atau ResponseError)
  req: Request,             // Tipe data Request dari Express
  res: Response,            // Tipe data Response dari Express
  next: NextFunction        // Tipe data fungsi next dari Express
) => {
    if (!err) {
        next();
        return;
    }

    if (err instanceof ResponseError) {
        res.status(err.status).json({
            errors: err.message
        }).end();
    }  else {
        res.status(500).json({
            errors: err.message
        }).end();
    }
}

export {
    errorMiddleware
}