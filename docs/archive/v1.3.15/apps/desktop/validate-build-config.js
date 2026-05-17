#!/usr/bin/env node

/**
 * Validate production build configuration
 * Tests: 7.2 - Test production builds locally
 * Requirements: 1.1, 1.2, 1.3, 6.1
 */

import { readFile, access, readdir } from 'fs/promises';
import { join } from 'path';
import { platform } from 'os';

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

async function checkIcons() {
  const iconPath = join(process.cwd(), 'src-tauri', 'icons');
  const requiredIcons = [
    '32x32.png',
    '128x128.png',
    '128x128@2x.png',
    'icon.icns',
    'icon.ico',
  ];
  
  const results = [];
  
  for (const icon of requiredIcons) {
    try {
      await access(join(iconPath, icon));
      log(`✅ ${icon}`, colors.green);
      results.push(true);
    } catch {
      log(`❌ ${icon} - missing`, colors.red);
      results.push(false);
    }
  }
  
  return results.every(r => r);
}

async function checkBundleConfig(config) {
  log('\nBundle Configuration:', colors.cyan);
  
  const checks = [];
  
  // Check bundle targets
  if (config.bundle.active) {
    log('✅ Bundle active: true', colors.green);
    checks.push(true);
  } else {
    log('❌ Bundle active: false', colors.red);
    checks.push(false);
  }
  
  // Check targets
  const targets = config.bundle.targets;
  if (targets) {
    log(`✅ Targets: ${Array.isArray(targets) ? targets.join(', ') : targets}`, colors.green);
    checks.push(true);
  } else {
    log('❌ No targets configured', colors.red);
    checks.push(false);
  }
  
  // Check metadata
  if (config.bundle.publisher) {
    log(`✅ Publisher: ${config.bundle.publisher}`, colors.green);
  } else {
    log('⚠️  Publisher not set', colors.yellow);
  }
  
  if (config.bundle.copyright) {
    log(`✅ Copyright: ${config.bundle.copyright}`, colors.green);
  } else {
    log('⚠️  Copyright not set', colors.yellow);
  }
  
  if (config.bundle.category) {
    log(`✅ Category: ${config.bundle.category}`, colors.green);
  } else {
    log('⚠️  Category not set', colors.yellow);
  }
  
  return checks.every(r => r);
}

async function checkPlatformConfig(config) {
  const os = platform();
  const osName = os === 'win32' ? 'Windows' : os === 'darwin' ? 'macOS' : 'Linux';
  
  log(`\n${osName} Configuration:`, colors.cyan);
  
  if (os === 'win32' && config.bundle.windows) {
    log('✅ Windows config present', colors.green);
    log(`   Digest: ${config.bundle.windows.digestAlgorithm}`, colors.green);
    log(`   Timestamp: ${config.bundle.windows.timestampUrl}`, colors.green);
    
    if (config.bundle.windows.certificateThumbprint) {
      log('✅ Certificate configured (signed builds)', colors.green);
    } else {
      log('⚠️  No certificate (unsigned builds)', colors.yellow);
    }
    return true;
  }
  
  if (os === 'darwin' && config.bundle.macOS) {
    log('✅ macOS config present', colors.green);
    log(`   Min version: ${config.bundle.macOS.minimumSystemVersion}`, colors.green);
    
    if (config.bundle.macOS.signingIdentity) {
      log('✅ Signing identity configured', colors.green);
    } else {
      log('⚠️  No signing identity (unsigned builds)', colors.yellow);
    }
    return true;
  }
  
  if (os === 'linux' && config.bundle.linux) {
    log('✅ Linux config present', colors.green);
    if (config.bundle.linux.deb) {
      log('✅ DEB package config present', colors.green);
    }
    return true;
  }
  
  log('⚠️  Platform-specific config not found', colors.yellow);
  return false;
}

async function checkBuildPaths(config) {
  log('\nBuild Paths:', colors.cyan);
  
  const checks = [];
  
  // Check frontendDist
  if (config.build.frontendDist) {
    log(`✅ Frontend dist: ${config.build.frontendDist}`, colors.green);
    
    if (config.build.frontendDist.includes('pwa')) {
      log('   ✓ Points to PWA output', colors.green);
      checks.push(true);
    } else {
      log('   ⚠️  Does not point to PWA output (task 1.3)', colors.yellow);
      checks.push(false);
    }
  } else {
    log('❌ Frontend dist not configured', colors.red);
    checks.push(false);
  }
  
  // Check beforeBuildCommand
  if (config.build.beforeBuildCommand) {
    log(`✅ Before build: ${config.build.beforeBuildCommand}`, colors.green);
    checks.push(true);
  } else {
    log('⚠️  No before build command', colors.yellow);
    log('   PWA may not be built automatically', colors.yellow);
    checks.push(false);
  }
  
  return checks.every(r => r);
}

async function checkPlugins(config) {
  log('\nPlugins:', colors.cyan);
  
  if (!config.plugins) {
    log('⚠️  No plugins configured', colors.yellow);
    return false;
  }
  
  Object.entries(config.plugins).forEach(([name, pluginConfig]) => {
    if (pluginConfig.active) {
      log(`✅ ${name}: active`, colors.green);
    } else {
      log(`⚠️  ${name}: inactive`, colors.yellow);
    }
  });
  
  return true;
}

async function main() {
  log('\n🔍 Production Build Configuration Validation', colors.cyan);
  log('='.repeat(60) + '\n');
  
  // Load config
  let config;
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    config = JSON.parse(await readFile(configPath, 'utf-8'));
    log('✅ Tauri config loaded', colors.green);
    log(`   Product: ${config.productName} v${config.version}`, colors.green);
  } catch (error) {
    log(`❌ Failed to load config: ${error.message}`, colors.red);
    return 1;
  }
  
  // Run checks
  log('\nIcons:', colors.cyan);
  const iconsOk = await checkIcons();
  
  const bundleOk = await checkBundleConfig(config);
  const platformOk = await checkPlatformConfig(config);
  const pathsOk = await checkBuildPaths(config);
  await checkPlugins(config);
  
  // Summary
  log('\n' + '='.repeat(60));
  log('Summary:', colors.cyan);
  
  const allChecks = [iconsOk, bundleOk, platformOk];
  const criticalPassed = allChecks.every(r => r);
  
  if (criticalPassed && pathsOk) {
    log('✅ All checks passed - ready for production builds', colors.green);
    log('\nTo build:', colors.cyan);
    log('  pnpm build', colors.green);
    return 0;
  } else if (criticalPassed) {
    log('⚠️  Critical checks passed, but PWA integration incomplete', colors.yellow);
    log('\nCurrent status:', colors.cyan);
    log('  - Can build with remote PWA URL', colors.yellow);
    log('  - Complete task 1.3 for local PWA builds', colors.yellow);
    log('\nTo build anyway:', colors.cyan);
    log('  pnpm build', colors.green);
    return 0;
  } else {
    log('❌ Some critical checks failed', colors.red);
    log('Review the output above and fix issues before building', colors.yellow);
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
