import express, { type Response } from 'express';
import cookieParser from "cookie-parser";
import swaggerUi from 'swagger-ui-express';
import SwaggerParser from "@apidevtools/swagger-parser";
import path from 'path';
import { publicRouter } from '@src/route/public-api';
import cors from "cors"

export const web = async () => {
  const app = express();

  app.use(express.json());
  app.use(cookieParser())
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

  app.get('/', (_, res: Response) => {
    res.json({ message: "Welcome to Express AIS API" });
  });

  app.use('/api', [publicRouter])

  try {
    const parser = new SwaggerParser();
    const mainSwaggerPath = path.join(process.cwd(), './docs/swagger.json');
    const bundledSwagger = await parser.validate(mainSwaggerPath);

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(bundledSwagger));
    console.log('Swagger UI documentation successfully loaded at /docs');

    return app;
  } catch (error) {
    console.error('Gagal memuat dokumentasi Swagger:', error);
  }
};
