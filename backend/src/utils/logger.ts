import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';

const logPath = path.isAbsolute(config.LOG_FILE_PATH)
  ? config.LOG_FILE_PATH
  : path.join(process.cwd(), config.LOG_FILE_PATH);

fs.mkdirSync(path.dirname(logPath), { recursive: true });

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'url-shortener' },
  transports: [
    new winston.transports.File({ filename: logPath }),
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            ),
    }),
  ],
});
