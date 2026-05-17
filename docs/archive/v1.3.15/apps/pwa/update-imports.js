
const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /from "\.\.\/lib\/cn"/g, to: 'from "@/app/lib/utils"' },
    { from: /from "\.\/lib\/cn"/g, to: 'from "@/app/lib/utils"' },
    { from: /from "@\/app\/lib\/cn"/g, to: 'from "@/app/lib/utils"' },
    { from: /from "\.\.\/lib\/use-identity"/g, to: 'from "@/app/features/auth/hooks/use-identity"' },
    { from: /from "\.\/lib\/use-identity"/g, to: 'from "@/app/features/auth/hooks/use-identity"' },
    { from: /from "@\/app\/lib\/use-identity"/g, to: 'from "@/app/features/auth/hooks/use-identity"' },
    { from: /from "\.\.\/lib\/use-profile"/g, to: 'from "@/app/features/profile/hooks/use-profile"' },
    { from: /from "\.\.\/lib\/use-blocklist"/g, to: 'from "@/app/features/contacts/hooks/use-blocklist"' },
    { from: /from "\.\.\/lib\/use-peer-trust"/g, to: 'from "@/app/features/contacts/hooks/use-peer-trust"' },
    { from: /from "\.\.\/lib\/use-relay-list"/g, to: 'from "@/app/features/relays/hooks/use-relay-list"' },
    { from: /from "\.\.\/lib\/use-relay-pool"/g, to: 'from "@/app/features/relays/hooks/use-relay-pool"' },
    { from: /from "\.\.\/lib\/use-conversations"/g, to: 'from "@/app/features/messaging/hooks/use-conversations"' },
    { from: /from "\.\.\/lib\/use-dm-controller"/g, to: 'from "@/app/features/messaging/hooks/use-dm-controller"' },
    { from: /from "\.\.\/lib\/use-enhanced-dm-controller"/g, to: 'from "@/app/features/messaging/hooks/use-enhanced-dm-controller"' },
    { from: /from "\.\.\/lib\/use-requests-inbox"/g, to: 'from "@/app/features/messaging/hooks/use-requests-inbox"' },
    { from: /from "\.\.\/lib\/use-nav-badges"/g, to: 'from "@/app/features/main-shell/hooks/use-nav-badges"' },
    { from: /from "\.\.\/lib\/use-theme"/g, to: 'from "@/app/features/settings/hooks/use-theme"' },
    { from: /from "\.\.\/lib\/use-auto-lock"/g, to: 'from "@/app/features/settings/hooks/use-auto-lock"' },
    { from: /from "\.\.\/lib\/use-horizontal-scroll"/g, to: 'from "@/app/features/messaging/hooks/use-horizontal-scroll"' },
    { from: /from "\.\.\/lib\/use-link-preview"/g, to: 'from "@/app/features/messaging/hooks/use-link-preview"' },
    { from: /from "\.\.\/lib\/api-base-url"/g, to: 'from "@/app/features/relays/utils/api-base-url"' },
    { from: /from "\.\.\/lib\/validate-relay-url"/g, to: 'from "@/app/features/relays/utils/validate-relay-url"' },
    { from: /from "\.\.\/lib\/parse-public-key-input"/g, to: 'from "@/app/features/profile/utils/parse-public-key-input"' },
    { from: /from "\.\.\/lib\/fetch-bootstrap-config"/g, to: 'from "@/app/features/onboarding/utils/fetch-bootstrap-config"' },
    { from: /from "\.\.\/lib\/parse-bootstrap-config"/g, to: 'from "@/app/features/onboarding/utils/parse-bootstrap-config"' },
    { from: /from "\.\.\/lib\/extract-first-url"/g, to: 'from "@/app/features/messaging/utils/extract-first-url"' },
    { from: /from "\.\.\/lib\/messenger-types"/g, to: 'from "@/app/features/messaging/types"' },
    { from: /from "\.\/messenger-types"/g, to: 'from "@/app/features/messaging/types"' },
    { from: /from "\.\.\/lib\/messenger-utils"/g, to: 'from "@/app/features/messaging/utils"' },
    { from: /from "\.\/messenger-utils"/g, to: 'from "@/app/features/messaging/utils"' },
    { from: /from "\.\.\/lib\/relay-connection"/g, to: 'from "@/app/features/relays/utils/relay-connection"' },
    { from: /from "\.\.\/lib\/relay-connection-status"/g, to: 'from "@/app/features/relays/types/relay-connection-status"' },
    { from: /from "\.\.\/lib\/create-relay-websocket"/g, to: 'from "@/app/features/relays/utils/create-relay-websocket"' },
    { from: /from "\.\.\/lib\/notifications\/get-notifications-enabled"/g, to: 'from "@/app/features/notifications/utils/get-notifications-enabled"' },
    { from: /from "\.\.\/lib\/notifications\/show-desktop-notification"/g, to: 'from "@/app/features/notifications/utils/show-desktop-notification"' },
    { from: /from "\.\.\/lib\/settings\/privacy-settings-service"/g, to: 'from "@/app/features/settings/services/privacy-settings-service"' },
    { from: /from "\.\.\/lib\/desktop\/use-tauri"/g, to: 'from "@/app/features/desktop/hooks/use-tauri"' },
    { from: /from "\.\.\/lib\/desktop\/use-desktop-notifications"/g, to: 'from "@/app/features/desktop/hooks/use-desktop-notifications"' },
    { from: /from "@\/app\/lib\/crypto\//g, to: 'from "@/app/features/crypto/' },
    { from: /from "@\/app\/lib\/relay-connection/g, to: 'from "@/app/features/relays/utils/relay-connection' },
    { from: /from "@\/app\/lib\/parse-public-key-input/g, to: 'from "@/app/features/profile/utils/parse-public-key-input' },
    { from: /from "@\/app\/lib\/nostr-safety-limits/g, to: 'from "@/app/features/relays/utils/nostr-safety-limits' },
    { from: /from "@\/app\/lib\/services\/nip65-service/g, to: 'from "@/app/features/relays/utils/nip65-service' },
    { from: /from "@\/app\/lib\/services\/nip96-upload-service/g, to: 'from "@/app/features/messaging/lib/nip96-upload-service' },
    { from: /from "@\/app\/lib\/services\/upload-service/g, to: 'from "@/app/features/messaging/lib/upload-service' },
    { from: /from "@\/app\/lib\/fetch-bootstrap-config/g, to: 'from "@/app/features/onboarding/utils/fetch-bootstrap-config' },
];

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('app', (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        replacements.forEach(r => {
            content = content.replace(r.from, r.to);
        });
        if (content !== original) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated imports in ${filePath}`);
        }
    }
});
