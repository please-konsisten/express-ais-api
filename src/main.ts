import { web } from './application/web.js';
import { logger } from './application/logging.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    const app = await web();

    app.listen(PORT, () => {
      console.log(`🚀 Server running dynamically on http://localhost:${PORT}`);
      console.log(`📖 View Swagger Docs at http://localhost:${PORT}/docs`);
    });
  } catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
  }
};


startServer();