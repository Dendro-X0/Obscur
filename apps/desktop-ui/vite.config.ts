import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Cut 3.1 — Vite remaster face. Port 3350 avoids Next static-dev on 3340. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
