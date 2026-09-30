'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const serviceRoutes = require('./routes/services');
const billRoutes = require('./routes/bills');
const webhookRoutes = require('./routes/webhooks');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Security Middleware
// ==========================================
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// General rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api', limiter);

// ==========================================
// Request Parsing
// ==========================================
// Webhook needs raw body for HMAC validation
app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = JSON.parse(req.body.toString('utf8'));
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ==========================================
// Logging
// ==========================================
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/api/health',
}));

// ==========================================
// Static Files (PDF invoices)
// ==========================================
app.use('/invoices', express.static(
  path.resolve(process.env.INVOICE_STORAGE_PATH || path.join(__dirname, '../storage/invoices'))
));

// ==========================================
// Health Check
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./db/pool');
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({ status: 'error', db: 'disconnected', message: 'Database unavailable' });
  }
});

// ==========================================
// API Routes
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// ==========================================
// Error Handling
// ==========================================
app.use(notFound);
app.use(errorHandler);

// ==========================================
// Start Server
// ==========================================
async function startServer() {
  try {
    // Run migrations on startup
    const migrate = require('./db/migrate');
    await migrate();
    logger.info('Database migrations applied');
  } catch (err) {
    logger.error('Failed to run migrations:', { error: err.message });
    // Don't exit - allow server to start even if migrations fail in dev
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received - shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      logger.info('Server stopped');
      process.exit(0);
    });
  });
}

startServer();

module.exports = app;
