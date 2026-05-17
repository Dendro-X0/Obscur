#!/usr/bin/env node

/**
 * Validation script for development build setup
 * Tests: 7.1 - Test local development builds
 * Requirements: 5.1, 5.2
 */

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { join } from 'path';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function checkCommand(name, command, args) {
  try {
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(command, args, { shell: true });
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error(`Exit code ${code}`));
        }
      });
      
      proc.on('error', reject);
    });
    
    log(`✅ ${name}: ${result}`, colors.green);
    return true;
  } catch (error) {
    log(`❌ ${name}: Not found`, colors.red);
    return false;
  }
}

async function main() {
  log('\n🧪 Desktop Development Build Validation', colors.cyan);
  log('=' .repeat(60) + '\n');
  
  const results = [];
  
  // Check dependencies
  log('Checking dependencies...', colors.cyan);
  results.push(await checkCommand('Node.js', 'node', ['--version']));
  results.push(await checkCommand('pnpm', 'pnpm', ['--version']));
  results.push(await checkCommand('Rust', 'rustc', ['--version']));
  results.push(await checkCommand('Cargo', 'cargo', ['--version']));
  
  console.log('');
  
  // Check Tauri config
  log('Checking Tauri configuration...', colors.cyan);
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    log(`✅ Config loaded: ${config.productName} v${config.version}`, colors.green);
    
    if (config.build.devUrl) {
      log(`⚠️  Dev URL: ${config.build.devUrl}`, colors.yellow);
      log(`   (Remote URL - task 1.3 needed for local PWA)`, colors.yellow);
    }
    
    if (config.app.windows && config.app.windows.length > 0) {
      log(`✅ Window config: ${config.app.windows[0].width}x${config.app.windows[0].height}`, colors.green);
    }
    
    results.push(true);
  } catch (error) {
    log(`❌ Failed to load Tauri config: ${error.message}`, colors.red);
    results.push(false);
  }
  
  console.log('');
  
  // Check package.json
  log('Checking package configuration...', colors.cyan);
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    
    log(`✅ Package: ${pkg.name} v${pkg.version}`, colors.green);
    
    if (pkg.scripts && pkg.scripts.dev) {
      log(`✅ Dev script: ${pkg.scripts.dev}`, colors.green);
    }
    
    if (pkg.dependencies && pkg.dependencies['@tauri-apps/cli']) {
      log(`✅ Tauri CLI: ${pkg.dependencies['@tauri-apps/cli']}`, colors.green);
    }
    
    results.push(true);
  } catch (error) {
    log(`❌ Failed to load package.json: ${error.message}`, colors.red);
    results.push(false);
  }
  
  console.log('');
  log('=' .repeat(60));
  
  const allPassed = results.every(r => r);
  
  if (allPassed) {
    log('✅ All validation checks passed!', colors.green);
    log('\nℹ️  Current setup:', colors.cyan);
    log('  - Desktop wrapper is configured');
    log('  - Points to remote PWA URL (valid for testing)');
    log('  - Ready for development and testing');
    log('\nℹ️  For full local PWA integration:', colors.cyan);
    log('  - Complete task 1.3 (Configure PWA build for desktop)');
    log('  - This will enable local PWA hot reload');
    return 0;
  } else {
    log('❌ Some validation checks failed', colors.red);
    log('Review the output above for details', colors.yellow);
    return 1;
  }
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    log(`❌ Validation failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
