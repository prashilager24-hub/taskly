import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  //base: '/Taskly/',
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  server: {
    host: true,
    port: 3030,
    // ── Local dev: allow both localhost and the production hostname ──────────
    allowedHosts: ['taskly.tapmind.io', 'localhost', '127.0.0.1'],
    // ── Proxy all API calls to the Node.js backend ───────────────────────────
    // The frontend uses relative URLs like /t2.0/authentificationUtilization/*
    // and /api/* — Vite forwards them to the backend so no CORS issues locally.
    proxy: {
      '/t2.0': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
    // ── In production (nginx) HMR WebSocket was disabled; enable for local ──
    hmr: true,
    watch: {
      usePolling: false,
    },
  },
  esbuild: {
    target: 'esnext',
  },
});
