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
    allowedHosts: ['taskly.tapmind.io'],
    hmr: false,   // disable HMR WebSocket (nginx has no WS upgrade) — stop reconnect loop
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  esbuild: {
    target: 'esnext',
  },
});