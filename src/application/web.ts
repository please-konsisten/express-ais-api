import express from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';

export const web = express();

// 1. Konfigurasi opsi untuk swagger-jsdoc
const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Dokumentasi Aplikasi',
      version: '1.0.0',
      description: 'Dokumentasi API menggunakan swagger-jsdoc dan swagger-ui-express',
    },
    servers: [
      {
        url: 'http://localhost:3000', // Sesuaikan dengan port di main.ts Anda
        description: 'Development Server',
      },
    ],
  },
  // 2. Tentukan path file yang akan dipindai oleh swagger-jsdoc
  // Ini akan membaca seluruh file .yaml di folder docs dan file .ts di folder route/controller
  apis: [
    path.join(process.cwd(), './docs/*.yaml'),
    // path.join(__dirname, '../route/*.ts'),      // Opsional jika Anda menulis jsdoc di file route
    // path.join(__dirname, '../controller/*.ts'), // Opsional jika Anda menulis jsdoc di file controller
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

web.use(express.json());

// 4. Pasang route UI Swagger menggunakan spesifikasi yang dihasilkan
web.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
