import cron from "node-cron";

import { prismaClient } from "@src/shared/lib/database";
import { logger } from "@src/shared/lib/logging";

// Fungsi utama pembersihan token yang bisa dipanggil kapan saja
export const cleanupExpiredTokens = async () => {
  try {
    const deleted = await prismaClient.refreshToken.deleteMany({
      where: {
        OR: [
          { expiredAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });

    logger.info(
      `Pembersihan refresh token selesai: ${deleted.count} token dihapus`
    );
  } catch (error) {
    logger.error("Gagal membersihkan refresh token", { error });
  }
};

export const task = cron.schedule("*/10 * * * *", cleanupExpiredTokens, {
  timezone: "Asia/Jakarta",
});

