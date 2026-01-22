import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir: string = path.dirname(fileURLToPath(import.meta.url));
const repoRoot: string = path.resolve(currentDir, "../..");

const nextConfig: NextConfig = {
  output: "export",
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
