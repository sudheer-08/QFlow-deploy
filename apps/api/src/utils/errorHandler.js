/**
 * Custom error classes for structured error handling across the API.
 * Used by middleware and route handlers for consistent error responses.
 */

class ApiError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();
  }
}

// 4xx Errors (Client)
class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', errorCode = 'BAD_REQUEST') {
    super(message, 400, errorCode);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Validation failed', errorCode = 'VALIDATION_ERROR') {
    super(message, 400, errorCode);
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', errorCode = 'UNAUTHORIZED') {
    super(message, 401, errorCode);
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', errorCode = 'FORBIDDEN') {
    super(message, 403, errorCode);
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Not found', errorCode = 'NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Conflict', errorCode = 'CONFLICT') {
    super(message, 409, errorCode);
  }
}

class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests', errorCode = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, errorCode);
  }
}

// 5xx Errors (Server)
class InternalServerError extends ApiError {
  constructor(message = 'Internal Server Error', errorCode = 'INTERNAL_ERROR') {
    super(message, 500, errorCode);
  }
}

class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service Unavailable', errorCode = 'SERVICE_UNAVAILABLE') {
    super(message, 503, errorCode);
  }
}

/**
 * Global error handler middleware
 * Place this AFTER all route handlers
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  const errorLog = {
    requestId: req.id || req.headers['x-request-id'],
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || 'UNKNOWN',
    message: err.message,
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ ERROR:', errorLog);
    if (err.stack) console.error('📍 Stack:', err.stack);
  } else {
    console.error('❌ ERROR:', JSON.stringify(errorLog));
  }

  // Send response
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: err.errorCode || 'UNKNOWN',
      message: err.message || 'An unexpected error occurred',
      requestId: req.id || req.headers['x-request-id'],
      timestamp: errorLog.timestamp
    }
  };

  // Don't expose internal stack traces in production
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  ApiError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  errorHandler
};
