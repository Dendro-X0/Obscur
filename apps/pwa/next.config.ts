import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir: string = path.dirname(fileURLToPath(import.meta.url));
const repoRoot: string = path.resolve(currentDir, "../..");

// Static export only for production Tauri/mobile shell builds — not `next dev`.
// `output: "export"` in dev breaks routes that use `useSearchParams` (e.g. /groups/view).
const isStaticExportBuild =
  process.env.TAURI_BUILD === "true" && process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isStaticExportBuild && { output: "export" }),
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "emoji-picker-react"]
  },
  devIndicators: false,
  // Ensure turbopack key is always present to satisfy Next.js 16 build requirements
  turbopack: process.env.VERCEL ? {} : {
    root: repoRoot
  },
  transpilePackages: [
    "@dweb/core",
    "@dweb/crypto",
    "@dweb/nostr",
    "@dweb/storage",
    "@dweb/ui-kit",
    "@dweb/transport-contracts",
    "@dweb/transport-team-relay",
    "@dweb/transport-coordination",
    "@dweb/transport-nostr",
    "@dweb/client-gateway",
  ]
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

export default withPWAConfig(nextConfig);
