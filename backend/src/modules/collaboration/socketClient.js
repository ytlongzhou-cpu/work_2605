import { io } from 'socket.io-client';

// BUG FIX：生产部署时前端与后端同源，Socket.io 连接地址应为相对路径（不指定域名）
// Socket.io 传入空字符串时会自动连接当前页面的 origin
const SERVER_URL = import.meta.env.VITE_API_BASE_URL || '';

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
