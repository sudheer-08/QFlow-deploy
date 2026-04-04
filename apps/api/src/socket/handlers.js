// Socket.io event handlers
// Every connected client joins a room based on their tenant or tracker token
// This ensures Clinic A never receives Clinic B's real-time updates

const jwt = require('jsonwebtoken');

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isTrackerToken = (value) => typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value);

const isSubdomain = (value) => typeof value === 'string'
  && /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$/.test(value.trim().toLowerCase());

function getSocketUser(socket) {
  const token = socket.handshake?.auth?.token;
  if (!token || !process.env.JWT_ACCESS_SECRET) return null;

  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Staff dashboard joins clinic room ────────────
    // Fired when receptionist, doctor, or admin dashboard loads
    socket.on('connect_clinic', ({ tenantId, userId, role }) => {
      const decoded = getSocketUser(socket);
      if (!decoded || !isUuid(tenantId) || decoded.tenantId !== tenantId) {
        return;
      }

      socket.join(`tenant:${tenantId}`);
      console.log(`${role} joined tenant room: ${tenantId}`);
    });

    // ─── Patient tracker page joins their personal room ───
    // Fired when patient opens their /track/:token page
    // No auth needed — just the tracker token
    socket.on('connect_tracker', ({ trackerToken }) => {
      if (!isTrackerToken(trackerToken)) return;
      socket.join(`tracker:${trackerToken}`);
      console.log(`Patient tracker connected: ${trackerToken}`);
    });

    // ─── Public clinic page joins clinic room ──────────
    // Fired when patient opens /clinic/:subdomain or /book/:subdomain
    socket.on('connect_public_clinic', ({ subdomain }) => {
      if (typeof subdomain !== 'string' || !subdomain.trim() || !isSubdomain(subdomain)) return;
      const cleanSubdomain = subdomain.trim().toLowerCase();
      socket.join(`clinic:${cleanSubdomain}`);
      console.log(`Public clinic page connected: ${cleanSubdomain}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
