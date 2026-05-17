#!/usr/bin/env node
/**
 * Sync version from version.json to all package.json and tauri.conf.json files
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

/**
 * Read version from version.json
 */
function readVersion() {
    const versionPath = resolve(rootDir, 'version.json');
    const versionData = JSON.parse(readFileSync(versionPath, 'utf-8'));
    return versionData.version;
}

/**
 * Update version in a JSON file
 */
function updateJsonVersion(filePath, version) {
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
        const version = readVersion();
        console.log(`📦 Syncing version: ${version}\n`);

        // Update PWA package.json
        updateJsonVersion(
            resolve(rootDir, 'apps/pwa/package.json'),
            version
        );

        // Update Desktop package.json
        updateJsonVersion(
            resolve(rootDir, 'apps/desktop/package.json'),
            version
        );

        // Update Tauri config
        updateJsonVersion(
            resolve(rootDir, 'apps/desktop/src-tauri/tauri.conf.json'),
            version
        );

        // Update shared packages
        const packages = ['dweb-core', 'dweb-crypto', 'dweb-nostr', 'dweb-storage'];
        for (const pkg of packages) {
            updateJsonVersion(
                resolve(rootDir, `packages/${pkg}/package.json`),
                version
            );
        }

        console.log(`\n✨ All versions synced to v${version}`);
    } catch (error) {
        console.error('❌ Error syncing versions:', error.message);
        process.exit(1);
    }
}

syncVersions();
