// Socket.io event handlers
// Every connected client joins a room based on their tenant or tracker token
// This ensures Clinic A never receives Clinic B's real-time updates

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Staff dashboard joins clinic room ────────────
    // Fired when receptionist, doctor, or admin dashboard loads
    socket.on('connect_clinic', ({ tenantId, userId, role }) => {
      socket.join(`tenant:${tenantId}`);
      console.log(`${role} joined tenant room: ${tenantId}`);
    });

    // ─── Patient tracker page joins their personal room ───
    // Fired when patient opens their /track/:token page
    // No auth needed — just the tracker token
    socket.on('connect_tracker', ({ trackerToken }) => {
      socket.join(`tracker:${trackerToken}`);
      console.log(`Patient tracker connected: ${trackerToken}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
