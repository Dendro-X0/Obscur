#!/usr/bin/env node

/**
 * GitHub Actions workflow validation script
 * Tests: 7.3 - Validate GitHub Actions workflow
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

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

async function loadWorkflow() {
  try {
    const workflowPath = join(process.cwd(), '..', '..', '.github', 'workflows', 'tauri-build.yml');
    const content = await readFile(workflowPath, 'utf-8');
    logSuccess('Workflow file loaded successfully');
    return content;
  } catch (error) {
    logError(`Failed to load workflow: ${error.message}`);
    return null;
  }
}

function checkTriggers(workflow) {
  logSection('1. Checking Workflow Triggers');
  
  const checks = [];
  
  // Check for tag trigger
  if (workflow.includes('tags:') && workflow.includes('"v*"')) {
    logSuccess('Tag trigger configured (v* pattern)');
    checks.push(true);
  } else {
    logError('Tag trigger not found or incorrect pattern');
    checks.push(false);
  }
  
  // Check for workflow_dispatch
  if (workflow.includes('workflow_dispatch')) {
    logSuccess('Manual workflow dispatch enabled');
    checks.push(true);
  } else {
    logWarning('Manual workflow dispatch not enabled');
    checks.push(false);
  }
  
  // Check for push trigger (optional)
  if (workflow.includes('push:') && !workflow.includes('tags:')) {
    logInfo('Push trigger found (may trigger on all pushes)');
  }
  
  return checks.every(r => r);
}

function checkPlatformMatrix(workflow) {
  logSection('2. Checking Platform Matrix');
  
  const platforms = [
    { name: 'Windows', pattern: 'windows-latest' },
    { name: 'macOS', pattern: 'macos-latest' },
    { name: 'Linux', pattern: 'ubuntu' },
  ];
  
  const checks = [];
  
  for (const platform of platforms) {
    if (workflow.includes(platform.pattern)) {
      logSuccess(`${platform.name} build configured`);
      checks.push(true);
    } else {
      logError(`${platform.name} build not found`);
      checks.push(false);
    }
  }
  
  // Check for fail-fast
  if (workflow.includes('fail-fast: false')) {
    logSuccess('Fail-fast disabled (all platforms will build)');
  } else {
    logWarning('Fail-fast not disabled (one failure stops all builds)');
  }
  
  return checks.every(r => r);
}

function checkDependencies(workflow) {
  logSection('3. Checking Dependency Installation');
  
  const checks = [];
  
  // Check for pnpm
  if (workflow.includes('pnpm/action-setup') || workflow.includes('Install pnpm')) {
    logSuccess('pnpm installation configured');
    checks.push(true);
  } else {
    logError('pnpm installation not found');
    checks.push(false);
  }
  
  // Check for Node.js
  if (workflow.includes('setup-node') || workflow.includes('Setup Node')) {
    logSuccess('Node.js setup configured');
    checks.push(true);
  } else {
    logError('Node.js setup not found');
    checks.push(false);
  }
  
  // Check for Rust
  if (workflow.includes('rust-toolchain') || workflow.includes('Install Rust')) {
    logSuccess('Rust installation configured');
    checks.push(true);
  } else {
    logError('Rust installation not found');
    checks.push(false);
  }
  
  // Check for Rust cache
  if (workflow.includes('rust-cache') || workflow.includes('Rust cache')) {
    logSuccess('Rust cache configured');
  } else {
    logWarning('Rust cache not configured (slower builds)');
  }
  
  // Check for Linux dependencies
  if (workflow.includes('apt-get') && workflow.includes('libwebkit2gtk')) {
    logSuccess('Linux system dependencies configured');
  } else {
    logWarning('Linux system dependencies may be missing');
  }
  
  return checks.every(r => r);
}

function checkTauriAction(workflow) {
  logSection('4. Checking Tauri Action Configuration');
  
  const checks = [];
  
  // Check for tauri-action
  if (workflow.includes('tauri-apps/tauri-action')) {
    logSuccess('Tauri action configured');
    checks.push(true);
  } else {
    logError('Tauri action not found');
    checks.push(false);
  }
  
  // Check for project path
  if (workflow.includes('projectPath') && workflow.includes('apps/desktop')) {
    logSuccess('Project path configured correctly');
    checks.push(true);
  } else {
    logError('Project path not configured or incorrect');
    checks.push(false);
  }
  
  // Check for release configuration
  if (workflow.includes('tagName') || workflow.includes('releaseName')) {
    logSuccess('Release configuration found');
    checks.push(true);
  } else {
    logWarning('Release configuration may be missing');
    checks.push(false);
  }
  
  return checks.every(r => r);
}

function checkCodeSigning(workflow) {
  logSection('5. Checking Code Signing Configuration');
  
  // Check for Windows signing
  if (workflow.includes('TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT')) {
    logSuccess('Windows code signing secret referenced');
  } else {
    logWarning('Windows code signing not configured');
  }
  
  // Check for macOS signing
  if (workflow.includes('APPLE_SIGNING_IDENTITY') || workflow.includes('APPLE_CERTIFICATE')) {
    logSuccess('macOS code signing secrets referenced');
  } else {
    logWarning('macOS code signing not configured');
  }
  
  // Check for notarization
  if (workflow.includes('APPLE_ID') && workflow.includes('APPLE_PASSWORD')) {
    logSuccess('macOS notarization secrets referenced');
  } else {
    logWarning('macOS notarization not configured');
  }
  
  // Check for signing status display
  if (workflow.includes('Check signing configuration') || workflow.includes('signing status')) {
    logSuccess('Signing status check included');
  } else {
    logInfo('No signing status check (optional)');
  }
  
  logInfo('Note: Unsigned builds are valid for development/testing');
  return true;
}

function checkPermissions(workflow) {
  logSection('6. Checking Workflow Permissions');
  
  const checks = [];
  
  // Check for contents write permission
  if (workflow.includes('contents: write')) {
    logSuccess('Contents write permission granted (required for releases)');
    checks.push(true);
  } else {
    logError('Contents write permission not found');
    logInfo('Workflow cannot create releases without this permission');
    checks.push(false);
  }
  
  return checks.every(r => r);
}

function checkArtifacts(workflow) {
  logSection('7. Checking Artifact Handling');
  
  // Check for artifact upload
  if (workflow.includes('upload-artifact')) {
    logSuccess('Artifact upload configured (backup)');
  } else {
    logWarning('No artifact upload (only releases will have builds)');
  }
  
  // Check for release creation
  if (workflow.includes('tauri-action')) {
    logSuccess('Tauri action handles release creation');
  }
  
  return true;
}

function checkBuildSteps(workflow) {
  logSection('8. Checking Build Steps');
  
  const checks = [];
  
  // Check for workspace install
  if (workflow.includes('pnpm install')) {
    logSuccess('Workspace dependencies installation found');
    checks.push(true);
  } else {
    logWarning('Workspace dependencies installation may be missing');
    checks.push(false);
  }
  
  // Check for desktop install
  if (workflow.includes('apps/desktop install') || workflow.includes('-C apps/desktop')) {
    logSuccess('Desktop app dependencies installation found');
    checks.push(true);
  } else {
    logWarning('Desktop app dependencies installation may be missing');
    checks.push(false);
  }
  
  return checks.every(r => r);
}

function generateRecommendations(results) {
  logSection('9. Recommendations');
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    logSuccess('Workflow is well-configured!');
    console.log('');
    logInfo('The workflow is ready to:');
    logInfo('  ✓ Build for all platforms (Windows, macOS, Linux)');
    logInfo('  ✓ Create GitHub releases automatically');
    logInfo('  ✓ Upload build artifacts');
    logInfo('  ✓ Handle code signing (when secrets are configured)');
  } else {
    logWarning('Some checks failed - review recommendations below');
  }
  
  console.log('');
  logInfo('To test the workflow:');
  logInfo('  1. Create a test tag: git tag v0.0.1-test');
  logInfo('  2. Push the tag: git push origin v0.0.1-test');
  logInfo('  3. Monitor workflow in GitHub Actions tab');
  logInfo('  4. Check release page for artifacts');
  
  console.log('');
  logInfo('For manual testing:');
  logInfo('  1. Go to Actions tab in GitHub');
  logInfo('  2. Select "Tauri Desktop Build & Release" workflow');
  logInfo('  3. Click "Run workflow" button');
  logInfo('  4. Monitor build progress');
  
  console.log('');
  logWarning('Important notes:');
  logWarning('  - First build may take 15-30 minutes');
  logWarning('  - Unsigned builds will show security warnings');
  logWarning('  - Configure secrets for signed builds (task 3)');
  logWarning('  - Complete task 1.3 for local PWA builds');
}

async function main() {
  log('\n🔍 GitHub Actions Workflow Validation', colors.cyan);
  log('Testing Requirements: 7.1, 7.2, 7.3, 7.4\n', colors.blue);
  
  const workflow = await loadWorkflow();
  
  if (!workflow) {
    logError('Cannot proceed without workflow file');
    return 1;
  }
  
  const results = {
    triggers: checkTriggers(workflow),
    platforms: checkPlatformMatrix(workflow),
    dependencies: checkDependencies(workflow),
    tauriAction: checkTauriAction(workflow),
    codeSigning: checkCodeSigning(workflow),
    permissions: checkPermissions(workflow),
    artifacts: checkArtifacts(workflow),
    buildSteps: checkBuildSteps(workflow),
  };
  
  generateRecommendations(results);
  
  // Summary
  logSection('Summary');
  
  const criticalChecks = [
    results.triggers,
    results.platforms,
    results.dependencies,
    results.tauriAction,
    results.permissions,
  ];
  
  const allCriticalPassed = criticalChecks.every(r => r);
  
  if (allCriticalPassed) {
    logSuccess('All critical checks passed! ✨');
    logInfo('Workflow is ready for production use');
    return 0;
  } else {
    logError('Some critical checks failed');
    logInfo('Review the output above and fix issues');
    return 1;
  }
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    logError(`Validation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
