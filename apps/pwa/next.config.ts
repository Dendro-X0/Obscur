import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir: string = path.dirname(fileURLToPath(import.meta.url));
const repoRoot: string = path.resolve(currentDir, "../..");

// Only use static export for desktop builds (when TAURI_BUILD is set)
// For Vercel deployments, use dynamic rendering
const isTauriBuild = process.env.TAURI_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isTauriBuild && { output: "export" }),
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: repoRoot
  },
  transpilePackages: [
    "@dweb/core",
    "@dweb/crypto",
    "@dweb/nostr",
    "@dweb/storage"
  ]
};

export default nextConfig;
