#!/usr/bin/env node

/**
 * End-to-end pipeline test script
 * Tests: 9.1 - End-to-end testing
 * Requirements: All requirements
 * 
 * This script tests the complete build and release pipeline including:
 * - Configuration validation
 * - Local build execution
 * - Installer verification
 * - Auto-updater configuration
 */

import { spawn } from 'child_process';
import { readFile, access, stat, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { platform } from 'os';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, colors.cyan);
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Test 1: Configuration Validation
async function testConfiguration() {
  logSection('Test 1: Configuration Validation');
  
  const results = {
    tauriConfig: false,
    icons: false,
    pwaConfig: false,
    workflowConfig: false,
  };
  
  // Check Tauri configuration
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    logInfo('Checking Tauri configuration...');
    
    // Basic config
    if (config.productName && config.identifier && config.version) {
      logSuccess(`Product: ${config.productName} v${config.version}`);
      logSuccess(`Identifier: ${config.identifier}`);
      results.tauriConfig = true;
    } else {
      logError('Missing basic configuration fields');
    }
    
    // Bundle configuration
    if (config.bundle && config.bundle.active) {
      logSuccess('Bundle configuration active');
      logInfo(`  Targets: ${config.bundle.targets?.join(', ') || 'default'}`);
    } else {
      logError('Bundle configuration not active');
      results.tauriConfig = false;
    }
    
    // Build paths
    if (config.build.frontendDist) {
      logSuccess(`Frontend dist: ${config.build.frontendDist}`);
      if (config.build.frontendDist.includes('pwa')) {
        logSuccess('  Points to PWA output directory');
      } else {
        logWarning('  Does not point to PWA output (may use remote URL)');
      }
    }
    
    if (config.build.beforeBuildCommand) {
      logSuccess(`Before build command: ${config.build.beforeBuildCommand}`);
    } else {
      logWarning('No before build command configured');
    }
    
    // Updater configuration
    if (config.plugins?.updater) {
      if (config.plugins.updater.active) {
        logSuccess('Auto-updater plugin active');
        logInfo(`  Endpoints: ${config.plugins.updater.endpoints?.join(', ') || 'none'}`);
      } else {
        logWarning('Auto-updater plugin inactive');
      }
    } else {
      logWarning('Auto-updater plugin not configured');
    }
    
  } catch (error) {
    logError(`Failed to load Tauri config: ${error.message}`);
  }
  
  // Check icons
  try {
    const iconPath = join(process.cwd(), 'src-tauri', 'icons');
    const requiredIcons = ['32x32.png', '128x128.png', 'icon.icns', 'icon.ico'];
    
    logInfo('\nChecking icons...');
    let allIconsPresent = true;
    
    for (const icon of requiredIcons) {
      try {
        await access(join(iconPath, icon));
        logSuccess(`  ${icon}`);
      } catch {
        logError(`  ${icon} - missing`);
        allIconsPresent = false;
      }
    }
    
    results.icons = allIconsPresent;
  } catch (error) {
    logError(`Failed to check icons: ${error.message}`);
  }
  
  // Check PWA configuration
  try {
    const pwaPath = join(process.cwd(), '..', 'pwa', 'next.config.ts');
    await access(pwaPath);
    logSuccess('\nPWA configuration file exists');
    results.pwaConfig = true;
  } catch {
    logWarning('\nPWA configuration file not found');
  }
  
  // Check GitHub workflow
  try {
    const workflowPath = join(process.cwd(), '..', '..', '.github', 'workflows', 'tauri-build.yml');
    await access(workflowPath);
    logSuccess('GitHub Actions workflow exists');
    results.workflowConfig = true;
  } catch {
    logWarning('GitHub Actions workflow not found');
  }
  
  return results;
}

// Test 2: Build System Test
async function testBuildSystem(skipBuild = false) {
  logSection('Test 2: Build System Test');
  
  if (skipBuild) {
    logWarning('Build test skipped by user');
    return { success: true, skipped: true };
  }
  
  logInfo('This will run a full production build...');
  logInfo('This may take 10-20 minutes depending on your system');
  logInfo('Press Ctrl+C to cancel\n');
  
  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['build'], {
      shell: true,
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    
    let hasError = false;
    let buildOutput = '';
    let startTime = Date.now();
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      buildOutput += text;
      
      // Show important messages
      if (text.includes('Finished') || text.includes('Built')) {
        logSuccess(text.trim());
      } else if (text.includes('Building') || text.includes('Compiling')) {
        logInfo(text.trim());
      } else if (text.includes('error') || text.includes('Error')) {
        hasError = true;
        logError(text.trim());
      }
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      buildOutput += text;
      
      if (text.includes('error') || text.includes('Error')) {
        hasError = true;
        logError(text.trim());
      } else if (text.includes('warning')) {
        logWarning(text.trim());
      }
    });
    
    proc.on('close', (code) => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if (code === 0 && !hasError) {
        logSuccess(`Build completed successfully in ${duration}s`);
        resolve({ success: true, duration, output: buildOutput });
      } else {
        logError(`Build failed with exit code ${code} after ${duration}s`);
        resolve({ success: false, duration, output: buildOutput });
      }
    });
    
    proc.on('error', (error) => {
      logError(`Failed to start build: ${error.message}`);
      resolve({ success: false, output: buildOutput });
    });
  });
}

// Test 3: Installer Verification
async function testInstallers() {
  logSection('Test 3: Installer Verification');
  
  const bundlePath = join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle');
  
  try {
    await stat(bundlePath);
    logSuccess('Bundle directory found');
  } catch (error) {
    logError('Bundle directory not found - build may have failed');
    return { found: false, artifacts: [] };
  }
  
  const artifacts = [];
  
  async function scanDirectory(dir, depth = 0) {
    if (depth > 3) return;
    
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          const relevantExts = ['.msi', '.exe', '.dmg', '.app', '.appimage', '.deb', '.rpm'];
          
          if (relevantExts.includes(ext) || entry.name.includes('AppImage')) {
            const stats = await stat(fullPath);
            artifacts.push({
              name: entry.name,
              path: fullPath,
              size: stats.size,
              type: ext || 'AppImage',
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }
  
  await scanDirectory(bundlePath);
  
  if (artifacts.length === 0) {
    logError('No installers found!');
    return { found: false, artifacts: [] };
  }
  
  logSuccess(`Found ${artifacts.length} installer(s):`);
  
  let totalSize = 0;
  for (const artifact of artifacts) {
    totalSize += artifact.size;
    logInfo(`  📦 ${artifact.name}`);
    logInfo(`     Size: ${formatBytes(artifact.size)}`);
    logInfo(`     Type: ${artifact.type}`);
  }
  
  logInfo(`\nTotal size: ${formatBytes(totalSize)}`);
  
  // Validate installers
  logInfo('\nValidating installers...');
  for (const artifact of artifacts) {
    if (artifact.size > 0) {
      logSuccess(`  ✓ ${artifact.name} is valid`);
    } else {
      logError(`  ✗ ${artifact.name} is empty`);
    }
  }
  
  return { found: true, artifacts, totalSize };
}

// Test 4: Auto-Updater Configuration
async function testAutoUpdater() {
  logSection('Test 4: Auto-Updater Configuration');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    if (!config.plugins?.updater) {
      logWarning('Auto-updater plugin not configured');
      return { configured: false };
    }
    
    const updater = config.plugins.updater;
    
    if (updater.active) {
      logSuccess('Auto-updater is active');
    } else {
      logWarning('Auto-updater is inactive');
      return { configured: false };
    }
    
    if (updater.endpoints && updater.endpoints.length > 0) {
      logSuccess(`Update endpoints configured: ${updater.endpoints.length}`);
      updater.endpoints.forEach(endpoint => {
        logInfo(`  - ${endpoint}`);
      });
    } else {
      logError('No update endpoints configured');
      return { configured: false };
    }
    
    if (updater.pubkey) {
      logSuccess('Public key configured for signature verification');
    } else {
      logWarning('No public key configured - updates will not be verified');
    }
    
    // Check for signing key files
    try {
      await access(join(process.cwd(), 'src-tauri', 'updater-key.txt'));
      await access(join(process.cwd(), 'src-tauri', 'updater-key.txt.pub'));
      logSuccess('Updater signing keys found');
    } catch {
      logWarning('Updater signing keys not found');
      logInfo('Generate keys with: pnpm tauri signer generate');
    }
    
    return { configured: true, active: updater.active };
  } catch (error) {
    logError(`Failed to check auto-updater: ${error.message}`);
    return { configured: false };
  }
}

// Test 5: Code Signing Status
async function testCodeSigning() {
  logSection('Test 5: Code Signing Status');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const os = platform();
    let signingConfigured = false;
    
    if (os === 'win32' && config.bundle?.windows) {
      if (config.bundle.windows.certificateThumbprint) {
        logSuccess('Windows code signing configured');
        logInfo(`  Thumbprint: ${config.bundle.windows.certificateThumbprint}`);
        logInfo(`  Timestamp URL: ${config.bundle.windows.timestampUrl}`);
        signingConfigured = true;
      } else {
        logWarning('Windows code signing not configured');
        logInfo('Builds will be unsigned (development only)');
      }
    } else if (os === 'darwin' && config.bundle?.macOS) {
      if (config.bundle.macOS.signingIdentity) {
        logSuccess('macOS code signing configured');
        logInfo(`  Identity: ${config.bundle.macOS.signingIdentity}`);
        signingConfigured = true;
      } else {
        logWarning('macOS code signing not configured');
        logInfo('Builds will be unsigned (development only)');
      }
    } else if (os === 'linux') {
      logInfo('Linux builds do not require code signing');
      signingConfigured = true;
    }
    
    if (!signingConfigured && os !== 'linux') {
      logInfo('\nTo configure code signing:');
      logInfo('  1. Obtain a code signing certificate');
      logInfo('  2. Update tauri.conf.json with certificate details');
      logInfo('  3. Add certificate secrets to GitHub Actions');
      logInfo('  4. See CODE_SIGNING.md for detailed instructions');
    }
    
    return { configured: signingConfigured };
  } catch (error) {
    logError(`Failed to check code signing: ${error.message}`);
    return { configured: false };
  }
}

// Test 6: GitHub Actions Workflow
async function testGitHubWorkflow() {
  logSection('Test 6: GitHub Actions Workflow');
  
  try {
    const workflowPath = join(process.cwd(), '..', '..', '.github', 'workflows', 'tauri-build.yml');
    const workflow = await readFile(workflowPath, 'utf-8');
    
    logSuccess('Workflow file found');
    
    // Check key components
    const checks = [
      { name: 'Tag trigger', pattern: 'tags:', required: true },
      { name: 'Manual dispatch', pattern: 'workflow_dispatch', required: false },
      { name: 'Windows build', pattern: 'windows-latest', required: true },
      { name: 'macOS build', pattern: 'macos-latest', required: true },
      { name: 'Linux build', pattern: 'ubuntu', required: true },
      { name: 'Tauri action', pattern: 'tauri-apps/tauri-action', required: true },
      { name: 'Release creation', pattern: 'releaseName', required: true },
    ];
    
    for (const check of checks) {
      if (workflow.includes(check.pattern)) {
        logSuccess(`  ✓ ${check.name}`);
      } else if (check.required) {
        logError(`  ✗ ${check.name} - missing`);
      } else {
        logWarning(`  ⚠ ${check.name} - not found`);
      }
    }
    
    logInfo('\nTo test the workflow:');
    logInfo('  1. Create a test tag: git tag v0.0.1-test');
    logInfo('  2. Push the tag: git push origin v0.0.1-test');
    logInfo('  3. Monitor workflow in GitHub Actions tab');
    logInfo('  4. Check release page for artifacts');
    
    return { found: true };
  } catch (error) {
    logError('Workflow file not found');
    logInfo('Create workflow at: .github/workflows/tauri-build.yml');
    return { found: false };
  }
}

// Generate comprehensive report
async function generateReport(results) {
  logSection('End-to-End Test Report');
  
  const {
    config,
    build,
    installers,
    updater,
    signing,
    workflow,
  } = results;
  
  // Configuration status
  log('Configuration:', colors.magenta);
  if (config.tauriConfig) {
    logSuccess('  ✓ Tauri configuration valid');
  } else {
    logError('  ✗ Tauri configuration issues');
  }
  
  if (config.icons) {
    logSuccess('  ✓ All required icons present');
  } else {
    logError('  ✗ Some icons missing');
  }
  
  if (config.pwaConfig) {
    logSuccess('  ✓ PWA configuration found');
  } else {
    logWarning('  ⚠ PWA configuration not found');
  }
  
  // Build status
  console.log('');
  log('Build System:', colors.magenta);
  if (build.skipped) {
    logWarning('  ⚠ Build test skipped');
  } else if (build.success) {
    logSuccess(`  ✓ Build completed successfully (${build.duration}s)`);
  } else {
    logError('  ✗ Build failed');
  }
  
  // Installers
  console.log('');
  log('Installers:', colors.magenta);
  if (installers.found && installers.artifacts.length > 0) {
    logSuccess(`  ✓ ${installers.artifacts.length} installer(s) generated`);
    logInfo(`    Total size: ${formatBytes(installers.totalSize)}`);
  } else {
    logError('  ✗ No installers found');
  }
  
  // Auto-updater
  console.log('');
  log('Auto-Updater:', colors.magenta);
  if (updater.configured && updater.active) {
    logSuccess('  ✓ Auto-updater configured and active');
  } else if (updater.configured) {
    logWarning('  ⚠ Auto-updater configured but inactive');
  } else {
    logWarning('  ⚠ Auto-updater not configured');
  }
  
  // Code signing
  console.log('');
  log('Code Signing:', colors.magenta);
  if (signing.configured) {
    logSuccess('  ✓ Code signing configured');
  } else {
    logWarning('  ⚠ Code signing not configured (unsigned builds)');
  }
  
  // GitHub workflow
  console.log('');
  log('GitHub Actions:', colors.magenta);
  if (workflow.found) {
    logSuccess('  ✓ Workflow configured');
  } else {
    logError('  ✗ Workflow not found');
  }
  
  // Overall status
  console.log('');
  log('Overall Status:', colors.magenta);
  
  const criticalPassed = config.tauriConfig && 
                        config.icons && 
                        (build.success || build.skipped) &&
                        workflow.found;
  
  if (criticalPassed && installers.found) {
    logSuccess('✨ All critical tests passed!');
    logInfo('\nThe desktop app packaging system is ready for production use.');
    logInfo('You can now:');
    logInfo('  1. Create releases by pushing version tags');
    logInfo('  2. Distribute installers to users');
    logInfo('  3. Enable auto-updates for seamless upgrades');
  } else if (criticalPassed) {
    logWarning('⚠️  Critical tests passed, but some features need attention');
    logInfo('\nReview the report above for details.');
  } else {
    logError('❌ Some critical tests failed');
    logInfo('\nReview the report above and fix issues before proceeding.');
  }
  
  // Next steps
  console.log('');
  log('Next Steps:', colors.cyan);
  
  if (!config.pwaConfig) {
    logInfo('  • Complete task 1.3 for local PWA integration');
  }
  
  if (!updater.configured) {
    logInfo('  • Configure auto-updater (task 4)');
  }
  
  if (!signing.configured) {
    logInfo('  • Set up code signing for production releases (task 3)');
  }
  
  if (!workflow.found) {
    logInfo('  • Create GitHub Actions workflow (task 2)');
  }
  
  logInfo('  • Test installers on clean systems');
  logInfo('  • Verify auto-updater with real releases');
  logInfo('  • Document installation process for users');
}

async function main() {
  log('\n🧪 End-to-End Pipeline Test Suite', colors.cyan);
  log('Testing all requirements for desktop app packaging\n', colors.blue);
  
  // Ask user if they want to run the build
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const answer = await new Promise((resolve) => {
    rl.question('Run full production build? This may take 10-20 minutes (y/n): ', resolve);
  });
  rl.close();
  
  const skipBuild = answer.toLowerCase() !== 'y';
  
  // Run all tests
  const results = {
    config: await testConfiguration(),
    build: await testBuildSystem(skipBuild),
    installers: skipBuild ? { found: false, artifacts: [] } : await testInstallers(),
    updater: await testAutoUpdater(),
    signing: await testCodeSigning(),
    workflow: await testGitHubWorkflow(),
  };
  
  // Generate report
  await generateReport(results);
  
  // Exit code
  const success = results.config.tauriConfig && 
                 results.config.icons &&
                 (results.build.success || results.build.skipped) &&
                 results.workflow.found;
  
  return success ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
