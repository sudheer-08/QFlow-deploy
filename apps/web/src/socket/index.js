import { io } from 'socket.io-client'

// Single socket connection for the whole app
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  autoConnect: false  // We connect manually after login
})

// Connect staff dashboard to their clinic room
export const connectClinic = (tenantId, userId, role) => {
  if (!socket.connected) socket.connect()
  socket.emit('connect_clinic', { tenantId, userId, role })
}

// Connect patient tracker page (no auth needed)
export const connectTracker = (trackerToken) => {
  if (!socket.connected) socket.connect()
  socket.emit('connect_tracker', { trackerToken })
}

export default socket
