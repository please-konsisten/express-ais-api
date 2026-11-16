//logging.ts
import winston from "winston";

export const logger = winston.createLogger({
    // LOG_LEVEL=debug untuk melihat query database (tanpa parameter, lihat database.ts)
    level: process.env.LOG_LEVEL ?? "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({})
    ]
});