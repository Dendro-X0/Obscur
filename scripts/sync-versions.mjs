#!/usr/bin/env node
/**
 * Sync version from the root package.json to all workspace apps, packages, and tauri config.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

/**
 * Read version from the root package.json
 */
function getRootVersion() {
    const rootPkgPath = resolve(rootDir, 'package.json');
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
    return rootPkg.version;
}

/**
 * Update version in a JSON file
 */
function updateJsonVersion(filePath, version) {
    if (!existsSync(filePath)) {
        console.warn(`⚠️ File not found: ${filePath}`);
        return;
    }
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    content.version = version;
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${filePath} to v${version}`);
}

/**
 * Main sync function
 */
function syncVersions() {
    try {
        const version = getRootVersion();
        if (!version) {
            throw new Error('No version found in root package.json');
        }
        console.log(`📦 Syncing version: ${version}\n`);

        // Update PWA
        updateJsonVersion(resolve(rootDir, 'apps/pwa/package.json'), version);

        // Update Desktop
        updateJsonVersion(resolve(rootDir, 'apps/desktop/package.json'), version);
        updateJsonVersion(resolve(rootDir, 'apps/desktop/src-tauri/tauri.conf.json'), version);

        // Update version.json (if used as a legacy or auxiliary tracker)
        updateJsonVersion(resolve(rootDir, 'version.json'), version);

        // Update all packages in the packages/ directory
        const packagesDir = resolve(rootDir, 'packages');
        if (existsSync(packagesDir)) {
            const packages = readdirSync(packagesDir);
            for (const pkg of packages) {
                const pkgPath = resolve(packagesDir, pkg, 'package.json');
                if (existsSync(pkgPath)) {
                    updateJsonVersion(pkgPath, version);
                }
            }
        }

        console.log(`\n✨ Workspace successfully synced to v${version}`);
    } catch (error) {
        console.error('❌ Error syncing versions:', error.message);
        process.exit(1);
    }
}

syncVersions();
