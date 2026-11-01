import { web } from './application/web.js';
import { logger } from './application/logging.js';

const PORT = process.env.PORT || 3000;

function startServer() {
  try {
    web.listen(PORT, () => {
      console.log(`🚀 Aplikasi berhasil berjalan di http://localhost:${PORT}`);
      console.log(`📝 Dokumentasi Swagger UI: http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error("Gagal menjalankan aplikasi:", error);
    process.exit(1);
  }
}

startServer();