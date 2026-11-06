
import cron from "node-cron"

import {prisma} from "@src/lib/prisma-client"

// Jalankan SETIAP 1 MENIT (* * * * *)
export const task = cron.schedule('* * * * *', async () => {
  console.log('Menjalankan pembersihan token usang...');
  
  try {
    const now = new Date();
    
    // Tentukan batas waktu: 1 menit (60.000 milidetik) yang lalu
    const batasWaktuHapus = new Date(now.getTime() - 1 * 1000); 

    const deleted = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          // 1. Hapus token yang sudah di-revoke LEBIH DARI 1 menit lalu
          // (Melewati grace period 1 menit yang kita buat sebelumnya)
          { revokedAt: { lt: batasWaktuHapus } }, 
          
          // 2. Hapus token yang memang sudah kedaluwarsa secara alami
          { expiredAt: { lt: now } }       
        ]
      }
    });

    if (deleted.count > 0) {
      console.log(`Pembersihan berhasil. ${deleted.count} token sampah dihapus.`);
    }
  } catch (error) {
    console.error('Gagal membersihkan token:', error);
  }
});
     // resume