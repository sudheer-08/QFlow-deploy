/**
 * Structured logging and request tracking utilities
 * Provides request ID correlation, Morgan configuration, and centralized logging
 */

const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate unique request ID for tracing
 */
const generateRequestId = () => uuidv4();

/**
 * Middleware to attach request IDs to all requests
 * Useful for correlating logs across multiple services
 */
const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('x-request-id', req.id);
  next();
};

/**
 * Custom Morgan token for request ID
 */
morgan.token('request-id', (req) => req.id || '?');

/**
 * Morgan format for development: More readable, includes colors
 * Format: :request-id :method :url :status :response-time ms
 */
const devFormat = ':request-id :method :url :status :response-time ms';

/**
 * Morgan format for production: Structured JSON logs
 */
const prodFormat = JSON.stringify({
  requestId: ':request-id',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time ms',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  timestamp: new Date().toISOString()
});

/**
 * Get Morgan middleware configured for the environment
 */
const getMorganMiddleware = () => {
  const format = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

  const options = {
    skip: (req, res) => {
      // Skip health check and WebSocket upgrade logs to reduce noise
      return req.url === '/health' || req.upgraded;
    }
  };

  return morgan(format, options);
};

/**
 * Centralized logger function
 * Usage: logger.info('Message', {contextKey: contextValue})
 */
const logger = {
  info: (message, data = {}) => {
    const log = { level: 'INFO', message, timestamp: new Date().toISOString(), ...data };
    console.log(JSON.stringify(log));
  },
  warn: (message, data = {}) => {
    const log = { level: 'WARN', message, timestamp: new Date().toISOString(), ...data };
    console.warn(JSON.stringify(log));
  },
  error: (message, data = {}) => {
    const log = { level: 'ERROR', message, timestamp: new Date().toISOString(), ...data };
    console.error(JSON.stringify(log));
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      const log = { level: 'DEBUG', message, timestamp: new Date().toISOString(), ...data };
      console.log(JSON.stringify(log));
    }
  }
};

module.exports = {
  generateRequestId,
  requestIdMiddleware,
  getMorganMiddleware,
  logger
};
