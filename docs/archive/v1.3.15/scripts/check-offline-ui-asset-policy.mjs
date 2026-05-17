#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const shellFiles = [
  "apps/pwa/app/layout.tsx",
  "apps/pwa/app/globals.css",
  "apps/pwa/app/components/pwa-service-worker-registrar.tsx",
  "apps/pwa/public/sw.js",
  "apps/pwa/public/manifest.webmanifest",
];

const layoutIconRefRegex = /(?:url|apple):\s*["'](\/[^"']+)["']/g;
const remoteUrlRegex = /https?:\/\/[^\s"'`)<]+/g;
const remoteCssImportRegex = /@import\s+url\(\s*["']?https?:\/\//i;

const toPosix = (value) => value.replaceAll("\\", "/");

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const resolveIconAssetPath = async (assetPath) => {
  const normalized = assetPath.replace(/^\//, "");
  const publicPath = path.join(repoRoot, "apps/pwa/public", normalized);
  const routePath = path.join(repoRoot, "apps/pwa/app", normalized, "route.ts");
  if (await exists(publicPath)) {
    return toPosix(path.relative(repoRoot, publicPath));
  }
  if (await exists(routePath)) {
    return toPosix(path.relative(repoRoot, routePath));
  }
  return null;
};

const collectRemoteUrls = (text) => {
  const matches = text.match(remoteUrlRegex);
  if (!matches) return [];
  return [...new Set(matches)];
};

const main = async () => {
  const errors = [];

  for (const relativeFile of shellFiles) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const text = await fs.readFile(absoluteFile, "utf8");

    const remoteUrls = collectRemoteUrls(text);
    if (remoteUrls.length > 0) {
      for (const remoteUrl of remoteUrls) {
        errors.push(`[remote-url-in-offline-shell] ${relativeFile} -> ${remoteUrl}`);
      }
    }

    if (relativeFile.endsWith("globals.css") && remoteCssImportRegex.test(text)) {
      errors.push(`[remote-css-import] ${relativeFile}`);
    }
  }

  const layoutPath = path.join(repoRoot, "apps/pwa/app/layout.tsx");
  const layoutText = await fs.readFile(layoutPath, "utf8");
  const globalsCssPath = path.join(repoRoot, "apps/pwa/app/globals.css");
  const globalsCssText = await fs.readFile(globalsCssPath, "utf8");

  if (layoutText.includes('from "next/font/google"')) {
    errors.push("[layout-font-owner-remote] apps/pwa/app/layout.tsx (unexpected next/font/google import in offline shell)");
  }

  const hasLocalSansOwner = globalsCssText.includes("--font-geist-sans:");
  const hasLocalMonoOwner = globalsCssText.includes("--font-geist-mono:");
  if (!hasLocalSansOwner || !hasLocalMonoOwner) {
    errors.push("[layout-font-owner-missing] apps/pwa/app/globals.css (expected local --font-geist-sans and --font-geist-mono owners)");
  }

  if (!layoutText.includes('manifest: "/manifest.webmanifest"')) {
    errors.push("[layout-manifest-contract-missing] apps/pwa/app/layout.tsx (expected metadata manifest path)");
  }

  const referencedLayoutAssets = [];
  let iconMatch;
  while ((iconMatch = layoutIconRefRegex.exec(layoutText)) !== null) {
    referencedLayoutAssets.push(iconMatch[1]);
  }

  for (const assetPath of referencedLayoutAssets) {
    const resolved = await resolveIconAssetPath(assetPath);
    if (!resolved) {
      errors.push(`[missing-layout-asset] apps/pwa/app/layout.tsx -> ${assetPath}`);
    }
  }

  const swRegistrarPath = path.join(repoRoot, "apps/pwa/app/components/pwa-service-worker-registrar.tsx");
  const swRegistrarText = await fs.readFile(swRegistrarPath, "utf8");
  if (!swRegistrarText.includes('register("/sw.js")')) {
    errors.push("[service-worker-register-path] apps/pwa/app/components/pwa-service-worker-registrar.tsx (expected /sw.js)");
  }
  if (!swRegistrarText.includes("hasNativeRuntime")) {
    errors.push("[service-worker-native-runtime-gate] apps/pwa/app/components/pwa-service-worker-registrar.tsx (expected hasNativeRuntime gate)");
  }

  const swPath = path.join(repoRoot, "apps/pwa/public/sw.js");
  const swText = await fs.readFile(swPath, "utf8");
  if (!swText.includes("obscur-app-shell-")) {
    errors.push("[service-worker-cache-owner] apps/pwa/public/sw.js (expected obscur-app-shell cache owner)");
  }
  if (!swText.includes('request.mode === "navigate"')) {
    errors.push("[service-worker-navigation-handler] apps/pwa/public/sw.js (expected navigation fetch handling)");
  }

  const manifestPath = path.join(repoRoot, "apps/pwa/public/manifest.webmanifest");
  const manifestText = await fs.readFile(manifestPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`offline:asset-policy check failed: invalid manifest JSON (${message})`);
    process.exit(1);
    return;
  }

  if (manifest.start_url !== "/") {
    errors.push(`[manifest-start-url] apps/pwa/public/manifest.webmanifest (expected "/" got "${String(manifest.start_url)}")`);
  }
  if (manifest.scope !== "/") {
    errors.push(`[manifest-scope] apps/pwa/public/manifest.webmanifest (expected "/" got "${String(manifest.scope)}")`);
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    errors.push("[manifest-icons] apps/pwa/public/manifest.webmanifest (expected non-empty icons array)");
  } else {
    for (const icon of manifest.icons) {
      const src = typeof icon?.src === "string" ? icon.src : null;
      if (!src) {
        errors.push("[manifest-icon-src] apps/pwa/public/manifest.webmanifest (icon missing string src)");
        continue;
      }
      if (/^https?:\/\//i.test(src)) {
        errors.push(`[manifest-remote-icon] apps/pwa/public/manifest.webmanifest -> ${src}`);
        continue;
      }
      if (!src.startsWith("/")) {
        errors.push(`[manifest-icon-not-rooted] apps/pwa/public/manifest.webmanifest -> ${src}`);
        continue;
      }

      const resolved = await resolveIconAssetPath(src);
      if (!resolved) {
        errors.push(`[manifest-icon-missing] apps/pwa/public/manifest.webmanifest -> ${src}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("offline:asset-policy check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("offline:asset-policy check passed.");
  console.log(`- shell files checked: ${shellFiles.length}`);
  console.log(`- layout icon references checked: ${referencedLayoutAssets.length}`);
  console.log(`- manifest icons checked: ${Array.isArray(manifest.icons) ? manifest.icons.length : 0}`);
};

void main().catch((error) => {
  console.error("offline:asset-policy check crashed:", error);
  process.exit(1);
});
