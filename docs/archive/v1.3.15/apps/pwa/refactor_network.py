
import os
import re

print(f"Current working directory: {os.getcwd()}")

# Define mappings for path replacements
path_mappings = [
    (r'@/app/features/contacts', '@/app/features/network'),
    (r'from "\.\.\/lib\/use-blocklist"', 'from "@/app/features/network/hooks/use-blocklist"'),
    (r'from "\.\.\/lib\/use-peer-trust"', 'from "@/app/features/network/hooks/use-peer-trust"'),
    (r'\.\./\.\./contacts', '../../network'),
    (r'\.\./contacts', '../network'),
    (r'from "\.\./providers/contacts-provider"', 'from "../providers/network-provider"'),
]

# Define mappings for symbol replacements
symbol_mappings = [
    (r'ContactsProvider', 'NetworkProvider'),
    (r'useContacts', 'useNetwork'),
    (r'ContactsDashboard', 'NetworkDashboard'),
    (r'ContactsContext', 'NetworkContext'),
    (r'ContactsContextType', 'NetworkContextType'),
    (r'ContactsPage', 'NetworkPage'),
]

def update_file(filepath):
    print(f"Checking {filepath}...")
    if not os.path.exists(filepath):
        print(f"  File not found!")
        return False
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Apply path replacements
    for pattern, replacement in path_mappings:
        content = re.sub(pattern, replacement, content)
    
    # Apply symbol replacements
    for pattern, replacement in symbol_mappings:
        content = re.sub(pattern, replacement, content)
    
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  Updated!")
        return True
    print(f"  No changes.")
    return False

# Files to process
files_to_process = [
    'app/components/providers.tsx',
    'app/features/dev-tools/components/dev-panel.tsx',
    'app/features/main-shell/hooks/use-chat-actions.ts',
    'app/features/main-shell/main-shell.tsx',
    'app/features/messaging/components/global-dialog-manager.tsx',
    'app/features/messaging/components/trust-settings-panel.tsx',
    'app/features/network/components/contact-profile-view.tsx',
    'app/features/network/components/network-dashboard.tsx',
    'app/features/network/providers/network-provider.tsx',
    'app/network/page.tsx',
    'app/network/[pubkey]/page.tsx',
    'app/settings/page.tsx',
    'app/features/groups/components/invite-contacts-dialog.tsx',
    'app/features/messaging/components/new-chat-dialog.tsx',
    'app/features/messaging/hooks/use-conversations.ts',
]

for rel_path in files_to_process:
    abs_path = os.path.join(os.getcwd(), rel_path.replace('/', os.sep))
    update_file(abs_path)
