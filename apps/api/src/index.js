require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const { createServer } = require('http');
const net = require('net');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { getMorganMiddleware, requestIdMiddleware } = require('./utils/logging');
const { errorHandler } = require('./utils/errorHandler');
const { initWhatsApp } = require('./services/whatsAppClient');


const app = express();
const httpServer = createServer(app);

const FRONTEND_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || FRONTEND_ORIGIN)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

app.set('trust proxy', 1);

// Request ID middleware for tracing
app.use(requestIdMiddleware);

// Morgan HTTP request logging
app.use(getMorganMiddleware());

// Security & compression
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_PER_MIN || 240),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);
app.use('/api/v1', limiter);

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PUBLIC_RATE_LIMIT_PER_MIN || 60),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/public', publicLimiter);
app.use('/api/v1/public', publicLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_PER_15_MIN || 25),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register-patient', authLimiter);
app.use('/api/auth/register-clinic', authLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register-patient', authLimiter);
app.use('/api/v1/auth/register-clinic', authLimiter);

// Routes
app.use('/api/auth',                require('./routes/auth'));
app.use('/api/queue',               require('./routes/queue'));
app.use('/api/queue',               require('./routes/doctors'));
app.use('/api/public',              require('./routes/public'));
app.use('/api/analytics',           require('./routes/analytics'));
app.use('/api/test',                require('./routes/test'));
app.use('/api/patient',             require('./routes/patient'));
app.use('/api/appointments',        require('./routes/appointments'));
app.use('/api/reviews',             require('./routes/reviews'));
app.use('/api/chat',                require('./routes/chat'));
app.use('/api/health-records',      require('./routes/healthRecords'));
app.use('/api/family',              require('./routes/family'));
app.use('/api/holidays',            require('./routes/holidays'));
app.use('/api/advanced-analytics',  require('./routes/advancedAnalytics'));
app.use('/api/qr',                  require('./routes/qrCheckin'));
app.use('/api/whatsapp',            require('./routes/whatsapp'));
app.use('/api/intake',              require('./routes/intake'));
app.use('/api/doctor-brief',        require('./routes/doctorBrief'));
app.use('/api/no-show',             require('./routes/noShow'));
app.use('/api/revenue',             require('./routes/revenue'));
app.use('/api/communications',      require('./routes/communications'));
app.use('/api/performance',         require('./routes/performance'));
app.use('/api/pin',                 require('./routes/staffPin'));
app.use('/api/clinic-profile',      require('./routes/clinicProfile'));
app.use('/api/follow-up',           require('./routes/followUp'));
app.use('/api/post-visit',          require('./routes/postVisit'));
app.use('/api/booking-requests',    require('./routes/bookingRequests'));

// Versioned v1 routes
app.use('/api/v1/auth',                require('./routes/auth'));
app.use('/api/v1/queue',               require('./routes/queue'));
app.use('/api/v1/queue',               require('./routes/doctors'));
app.use('/api/v1/public',              require('./routes/public'));
app.use('/api/v1/analytics',           require('./routes/analytics'));
app.use('/api/v1/test',                require('./routes/test'));
app.use('/api/v1/patient',             require('./routes/patient'));
app.use('/api/v1/appointments',        require('./routes/appointments'));
app.use('/api/v1/reviews',             require('./routes/reviews'));
app.use('/api/v1/chat',                require('./routes/chat'));
app.use('/api/v1/health-records',      require('./routes/healthRecords'));
app.use('/api/v1/family',              require('./routes/family'));
app.use('/api/v1/holidays',            require('./routes/holidays'));
app.use('/api/v1/advanced-analytics',  require('./routes/advancedAnalytics'));
app.use('/api/v1/qr',                  require('./routes/qrCheckin'));
app.use('/api/v1/whatsapp',            require('./routes/whatsapp'));
app.use('/api/v1/intake',              require('./routes/intake'));
app.use('/api/v1/doctor-brief',        require('./routes/doctorBrief'));
app.use('/api/v1/no-show',             require('./routes/noShow'));
app.use('/api/v1/revenue',             require('./routes/revenue'));
app.use('/api/v1/communications',      require('./routes/communications'));
app.use('/api/v1/performance',         require('./routes/performance'));
app.use('/api/v1/pin',                 require('./routes/staffPin'));
app.use('/api/v1/clinic-profile',      require('./routes/clinicProfile'));
app.use('/api/v1/follow-up',           require('./routes/followUp'));
app.use('/api/v1/post-visit',          require('./routes/postVisit'));
app.use('/api/v1/booking-requests',    require('./routes/bookingRequests'));

// Health check endpoint
app.use('/health', require('./routes/health'));
app.use('/api/v1/health', require('./routes/health'));

app.use((err, req, res, next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked', requestId: req.requestId });
  }
  return next(err);
});

const { startNoShowChecker } = require('./jobs/noShowChecker');
try {
  startNoShowChecker();
} catch (err) {
  console.warn('⚠️ No-show checker could not start:', err.message);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { 
      code: 'NOT_FOUND',
      message: 'Route not found', 
      requestId: req.requestId 
    } 
  });
});

// Global error handler (must be last middleware)
app.use(errorHandler);

require('./socket/handlers')(io);

// Start reminders and make queue accessible to health check
const { startDailyCheck, reminderQueue, queueAvailable } = require('./jobs/reminders');
try {
  startDailyCheck();
  global.reminderQueue = reminderQueue;
  global.queueAvailable = queueAvailable;
  console.log('✅ Background reminder jobs started');
} catch (err) {
  console.warn('⚠️ Reminder jobs could not start (Redis may not be running):', err.message);
}

// Initialize WhatsApp — scan QR in console on first run
const whatsappClient = initWhatsApp();
global.whatsappClient = whatsappClient;
console.log('✅ WhatsApp Web.js initializing...');

const PORT = Number(process.env.PORT || 5000);
const MAX_PORT_SCAN = Number(process.env.PORT_SCAN_LIMIT || 20);

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port);
  });
}

async function resolveServerPort(startPort) {
  if (process.env.NODE_ENV === 'production') {
    return startPort;
  }

  for (let i = 0; i < MAX_PORT_SCAN; i += 1) {
    const candidate = startPort + i;
    const available = await checkPortAvailable(candidate);
    if (available) return candidate;
  }

  throw new Error(`No open port found from ${startPort} to ${startPort + MAX_PORT_SCAN - 1}`);
}

let server;

async function startServer() {
  const selectedPort = await resolveServerPort(PORT);
  if (selectedPort !== PORT) {
    console.warn(`⚠️ Port ${PORT} is busy. Falling back to port ${selectedPort} in development.`);
  }

  server = httpServer.listen(selectedPort, () => {
    console.log(`✅ QFlow API running on port ${selectedPort}`);
    console.log('✅ Socket.io ready for real-time connections');
  });

  server.on('error', (err) => {
    console.error('❌ Failed to start HTTP server:', err.message);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('❌ Startup error:', err.message);
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Force shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));