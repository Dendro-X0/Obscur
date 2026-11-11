import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Cut 3.1 — Vite lab shell. Port 3350 avoids Next static-dev on 3340. */
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 3350,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 3350,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
