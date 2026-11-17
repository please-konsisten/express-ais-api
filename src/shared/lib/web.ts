//web.ts

import express, { type Express, type Response } from 'express';
import cookieParser from "cookie-parser";
import swaggerUi from 'swagger-ui-express';
import SwaggerParser from "@apidevtools/swagger-parser";
import path from 'path';
import { routes } from '@src/routes';
import { errorMiddleware } from '@src/shared/middleware/error.middleware';
import cors from "cors"
import { cleanupExpiredTokens, task } from "@src/crons/tokenDelete";
import { logger } from "@src/shared/lib/logging";

// Kegagalan memuat dokumentasi tidak boleh mematikan API.
const mountDocs = async (app: Express) => {
  try {
    const parser = new SwaggerParser();
    const mainSwaggerPath = path.join(process.cwd(), './docs/swagger.json');
    const bundledSwagger = await parser.validate(mainSwaggerPath);

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(bundledSwagger));
    console.log('Swagger UI documentation successfully loaded at /api/docs');
  } catch (error) {
    logger.error('Gagal memuat dokumentasi Swagger', { error });
  }
};

export const web = async () => {
  const app = express();

  app.use(express.json());
  app.use(cookieParser())
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
  await cleanupExpiredTokens()
  task.start()

  app.get('/', (_, res: Response) => {
    res.json({ message: "Welcome to Express AIS API" });
  });

  await mountDocs(app);
  app.use('/api', routes)

  app.use(errorMiddleware);

  return app;
};