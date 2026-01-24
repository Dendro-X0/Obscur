#!/usr/bin/env node
/**
 * Bump version in version.json
 * Usage: node scripts/bump-version.js [major|minor|patch]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const versionPath = resolve(rootDir, 'version.json');

/**
 * Parse semantic version
 */
function parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        throw new Error(`Invalid version format: ${version}`);
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
    };
}

/**
 * Bump version based on type
 */
function bumpVersion(version, type) {
    const parts = parseVersion(version);

    switch (type) {
        case 'major':
            parts.major += 1;
            parts.minor = 0;
            parts.patch = 0;
            break;
        case 'minor':
            parts.minor += 1;
            parts.patch = 0;
            break;
        case 'patch':
        default:
            parts.patch += 1;
            break;
    }

    return `${parts.major}.${parts.minor}.${parts.patch}`;
}

/**
 * Main bump function
 */
function main() {
    const bumpType = process.argv[2] || 'patch';

    if (!['major', 'minor', 'patch'].includes(bumpType)) {
        console.error('❌ Invalid bump type. Use: major, minor, or patch');
        process.exit(1);
    }

    try {
        // Read current version
        const versionData = JSON.parse(readFileSync(versionPath, 'utf-8'));
        const currentVersion = versionData.version;

        // Bump version
        const newVersion = bumpVersion(currentVersion, bumpType);

        console.log(`📦 Bumping version: ${currentVersion} → ${newVersion} (${bumpType})\n`);

        // Update version.json
        versionData.version = newVersion;
        writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n', 'utf-8');
        console.log(`✅ Updated version.json to v${newVersion}`);

        // Sync to all files
        console.log('\n🔄 Syncing versions across workspace...\n');
        execSync('node scripts/sync-version.js', { stdio: 'inherit', cwd: rootDir });

        console.log(`\n✨ Version bumped to v${newVersion}`);
        console.log(`\n💡 Next steps:`);
        console.log(`   1. Review changes: git diff`);
        console.log(`   2. Commit: git add . && git commit -m "v${newVersion} release"`);
        console.log(`   3. Tag: git tag v${newVersion}`);
        console.log(`   4. Push: git push origin main && git push origin v${newVersion}`);
    } catch (error) {
        console.error('❌ Error bumping version:', error.message);
        process.exit(1);
    }
}

main();
