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

const renameWithRetry = async (fromPath, toPath) => {
    for (let attempt = 1; attempt <= MAX_RENAME_ATTEMPTS; attempt += 1) {
        try {
            fs.renameSync(fromPath, toPath);
            return;
        } catch (error) {
            if (!isRetryableFsError(error) || attempt === MAX_RENAME_ATTEMPTS) {
                const fromName = path.basename(fromPath);
                const toName = path.basename(toPath);
                throw new Error(
                    `[toggle-api] Failed to rename "${fromName}" -> "${toName}" after ${attempt} attempt(s): ${error.message}`
                );
            }
            await sleep(RETRY_DELAY_MS);
        }
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
