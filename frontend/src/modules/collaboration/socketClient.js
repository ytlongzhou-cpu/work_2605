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
    // BUG FIX：原配置只有 ['websocket']，跳过了 polling 握手。
    // 在局域网环境下，某些路由器/交换机对 WebSocket 升级请求处理异常，
    // 纯 WebSocket 模式下连接会静默失败（无 error 事件，只是超时）。
    // 恢复为 socket.io 默认的 ['polling', 'websocket']：
    //   先用 polling 完成认证握手，再升级为 WebSocket 保持长连接。
    // 这样即使 WebSocket 升级失败，也能 fallback 到 polling 保证同步。
    transports: ['polling', 'websocket'],
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
