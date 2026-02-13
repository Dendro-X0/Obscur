const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const appDir = path.join(__dirname, '..', 'app');

const targets = ['api', 'api-backup'];

targets.forEach(target => {
    const normalPath = path.join(appDir, target);
    const hiddenPath = path.join(appDir, `_${target}`);

    if (action === 'hide') {
        if (fs.existsSync(normalPath)) {
            fs.renameSync(normalPath, hiddenPath);
            console.log(`Hidden ${target}`);
        }
    } else if (action === 'show') {
        if (fs.existsSync(hiddenPath)) {
            fs.renameSync(hiddenPath, normalPath);
            console.log(`Restored ${target}`);
        }
    }
});
