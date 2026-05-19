import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // BUG FIX：开启 host: true，让 Vite dev server 监听 0.0.0.0
    // 不设置时默认只监听 127.0.0.1，局域网其他电脑无法访问
    host: true,
    proxy: {
      '/api': {
        // BUG FIX：proxy target 必须用 127.0.0.1（或机器IP），不能用 localhost
        // 在某些 Node.js 版本 localhost 会优先解析为 ::1 (IPv6)，导致代理失败
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
