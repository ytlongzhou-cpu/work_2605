import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

let socket = null;

export function connectSocket(token) {
  if (socket && socket.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getSocket() {
  return socket;
}
