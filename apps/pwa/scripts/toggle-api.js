/* eslint-disable */
/**
 * Hide/show app/api (+ api-backup) for Next static export.
 * Static export cannot include Route Handlers; we park them under `_api` / `_api-backup`.
 *
 * On Windows, IDE/TS/codegraph watchers often make `fs.renameSync(api → _api)` fail with EPERM
 * even when :3340 is free. Fall back to copy + recursive delete with retries.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const action = process.argv[2];
const appDir = path.join(__dirname, '..', 'app');

const targets = ['api', 'api-backup'];
const MAX_RENAME_ATTEMPTS = 30;
const RETRY_DELAY_MS = 200;
const MAX_RM_ATTEMPTS = 40;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableFsError = (error) => (
    Boolean(error)
    && (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES')
);

const renameWithRetry = async (fromPath, toPath) => {
    for (let attempt = 1; attempt <= MAX_RENAME_ATTEMPTS; attempt += 1) {
        try {
            fs.renameSync(fromPath, toPath);
            return;
        } catch (error) {
            if (!isRetryableFsError(error) || attempt === MAX_RENAME_ATTEMPTS) {
                throw error;
            }
            await sleep(RETRY_DELAY_MS);
        }
    }
};

const tryWindowsMove = (fromPath, toPath) => {
    if (process.platform !== 'win32') {
        return false;
    }
    const result = spawnSync(
        'powershell.exe',
        [
            '-NoProfile',
            '-Command',
            `Move-Item -LiteralPath ${JSON.stringify(fromPath)} -Destination ${JSON.stringify(toPath)} -Force`,
        ],
        { encoding: 'utf8' },
    );
    return result.status === 0 && fs.existsSync(toPath) && !fs.existsSync(fromPath);
};

const rmWithRetry = async (targetPath) => {
    for (let attempt = 1; attempt <= MAX_RM_ATTEMPTS; attempt += 1) {
        try {
            if (!fs.existsSync(targetPath)) {
                return;
            }
            fs.rmSync(targetPath, { recursive: true, force: true });
            if (!fs.existsSync(targetPath)) {
                return;
            }
        } catch (error) {
            if (!isRetryableFsError(error) && error.code !== 'ENOTEMPTY') {
                throw error;
            }
        }
        await sleep(RETRY_DELAY_MS);
    }
    throw new Error(`[toggle-api] Failed to remove "${path.basename(targetPath)}" after ${MAX_RM_ATTEMPTS} attempt(s)`);
};

/**
 * Copy source → dest, then remove source. Used when rename/Move-Item cannot break watcher locks.
 */
const migrateByCopy = async (fromPath, toPath) => {
    if (fs.existsSync(toPath)) {
        await rmWithRetry(toPath);
    }
    fs.cpSync(fromPath, toPath, { recursive: true, force: true });
    await rmWithRetry(fromPath);
    if (fs.existsSync(fromPath)) {
        throw new Error(
            `[toggle-api] Copied "${path.basename(fromPath)}" → "${path.basename(toPath)}" but source still locked; stop watchers / free :3340 and retry`,
        );
    }
};

const relocateDirectory = async (fromPath, toPath) => {
    try {
        await renameWithRetry(fromPath, toPath);
        return 'rename';
    } catch (renameError) {
        if (!isRetryableFsError(renameError)) {
            throw renameError;
        }
    }

    if (tryWindowsMove(fromPath, toPath)) {
        return 'powershell-move';
    }

    console.warn(
        `[toggle-api] rename/move locked for "${path.basename(fromPath)}" — using copy+delete fallback (Windows watcher EPERM)`,
    );
    await migrateByCopy(fromPath, toPath);
    return 'copy-delete';
};

const run = async () => {
    if (action !== 'hide' && action !== 'show') {
        throw new Error('[toggle-api] Usage: node scripts/toggle-api.js <hide|show>');
    }

    for (const target of targets) {
        const normalPath = path.join(appDir, target);
        const hiddenPath = path.join(appDir, `_${target}`);

        if (action === 'hide') {
            if (fs.existsSync(normalPath)) {
                if (fs.existsSync(hiddenPath)) {
                    // Previous hide left both (failed mid-flight) — prefer hidden, drop normal.
                    await rmWithRetry(normalPath);
                    console.log(`Hidden ${target} (cleared leftover ${target}; kept _${target})`);
                    continue;
                }
                const method = await relocateDirectory(normalPath, hiddenPath);
                console.log(`Hidden ${target} (${method})`);
            }
        } else if (fs.existsSync(hiddenPath)) {
            if (fs.existsSync(normalPath)) {
                await rmWithRetry(hiddenPath);
                console.log(`Restored ${target} (already present; cleared _${target})`);
                continue;
            }
            const method = await relocateDirectory(hiddenPath, normalPath);
            console.log(`Restored ${target} (${method})`);
        }
    }
};

run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const winHint = process.platform === 'win32' && !message.includes('3340')
        ? ' — if this persists: pnpm kill:dev-stack, close duplicate desktop:fast, then retry'
        : '';
    console.error(`${message}${winHint}`);
    process.exit(1);
});
