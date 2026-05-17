#!/usr/bin/env node

/**
 * Production build test script
 * Tests: 7.2 - Test production builds locally
 * Requirements: 1.1, 1.2, 1.3, 6.1
 */

import { spawn } from 'child_process';
import { readdir, stat, readFile } from 'fs/promises';
import { join, extname } from 'path';
import { platform } from 'os';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, colors.cyan);
  console.log('='.repeat(70) + '\n');
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

async function checkPrerequisites() {
  logSection('1. Checking Prerequisites');
  
  const results = [];
  
  // Check if task 1.3 is complete
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    if (config.build.frontendDist && config.build.frontendDist.includes('pwa')) {
      logSuccess('PWA build output configured');
      results.push(true);
    } else {
      logWarning('PWA build output not configured (task 1.3 incomplete)');
      logInfo('Current frontendDist: ' + config.build.frontendDist);
      logInfo('Production builds may use remote URL or incorrect path');
      results.push(false);
    }
    
    if (config.build.beforeBuildCommand) {
      logSuccess('Before build command configured: ' + config.build.beforeBuildCommand);
      results.push(true);
    } else {
      logWarning('No beforeBuildCommand configured');
      logInfo('PWA may not be built automatically');
      results.push(false);
    }
  } catch (error) {
    logError('Failed to check Tauri config: ' + error.message);
    results.push(false);
  }
  
  return results.every(r => r);
}

async function getPlatformInfo() {
  const os = platform();
  const expectedFormats = {
    win32: ['msi', 'nsis', 'exe'],
    darwin: ['dmg', 'app'],
    linux: ['AppImage', 'deb'],
  };
  
  return {
    os,
    name: os === 'win32' ? 'Windows' : os === 'darwin' ? 'macOS' : 'Linux',
    formats: expectedFormats[os] || [],
  };
}

async function runBuild() {
  logSection('2. Running Production Build');
  
  logInfo('Starting Tauri production build...');
  logInfo('This may take several minutes...');
  
  return new Promise((resolve) => {
    const proc = spawn('pnpm', ['build'], {
      shell: true,
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    
    let hasError = false;
    let buildOutput = '';
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      buildOutput += text;
      
      // Show important messages
      if (text.includes('Finished') || text.includes('Built')) {
        logSuccess(text.trim());
      } else if (text.includes('Building')) {
        logInfo(text.trim());
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
      if (code === 0 && !hasError) {
        logSuccess('Build completed successfully!');
        resolve({ success: true, output: buildOutput });
      } else {
        logError(`Build failed with exit code ${code}`);
        resolve({ success: false, output: buildOutput });
      }
    });
    
    proc.on('error', (error) => {
      logError('Failed to start build: ' + error.message);
      resolve({ success: false, output: buildOutput });
    });
  });
}

async function findBuildArtifacts() {
  logSection('3. Locating Build Artifacts');
  
  const bundlePath = join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle');
  
  try {
    await stat(bundlePath);
    logSuccess('Bundle directory found: ' + bundlePath);
  } catch (error) {
    logError('Bundle directory not found: ' + bundlePath);
    return [];
  }
  
  const artifacts = [];
  
  async function scanDirectory(dir, depth = 0) {
    if (depth > 3) return; // Limit recursion depth
    
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
  
  return artifacts;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function analyzeArtifacts(artifacts, platformInfo) {
  logSection('4. Analyzing Build Artifacts');
  
  if (artifacts.length === 0) {
    logError('No build artifacts found!');
    return false;
  }
  
  logSuccess(`Found ${artifacts.length} artifact(s):`);
  
  let totalSize = 0;
  const foundFormats = new Set();
  
  for (const artifact of artifacts) {
    totalSize += artifact.size;
    foundFormats.add(artifact.type.replace('.', ''));
    
    logInfo(`  📦 ${artifact.name}`);
    logInfo(`     Size: ${formatBytes(artifact.size)}`);
    logInfo(`     Path: ${artifact.path}`);
    console.log('');
  }
  
  logInfo(`Total size: ${formatBytes(totalSize)}`);
  
  // Check if expected formats are present
  console.log('');
  logInfo('Expected formats for ' + platformInfo.name + ':');
  for (const format of platformInfo.formats) {
    if (foundFormats.has(format) || foundFormats.has(format.toLowerCase())) {
      logSuccess(`  ✓ ${format}`);
    } else {
      logWarning(`  ✗ ${format} (not found)`);
    }
  }
  
  return artifacts.length > 0;
}

async function validateArtifacts(artifacts) {
  logSection('5. Validating Artifacts');
  
  for (const artifact of artifacts) {
    logInfo(`Checking ${artifact.name}...`);
    
    // Basic validation: file exists and has size
    if (artifact.size > 0) {
      logSuccess(`  ✓ File is valid (${formatBytes(artifact.size)})`);
    } else {
      logError(`  ✗ File is empty or corrupted`);
    }
    
    // Check if file is readable
    try {
      await stat(artifact.path);
      logSuccess(`  ✓ File is accessible`);
    } catch (error) {
      logError(`  ✗ File is not accessible: ${error.message}`);
    }
  }
  
  return true;
}

async function generateReport(buildResult, artifacts, platformInfo) {
  logSection('6. Test Summary');
  
  if (!buildResult.success) {
    logError('Build failed - cannot proceed with artifact testing');
    return false;
  }
  
  if (artifacts.length === 0) {
    logError('No artifacts generated - build may have failed silently');
    return false;
  }
  
  logSuccess('Production build test completed!');
  console.log('');
  
  logInfo('Summary:');
  logInfo(`  Platform: ${platformInfo.name}`);
  logInfo(`  Artifacts: ${artifacts.length}`);
  logInfo(`  Total size: ${formatBytes(artifacts.reduce((sum, a) => sum + a.size, 0))}`);
  
  console.log('');
  logInfo('Next steps:');
  logInfo('  1. Test installation on a clean system');
  logInfo('  2. Verify desktop shortcuts are created');
  logInfo('  3. Test application launch and functionality');
  logInfo('  4. Validate file associations (if configured)');
  logInfo('  5. Test uninstallation process');
  
  console.log('');
  logWarning('Important notes:');
  logWarning('  - These are unsigned builds (development only)');
  logWarning('  - Users may see security warnings during installation');
  logWarning('  - Code signing requires task 3 completion');
  
  return true;
}

async function main() {
  log('\n🏗️  Production Build Test Suite', colors.cyan);
  log('Testing Requirements: 1.1, 1.2, 1.3, 6.1\n', colors.blue);
  
  const platformInfo = await getPlatformInfo();
  logInfo(`Running on: ${platformInfo.name}`);
  
  // Check prerequisites
  const prereqsPassed = await checkPrerequisites();
  if (!prereqsPassed) {
    logWarning('\nPrerequisites check failed - build may not work correctly');
    logInfo('Consider completing task 1.3 first for proper PWA integration');
    console.log('');
    
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    const answer = await new Promise((resolve) => {
      rl.question('Continue anyway? (y/n): ', resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      logInfo('Test cancelled by user');
      return 1;
    }
  }
  
  // Run build
  const buildResult = await runBuild();
  
  if (!buildResult.success) {
    logError('Build failed - see output above for details');
    return 1;
  }
  
  // Find and analyze artifacts
  const artifacts = await findBuildArtifacts();
  await analyzeArtifacts(artifacts, platformInfo);
  await validateArtifacts(artifacts);
  
  // Generate report
  const success = await generateReport(buildResult, artifacts, platformInfo);
  
  return success ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    logError('Test suite failed: ' + error.message);
    console.error(error);
    process.exit(1);
  });
