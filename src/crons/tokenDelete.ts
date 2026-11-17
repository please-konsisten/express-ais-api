import cron from "node-cron"

import { prismaClient } from "@src/shared/lib/database"
import { logger } from "@src/shared/lib/logging"

// Refresh token yang sudah kedaluwarsa atau dicabut tidak bisa dipakai lagi (dicek di auth.service),
// jadi pembersihan cukup sesekali: setiap jam pada menit ke-0.
export const task = cron.schedule('0 * * * *', async () => {
  try {
    const deleted = await prismaClient.refreshToken.deleteMany({
      where: {
        OR: [
          { expiredAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });

    if (deleted.count > 0) {
      logger.info(`Pembersihan refresh token: ${deleted.count} token dihapus`);
    }
  } catch (error) {
    logger.error('Gagal membersihkan refresh token', { error });
  }
});