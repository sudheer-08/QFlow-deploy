/**
 * Socket.io Real-time Event Diagnostics & Monitoring
 * Ensures all events are properly emitted and received
 */

const socketEvents = {
  // Queue events (Clinic staff)
  'queue:patient_added': {
    emittedBy: ['POST /api/queue/register', 'POST /api/public/register'],
    receivedBy: ['ReceptionPage', 'AdminPage', 'DisplayBoard'],
    room: 'tenant:{tenantId}',
    payload: ['token', 'name', 'priority', 'registrationType', 'aiSummary', 'entryId'],
    description: 'Fired when a new patient is registered in the queue'
  },
  'queue:token_called': {
    emittedBy: ['PATCH /api/queue/:entryId/call'],
    receivedBy: ['ReceptionPage', 'Patient tracker', 'AdminPage'],
    room: 'tenant:{tenantId}, tracker:{token}',
    payload: ['token', 'patientName', 'entryId'],
    description: 'Fired when patient is called by doctor'
  },
  'queue:entry_completed': {
    emittedBy: ['PATCH /api/queue/:entryId/complete'],
    receivedBy: ['ReceptionPage', 'AdminPage', 'Doctor Dashboard'],
    room: 'tenant:{tenantId}',
    payload: ['token', 'entryId'],
    description: 'Fired when patient visit is completed'
  },
  'queue:no_show': {
    emittedBy: ['PATCH /api/no-show/queue/:entryId/no-show'],
    receivedBy: ['ReceptionPage', 'AdminPage'],
    room: 'tenant:{tenantId}',
    payload: ['token', 'patientName'],
    description: 'Fired when patient is marked as no-show'
  },
  
  // Patient events
  'patient:arrived': {
    emittedBy: ['PUT /api/public/queue/:token/arrived'],
    receivedBy: ['ReceptionPage', 'Queue display'],
    room: 'tenant:{tenantId}',
    payload: ['patientName', 'token'],
    description: 'Fired when patient arrives at clinic'
  },
  'patient:called': {
    emittedBy: ['PATCH /api/queue/:entryId/call'],
    receivedBy: ['Patient tracker'],
    room: 'tracker:{token}',
    payload: ['message', 'token'],
    description: 'Sent to patient\'s personal tracker when called'
  },
  'patient:qr_checkin': {
    emittedBy: ['POST /api/qr/checkin'],
    receivedBy: ['AdminPage', 'ReceptionPage'],
    room: 'tenant:{tenantId}',
    payload: ['appointmentId', 'patientName', 'doctorName'],
    description: 'Fired when patient checks in via QR code'
  },
  
  // Appointment events
  'appointment:new': {
    emittedBy: ['POST /api/appointments/book'],
    receivedBy: ['AdminPage', 'Clinic dashboard'],
    room: 'tenant:{tenantId}, clinic:{subdomain}',
    payload: ['appointmentId', 'patientName', 'doctorName', 'date', 'time'],
    description: 'Fired when new appointment is booked'
  },
  'clinic:updated': {
    emittedBy: ['POST /api/appointments/book'],
    receivedBy: ['Public clinic page'],
    room: 'clinic:{subdomain}',
    payload: ['appointmentCount', 'timestamp'],
    description: 'Fired to update public clinic page when appointment is booked'
  },
  
  // Doctor events
  'doctor:status_changed': {
    emittedBy: ['PATCH /api/doctors/:doctorId/status'],
    receivedBy: ['AdminPage', 'ReceptionPage'],
    room: 'tenant:{tenantId}',
    payload: ['doctorId', 'doctorName', 'status'],
    description: 'Fired when doctor\'s availability status changes'
  }
};

/**
 * Diagnostic function to verify Socket.io connectivity
 * Can be called from frontend to test socket connection
 */
function getSocketDiagnostics() {
  return {
    events: socketEvents,
    checklist: [
      {
        item: 'Socket.io server initialized',
        endpoint: '/api/health'
      },
      {
        item: 'CORS configured for frontend origin',
        endpoint: 'Check env: FRONTEND_URL, CORS_ALLOWED_ORIGINS'
      },
      {
        item: 'Rooms created dynamically on client connect',
        endpoint: 'Socket handlers in src/socket/handlers.js'
      },
      {
        item: 'Tenant isolation enforced',
        endpoint: 'Room pattern: tenant:{tenantId}'
      },
      {
        item: 'Patient tracking isolated',
        endpoint: 'Room pattern: tracker:{token}'
      },
      {
        item: 'Public clinic updates isolated',
        endpoint: 'Room pattern: clinic:{subdomain}'
      },
      {
        item: 'Events invalidate React Query caches',
        endpoint: 'queryClient.invalidateQueries() on event receipt'
      },
      {
        item: 'Graceful fallback when Socket.io unavailable',
        endpoint: 'TanStack Query refetch intervals as backup'
      }
    ]
  };
}

/**
 * Verify all required Socket.io rooms are joined
 * Can be called from frontend for debugging
 */
function verifySocketRooms(socket, user) {
  if (!socket || !socket.connected) {
    return { status: 'DISCONNECTED', message: 'Socket is not connected' };
  }

  const diagnostics = {
    socketId: socket.id,
    connected: socket.connected,
    rooms: Array.from(socket.rooms || []),
    expectedRooms: []
  };

  if (user?.role === 'doctor' || user?.role === 'clinic_admin' || user?.role === 'receptionist') {
    diagnostics.expectedRooms.push(`tenant:${user.tenantId}`);
  }

  if (user?.role === 'patient') {
    diagnostics.expectedRooms.push(`tracker:${user.trackerToken}`);
  }

  diagnostics.allRoomsJoined = diagnostics.expectedRooms.every(room => 
    diagnostics.rooms.includes(room)
  );

  return diagnostics;
}

/**
 * Common Socket.io issues and solutions
 */
const commonIssues = [
  {
    issue: 'Real-time updates not showing up',
    causes: [
      'Socket.io not connected (check browser console for warnings)',
      'Wrong rooms joined (verify expectedRooms match)',
      'Event listener not registered in component',
      'TanStack Query cache not invalidated on event'
    ],
    solutions: [
      'Check socket.connected in browser console',
      'Verify socket.rooms contains expected tenant room',
      'Ensure useEffect registers socket.on() listeners',
      'Confirm queryClient.invalidateQueries() called in listener',
      'Check browser console for Socket.io errors',
      'Verify CORS_ALLOWED_ORIGINS includes frontend URL'
    ]
  },
  {
    issue: 'Different clinics seeing each other\'s data',
    causes: [
      'Rooms not properly isolated by tenant_id',
      'Events broadcast to wrong room',
      'Query filters missing tenant_id check'
    ],
    solutions: [
      'Verify io.to(`tenant:${tenantId}`) used in all events',
      'Confirm authentication middleware checks tenant_id',
      'Check Supabase queries filter by tenant_id'
    ]
  },
  {
    issue: 'Patients seeing other patients\' tracking info',
    causes: [
      'Tracker token room not properly isolated',
      'Events sent to wrong tracker room'
    ],
    solutions: [
      'Verify io.to(`tracker:${trackerToken}`) used',
      'Ensure tracker token is unique per appointment',
      'Check Socket.io room join validation'
    ]
  },
  {
    issue: 'Performance issues with many real-time events',
    causes: [
      'Too many simultaneous query invalidations',
      'Socket handlers queuing without limits',
      'Unfiltered event subscriptions'
    ],
    solutions: [
      'Batch invalidations with queryClient.invalidateQueries() debouncing',
      'Implement event deduplication',
      'Use selective query invalidation instead of broad patterns',
      'Consider using staleTime and cacheTime to reduce refetch frequency'
    ]
  }
];

module.exports = {
  socketEvents,
  getSocketDiagnostics,
  verifySocketRooms,
  commonIssues
};
