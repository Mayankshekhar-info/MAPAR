/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  server: {
    port: 5185,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL || "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
