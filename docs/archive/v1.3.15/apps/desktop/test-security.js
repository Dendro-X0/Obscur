#!/usr/bin/env node

/**
 * Security validation test script
 * Tests: 9.3 - Security validation
 * Requirements: 2.1, 2.2, 2.3, 4.5
 * 
 * This script validates:
 * - Code signing configuration
 * - Update signature verification
 * - Security permissions and CSP
 * - Certificate validity
 */

import { readFile, access } from 'fs/promises';
import { join } from 'path';
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

// Test 1: Code Signing Configuration
async function validateCodeSigning() {
  logSection('Test 1: Code Signing Configuration');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const os = platform();
    const results = {
      configured: false,
      platform: os,
      details: {},
    };
    
    // Windows code signing
    if (os === 'win32') {
      logInfo('Checking Windows code signing...');
      
      if (config.bundle?.windows) {
        const winConfig = config.bundle.windows;
        
        if (winConfig.certificateThumbprint) {
          logSuccess('Certificate thumbprint configured');
          logInfo(`  Thumbprint: ${winConfig.certificateThumbprint}`);
          results.configured = true;
          results.details.thumbprint = winConfig.certificateThumbprint;
        } else {
          logWarning('Certificate thumbprint not configured');
          logInfo('  Builds will be unsigned (development only)');
          results.details.thumbprint = null;
        }
        
        if (winConfig.timestampUrl) {
          logSuccess('Timestamp URL configured');
          logInfo(`  URL: ${winConfig.timestampUrl}`);
          results.details.timestampUrl = winConfig.timestampUrl;
        } else {
          logError('Timestamp URL not configured');
          results.details.timestampUrl = null;
        }
        
        if (winConfig.digestAlgorithm) {
          logSuccess(`Digest algorithm: ${winConfig.digestAlgorithm}`);
          if (winConfig.digestAlgorithm === 'sha256') {
            logSuccess('  ✓ Using SHA-256 (recommended)');
          } else if (winConfig.digestAlgorithm === 'sha1') {
            logWarning('  ⚠ Using SHA-1 (deprecated, use SHA-256)');
          }
          results.details.digestAlgorithm = winConfig.digestAlgorithm;
        }
      } else {
        logError('Windows bundle configuration not found');
      }
    }
    
    // macOS code signing
    else if (os === 'darwin') {
      logInfo('Checking macOS code signing...');
      
      if (config.bundle?.macOS) {
        const macConfig = config.bundle.macOS;
        
        if (macConfig.signingIdentity) {
          logSuccess('Signing identity configured');
          logInfo(`  Identity: ${macConfig.signingIdentity}`);
          results.configured = true;
          results.details.signingIdentity = macConfig.signingIdentity;
        } else {
          logWarning('Signing identity not configured');
          logInfo('  Builds will be unsigned (development only)');
          results.details.signingIdentity = null;
        }
        
        if (macConfig.providerShortName) {
          logSuccess('Provider short name configured');
          results.details.providerShortName = macConfig.providerShortName;
        } else {
          logWarning('Provider short name not configured');
          logInfo('  Required for notarization');
        }
        
        if (macConfig.entitlements) {
          logSuccess('Entitlements file configured');
          results.details.entitlements = macConfig.entitlements;
        } else {
          logInfo('No custom entitlements (using defaults)');
        }
      } else {
        logError('macOS bundle configuration not found');
      }
    }
    
    // Linux (no code signing required)
    else {
      logInfo('Linux platform detected');
      logSuccess('Code signing not required for Linux');
      results.configured = true;
    }
    
    return results;
  } catch (error) {
    logError(`Failed to validate code signing: ${error.message}`);
    return { configured: false, error: error.message };
  }
}

// Test 2: Update Signature Verification
async function validateUpdateSigning() {
  logSection('Test 2: Update Signature Verification');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const results = {
      configured: false,
      active: false,
      hasKeys: false,
    };
    
    if (!config.plugins?.updater) {
      logError('Updater plugin not configured');
      return results;
    }
    
    const updater = config.plugins.updater;
    
    // Check if updater is active
    if (updater.active) {
      logSuccess('Updater plugin is active');
      results.active = true;
    } else {
      logWarning('Updater plugin is inactive');
      return results;
    }
    
    // Check for public key
    if (updater.pubkey) {
      logSuccess('Public key configured for signature verification');
      logInfo('  Key length: ' + updater.pubkey.length + ' characters');
      
      // Validate key format
      if (updater.pubkey.startsWith('dW50cnVzdGVkIGNvbW1lbnQ6')) {
        logSuccess('  ✓ Valid minisign public key format');
      } else {
        logWarning('  ⚠ Unexpected key format');
      }
      
      results.configured = true;
    } else {
      logError('Public key not configured');
      logWarning('  Updates will not be verified (SECURITY RISK)');
      return results;
    }
    
    // Check for signing key files
    try {
      await access(join(process.cwd(), 'src-tauri', 'updater-key.txt'));
      await access(join(process.cwd(), 'src-tauri', 'updater-key.txt.pub'));
      logSuccess('Updater signing key files found');
      logInfo('  Private key: updater-key.txt');
      logInfo('  Public key: updater-key.txt.pub');
      results.hasKeys = true;
      
      // Read and validate public key file
      const pubKeyFile = await readFile(
        join(process.cwd(), 'src-tauri', 'updater-key.txt.pub'),
        'utf-8'
      );
      
      if (pubKeyFile.includes(updater.pubkey)) {
        logSuccess('  ✓ Public key matches configuration');
      } else {
        logWarning('  ⚠ Public key mismatch with configuration');
      }
    } catch {
      logWarning('Updater signing key files not found');
      logInfo('  Generate keys with: pnpm tauri signer generate');
      logInfo('  Keys are needed to sign update packages');
    }
    
    // Check endpoints
    if (updater.endpoints && updater.endpoints.length > 0) {
      logSuccess(`Update endpoints configured: ${updater.endpoints.length}`);
      updater.endpoints.forEach(endpoint => {
        logInfo(`  - ${endpoint}`);
        
        // Validate endpoint format
        if (endpoint.includes('github.com') && endpoint.includes('latest.json')) {
          logSuccess('    ✓ Valid GitHub releases endpoint');
        } else if (endpoint.startsWith('https://')) {
          logSuccess('    ✓ HTTPS endpoint');
        } else {
          logWarning('    ⚠ Non-HTTPS endpoint (security risk)');
        }
      });
    } else {
      logError('No update endpoints configured');
    }
    
    return results;
  } catch (error) {
    logError(`Failed to validate update signing: ${error.message}`);
    return { configured: false, error: error.message };
  }
}

// Test 3: Content Security Policy
async function validateCSP() {
  logSection('Test 3: Content Security Policy (CSP)');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const results = {
      configured: false,
      directives: [],
      issues: [],
    };
    
    if (!config.app?.security?.csp) {
      logError('CSP not configured');
      logWarning('  Application is vulnerable to XSS and injection attacks');
      results.issues.push('No CSP configured');
      return results;
    }
    
    const csp = config.app.security.csp;
    
    if (csp === null) {
      logWarning('CSP set to null (using Tauri defaults)');
      logInfo('  Consider configuring a strict CSP');
      return results;
    }
    
    logSuccess('CSP configured');
    logInfo(`  Policy: ${csp.substring(0, 100)}...`);
    results.configured = true;
    
    // Parse and validate CSP directives
    const directives = csp.split(';').map(d => d.trim()).filter(d => d);
    
    logInfo('\nCSP Directives:');
    
    // Check for important directives
    const importantDirectives = {
      'default-src': 'Default source policy',
      'script-src': 'Script source policy',
      'style-src': 'Style source policy',
      'connect-src': 'Connection source policy',
      'img-src': 'Image source policy',
    };
    
    for (const [directive, description] of Object.entries(importantDirectives)) {
      const found = directives.find(d => d.startsWith(directive));
      if (found) {
        logSuccess(`  ✓ ${directive}: ${found.substring(directive.length).trim()}`);
        results.directives.push(found);
        
        // Check for unsafe directives
        if (found.includes("'unsafe-inline'")) {
          logWarning(`    ⚠ Uses 'unsafe-inline' (reduces security)`);
          results.issues.push(`${directive} uses unsafe-inline`);
        }
        if (found.includes("'unsafe-eval'")) {
          logWarning(`    ⚠ Uses 'unsafe-eval' (reduces security)`);
          results.issues.push(`${directive} uses unsafe-eval`);
        }
      } else {
        logWarning(`  ✗ ${directive} not configured`);
        results.issues.push(`Missing ${directive} directive`);
      }
    }
    
    // Check for HTTPS enforcement
    const connectSrc = directives.find(d => d.startsWith('connect-src'));
    if (connectSrc) {
      if (connectSrc.includes('https:') || connectSrc.includes('wss:')) {
        logSuccess('  ✓ HTTPS/WSS connections allowed');
      }
      if (connectSrc.includes('http:') && !connectSrc.includes('https:')) {
        logWarning('  ⚠ Only HTTP allowed (should use HTTPS)');
        results.issues.push('HTTP connections allowed without HTTPS');
      }
    }
    
    return results;
  } catch (error) {
    logError(`Failed to validate CSP: ${error.message}`);
    return { configured: false, error: error.message };
  }
}

// Test 4: Security Permissions
async function validatePermissions() {
  logSection('Test 4: Security Permissions');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const results = {
      plugins: [],
      risks: [],
    };
    
    // Check enabled plugins
    if (config.plugins) {
      logInfo('Enabled plugins:');
      
      for (const [name, pluginConfig] of Object.entries(config.plugins)) {
        if (pluginConfig.active) {
          logInfo(`  - ${name}`);
          results.plugins.push(name);
          
          // Check for potentially risky plugins
          if (name.includes('shell') || name.includes('fs')) {
            logWarning(`    ⚠ ${name} provides system access`);
            results.risks.push(`${name} plugin enabled`);
          }
        }
      }
      
      if (results.plugins.length === 0) {
        logInfo('  No plugins enabled');
      }
    }
    
    // Check window security settings
    if (config.app?.windows) {
      logInfo('\nWindow security settings:');
      
      const window = config.app.windows[0];
      
      if (window.fileDropEnabled === false) {
        logSuccess('  ✓ File drop disabled');
      } else if (window.fileDropEnabled === true) {
        logWarning('  ⚠ File drop enabled (potential security risk)');
        results.risks.push('File drop enabled');
      } else {
        logInfo('  File drop: default');
      }
      
      if (window.transparent) {
        logInfo('  Window transparency: enabled');
      }
    }
    
    // Check for dangerous configurations
    logInfo('\nSecurity checks:');
    
    if (config.build?.devUrl && !config.build.devUrl.startsWith('https://')) {
      logWarning('  ⚠ Dev URL uses HTTP (development only)');
    }
    
    if (config.app?.windows?.[0]?.url && !config.app.windows[0].url.startsWith('https://')) {
      logWarning('  ⚠ Window URL uses HTTP');
      results.risks.push('Non-HTTPS window URL');
    }
    
    if (results.risks.length === 0) {
      logSuccess('  ✓ No major security risks identified');
    }
    
    return results;
  } catch (error) {
    logError(`Failed to validate permissions: ${error.message}`);
    return { error: error.message };
  }
}

// Test 5: GitHub Secrets Configuration
async function validateGitHubSecrets() {
  logSection('Test 5: GitHub Secrets Configuration');
  
  logInfo('Checking GitHub Actions workflow for secret references...');
  
  try {
    const workflowPath = join(process.cwd(), '..', '..', '.github', 'workflows', 'tauri-build.yml');
    const workflow = await readFile(workflowPath, 'utf-8');
    
    const requiredSecrets = {
      'TAURI_SIGNING_PRIVATE_KEY': 'Update signing private key',
      'TAURI_SIGNING_PRIVATE_KEY_PASSWORD': 'Update signing key password',
    };
    
    const platformSecrets = {
      windows: [
        'TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT',
        'WINDOWS_CERTIFICATE',
        'WINDOWS_CERTIFICATE_PASSWORD',
      ],
      macos: [
        'APPLE_CERTIFICATE',
        'APPLE_CERTIFICATE_PASSWORD',
        'APPLE_SIGNING_IDENTITY',
        'APPLE_ID',
        'APPLE_PASSWORD',
        'APPLE_TEAM_ID',
      ],
    };
    
    logInfo('\nRequired secrets:');
    for (const [secret, description] of Object.entries(requiredSecrets)) {
      if (workflow.includes(secret)) {
        logSuccess(`  ✓ ${secret}`);
        logInfo(`    ${description}`);
      } else {
        logWarning(`  ✗ ${secret} not referenced`);
        logInfo(`    ${description}`);
      }
    }
    
    logInfo('\nPlatform-specific secrets:');
    
    logInfo('  Windows:');
    for (const secret of platformSecrets.windows) {
      if (workflow.includes(secret)) {
        logSuccess(`    ✓ ${secret}`);
      } else {
        logWarning(`    ✗ ${secret}`);
      }
    }
    
    logInfo('  macOS:');
    for (const secret of platformSecrets.macos) {
      if (workflow.includes(secret)) {
        logSuccess(`    ✓ ${secret}`);
      } else {
        logWarning(`    ✗ ${secret}`);
      }
    }
    
    logInfo('\nNote: Secrets must be configured in GitHub repository settings');
    logInfo('See CODE_SIGNING.md for detailed setup instructions');
    
    return { found: true };
  } catch (error) {
    logWarning('GitHub Actions workflow not found');
    return { found: false };
  }
}

// Generate security report
function generateSecurityReport(results) {
  logSection('Security Validation Report');
  
  const {
    codeSigning,
    updateSigning,
    csp,
    permissions,
    githubSecrets,
  } = results;
  
  // Code signing status
  log('Code Signing:', colors.magenta);
  if (codeSigning.configured) {
    logSuccess('  ✓ Configured for ' + codeSigning.platform);
  } else {
    logWarning('  ⚠ Not configured (unsigned builds)');
    logInfo('    Unsigned builds are acceptable for development');
    logInfo('    Production releases should be signed');
  }
  
  // Update signing status
  console.log('');
  log('Update Signing:', colors.magenta);
  if (updateSigning.configured && updateSigning.hasKeys) {
    logSuccess('  ✓ Fully configured with signing keys');
  } else if (updateSigning.configured) {
    logWarning('  ⚠ Configured but missing signing keys');
  } else {
    logError('  ✗ Not configured (SECURITY RISK)');
    logWarning('    Updates will not be verified');
  }
  
  // CSP status
  console.log('');
  log('Content Security Policy:', colors.magenta);
  if (csp.configured) {
    logSuccess('  ✓ Configured');
    if (csp.issues.length > 0) {
      logWarning(`  ⚠ ${csp.issues.length} issue(s) found:`);
      csp.issues.forEach(issue => logInfo(`    - ${issue}`));
    } else {
      logSuccess('  ✓ No issues found');
    }
  } else {
    logError('  ✗ Not configured (SECURITY RISK)');
  }
  
  // Permissions status
  console.log('');
  log('Security Permissions:', colors.magenta);
  if (permissions.risks && permissions.risks.length > 0) {
    logWarning(`  ⚠ ${permissions.risks.length} potential risk(s):`);
    permissions.risks.forEach(risk => logInfo(`    - ${risk}`));
  } else {
    logSuccess('  ✓ No major risks identified');
  }
  
  // Overall security score
  console.log('');
  log('Overall Security Score:', colors.magenta);
  
  let score = 0;
  let maxScore = 5;
  
  if (codeSigning.configured) score += 1;
  if (updateSigning.configured && updateSigning.hasKeys) score += 2;
  else if (updateSigning.configured) score += 1;
  if (csp.configured && csp.issues.length === 0) score += 1;
  else if (csp.configured) score += 0.5;
  if (!permissions.risks || permissions.risks.length === 0) score += 1;
  
  const percentage = (score / maxScore * 100).toFixed(0);
  
  if (percentage >= 80) {
    logSuccess(`  ${percentage}% - Excellent security configuration`);
  } else if (percentage >= 60) {
    logInfo(`  ${percentage}% - Good security with room for improvement`);
  } else if (percentage >= 40) {
    logWarning(`  ${percentage}% - Adequate for development, needs work for production`);
  } else {
    logError(`  ${percentage}% - Security needs significant improvement`);
  }
  
  // Recommendations
  console.log('');
  log('Security Recommendations:', colors.cyan);
  
  if (!codeSigning.configured && codeSigning.platform !== 'linux') {
    logInfo('  1. Configure code signing for production releases');
    logInfo('     - Obtain a code signing certificate');
    logInfo('     - Update tauri.conf.json with certificate details');
    logInfo('     - Add secrets to GitHub Actions');
  }
  
  if (!updateSigning.configured || !updateSigning.hasKeys) {
    logInfo('  2. Configure update signing');
    logInfo('     - Generate signing keys: pnpm tauri signer generate');
    logInfo('     - Add public key to tauri.conf.json');
    logInfo('     - Store private key securely for CI/CD');
  }
  
  if (!csp.configured) {
    logInfo('  3. Configure Content Security Policy');
    logInfo('     - Add CSP to tauri.conf.json');
    logInfo('     - Use strict directives to prevent XSS');
  } else if (csp.issues.length > 0) {
    logInfo('  3. Improve Content Security Policy');
    logInfo('     - Remove unsafe-inline and unsafe-eval if possible');
    logInfo('     - Use nonces or hashes for inline scripts');
  }
  
  if (permissions.risks && permissions.risks.length > 0) {
    logInfo('  4. Review security permissions');
    logInfo('     - Disable unnecessary plugins');
    logInfo('     - Use HTTPS for all external connections');
  }
  
  logInfo('  5. Test security on production builds');
  logInfo('  6. Keep dependencies up to date');
  logInfo('  7. Monitor security advisories');
}

async function main() {
  log('\n🔒 Security Validation Test Suite', colors.cyan);
  log('Testing Requirements: 2.1, 2.2, 2.3, 4.5\n', colors.blue);
  
  const results = {
    codeSigning: await validateCodeSigning(),
    updateSigning: await validateUpdateSigning(),
    csp: await validateCSP(),
    permissions: await validatePermissions(),
    githubSecrets: await validateGitHubSecrets(),
  };
  
  generateSecurityReport(results);
  
  // Determine exit code
  const criticalIssues = 
    (!results.updateSigning.configured) ||
    (!results.csp.configured);
  
  if (criticalIssues) {
    logSection('Action Required');
    logWarning('Critical security issues found');
    logInfo('Address the issues above before production release');
    return 1;
  } else {
    logSection('Security Status');
    logSuccess('Security configuration is acceptable');
    logInfo('Review recommendations for further improvements');
    return 0;
  }
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    logError(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
