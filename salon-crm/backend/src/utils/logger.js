'use strict';
const winston = require('winston');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const SENSITIVE_KEYS = [
  'password', 'password_hash', 'token', 'access_token', 'meta_access_token',
  'jwt', 'secret', 'api_key', 'app_secret', 'authorization',
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      clean[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      clean[key] = sanitize(obj[key]);
    } else {
      clean[key] = obj[key];
    }
  }
  return clean;
}

const sanitizeFormat = winston.format((info) => {
  return sanitize(info);
})();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp(),
    errors({ stack: true }),
    sanitizeFormat,
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? combine(timestamp(), sanitizeFormat, json())
        : combine(sanitizeFormat, colorize(), simple()),
    }),
  ],
});

logger.sanitize = sanitize;

module.exports = logger;
