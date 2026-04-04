import { io } from 'socket.io-client'

// Single socket connection for the whole app
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  autoConnect: false  // We connect manually after login
})

const connectWithAuth = () => {
  socket.auth = { token: localStorage.getItem('qflow_token') || null }
  if (!socket.connected) socket.connect()
}

// Connect staff dashboard to their clinic room
export const connectClinic = (tenantId, userId, role) => {
  connectWithAuth()
  socket.emit('connect_clinic', { tenantId, userId, role })
}

// Connect patient tracker page (no auth needed)
export const connectTracker = (trackerToken) => {
  socket.auth = {}
  if (!socket.connected) socket.connect()
  socket.emit('connect_tracker', { trackerToken })
}

// Connect public clinic and booking pages to clinic-specific room
export const connectPublicClinic = (subdomain) => {
  socket.auth = {}
  if (!socket.connected) socket.connect()
  socket.emit('connect_public_clinic', { subdomain })
}

export default socket
