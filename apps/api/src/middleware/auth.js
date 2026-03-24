const jwt = require('jsonwebtoken');
const supabase = require('../models/supabase');

// ─── Verify JWT and attach user + tenant to request ──
const authenticate = async (req, res, next) => {
  try {
    if (!process.env.JWT_ACCESS_SECRET) {
      return res.status(500).json({ error: 'Server auth is not configured' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Attach user info to every request — all routes can access req.user
    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,  // ← THIS is the key to multi-tenancy
      role: decoded.role,
      email: decoded.email
    };

    const isPatient = req.user.role === 'patient';
    const hasTenantForStaff = Boolean(req.user.tenantId);
    if (!req.user.id || !req.user.role || (!isPatient && !hasTenantForStaff)) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── Role guard — use after authenticate ─────────────
// Usage: router.get('/admin-only', authenticate, requireRole('clinic_admin'), handler)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }
    next();
  };
};

module.exports = { authenticate, requireRole };
