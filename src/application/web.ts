// import express from "express";

// export const web = express()
// web.use(express.json());

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import SwaggerParser from "@apidevtools/swagger-parser";
import path from 'path';

export const web = async () => {
  const app = express();
  const parser = new SwaggerParser();

  app.use(express.json());

  const mainSwaggerPath = path.join(process.cwd(), './docs/swagger.json'); 

  try {
    const bundledSwagger = await parser.validate(mainSwaggerPath);
    
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(bundledSwagger));
    console.log('📝 Swagger UI documentation successfully loaded at /docs');
  } catch (error) {
    console.error('❌ Gagal memuat dokumentasi Swagger:', error);
  }

  // Definisikan route aplikasi Anda di bawah ini
  app.get('/', (req, res) => {
    res.json({ message: "Welcome to Express AIS API" });
  });

  return app;
};
