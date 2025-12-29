/**
 * Logger utility using Winston
 */

import winston from 'winston';
import config from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let msg = `${timestamp} [${service || 'NexusDoc'}] ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

export function createLogger(service: string = 'NexusDoc'): winston.Logger {
  return winston.createLogger({
    level: config.logLevel,
    format: logFormat,
    defaultMeta: { service },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // File transports for production
      ...(config.nodeEnv === 'production' ? [
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ] : []),
    ],
  });
}

export default createLogger();
