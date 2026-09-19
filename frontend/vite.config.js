import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // ─── Build Optimizations (Efficiency) ────────────────────────────────────────
  build: {
    // Split vendor libraries into separate cacheable chunks
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-utils": ["axios", "clsx"],
          "vendor-ui": ["lucide-react", "react-dropzone", "react-markdown"],
        },
      },
    },
    // Enable source maps for production debugging
    sourcemap: false,
    // Target modern browsers for smaller output
    target: "es2020",
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 600,
  },
});
