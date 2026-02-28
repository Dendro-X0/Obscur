import os
import re

root_dir = r"e:\Web Project\experimental-workspace\newstart\apps\pwa"
components = [
    "avatar", "button", "card", "checkbox", "dialog", "dropdown-menu",
    "input", "label", "pagination", "progress", "skeleton", "textarea", "toast"
]

patterns = [
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']@/app/components/ui/{c}["\']', r'import {\1} from "@dweb/ui-kit"'),
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']\.\./\.\./components/ui/{c}["\']', r'import {\1} from "@dweb/ui-kit"'),
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']\.\./components/ui/{c}["\']', r'import {\1} from "@dweb/ui-kit"'),
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']@/app/lib/cn["\']', r'import {\1} from "@dweb/ui-kit"'),
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']\.\./\.\./lib/cn["\']', r'import {\1} from "@dweb/ui-kit"'),
    (r'import\s+{{([^}}]+)}}\s+from\s+["\']\.\./lib/cn["\']', r'import {\1} from "@dweb/ui-kit"'),
]

def refactor_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content
        for pattern_tmpl, replacement in patterns:
            if '{c}' in pattern_tmpl:
                for c in components:
                    pattern = pattern_tmpl.replace('{c}', c).replace('{{', r'\{').replace('}}', r'\}')
                    new_content = re.sub(pattern, replacement, new_content)
            else:
                pattern = pattern_tmpl.replace('{{', r'\{').replace('}}', r'\}')
                new_content = re.sub(pattern, replacement, new_content)
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Refactored: {file_path}")
    except Exception as e:
        print(f"Error refactoring {file_path}: {e}")

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            refactor_file(os.path.join(root, file))
