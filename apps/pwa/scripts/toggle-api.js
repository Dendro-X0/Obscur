/* eslint-disable */
const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const appDir = path.join(__dirname, '..', 'app');

const targets = ['api', 'api-backup'];
const MAX_RENAME_ATTEMPTS = 30;
const RETRY_DELAY_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableFsError = (error) => (
    Boolean(error)
    && (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'EACCES')
);

/**
 * Windows directory watchers (IDE/indexers) often deny rename of `app/api`
 * while still allowing copy + delete of the tree. Prefer rename; fall back.
 */
const moveDirViaCopy = (fromPath, toPath) => {
    if (fs.existsSync(toPath)) {
        fs.rmSync(toPath, { recursive: true, force: true });
    }
    fs.cpSync(fromPath, toPath, { recursive: true });
    fs.rmSync(fromPath, { recursive: true, force: true });
};

const renameWithRetry = async (fromPath, toPath) => {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RENAME_ATTEMPTS; attempt += 1) {
        try {
            fs.renameSync(fromPath, toPath);
            return;
        } catch (error) {
            lastError = error;
            if (!isRetryableFsError(error) || attempt === MAX_RENAME_ATTEMPTS) {
                break;
            }
            await sleep(RETRY_DELAY_MS);
        }
    }

    try {
        moveDirViaCopy(fromPath, toPath);
        console.log(
            `[toggle-api] rename blocked (${lastError?.code ?? 'unknown'}); used copy+remove for ${path.basename(fromPath)}`,
        );
        return;
    } catch (copyError) {
        const fromName = path.basename(fromPath);
        const toName = path.basename(toPath);
        const winHint = process.platform === 'win32'
            ? ' — often Next.js on :3340 (or another watcher) locking the folder; stop `pnpm dev:desktop:fast` / free :3340, then retry'
            : '';
        throw new Error(
            `[toggle-api] Failed to move "${fromName}" -> "${toName}" after rename+copy fallback: ${copyError.message}${winHint}`,
        );
    }
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
                await renameWithRetry(normalPath, hiddenPath);
                console.log(`Hidden ${target}`);
            }
        } else if (fs.existsSync(hiddenPath)) {
            await renameWithRetry(hiddenPath, normalPath);
            console.log(`Restored ${target}`);
        }
    }
};

run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
