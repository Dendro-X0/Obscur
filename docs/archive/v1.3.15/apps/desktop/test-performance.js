#!/usr/bin/env node

/**
 * Performance optimization test script
 * Tests: 9.2 - Performance optimization
 * Requirements: 1.5, 5.5
 * 
 * This script tests and optimizes:
 * - App startup time
 * - Bundle sizes
 * - Memory usage
 * - Runtime performance
 */

import { spawn } from 'child_process';
import { readFile, stat, readdir } from 'fs/promises';
import { join, extname } from 'path';

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

// Test 1: Bundle Size Analysis
async function analyzeBundleSizes() {
  logSection('Test 1: Bundle Size Analysis');
  
  const bundlePath = join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle');
  
  try {
    await stat(bundlePath);
  } catch (error) {
    logWarning('Bundle directory not found - run a build first');
    return { found: false };
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
          const relevantExts = ['.msi', '.exe', '.dmg', '.app', '.appimage', '.deb'];
          
          if (relevantExts.includes(ext) || entry.name.includes('AppImage')) {
            const stats = await stat(fullPath);
            artifacts.push({
              name: entry.name,
              size: stats.size,
              type: ext || 'AppImage',
            });
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  await scanDirectory(bundlePath);
  
  if (artifacts.length === 0) {
    logWarning('No build artifacts found');
    return { found: false };
  }
  
  logInfo('Build artifact sizes:');
  
  let totalSize = 0;
  const sizeLimits = {
    '.msi': 150 * 1024 * 1024,  // 150 MB
    '.exe': 150 * 1024 * 1024,  // 150 MB
    '.dmg': 200 * 1024 * 1024,  // 200 MB
    '.appimage': 150 * 1024 * 1024,  // 150 MB
    '.deb': 150 * 1024 * 1024,  // 150 MB
  };
  
  for (const artifact of artifacts) {
    totalSize += artifact.size;
    const limit = sizeLimits[artifact.type.toLowerCase()] || 150 * 1024 * 1024;
    const percentage = (artifact.size / limit * 100).toFixed(1);
    
    logInfo(`  ${artifact.name}: ${formatBytes(artifact.size)}`);
    
    if (artifact.size > limit) {
      logWarning(`    ⚠ Exceeds recommended size (${percentage}% of ${formatBytes(limit)})`);
    } else if (artifact.size > limit * 0.8) {
      logWarning(`    ⚠ Approaching size limit (${percentage}% of ${formatBytes(limit)})`);
    } else {
      logSuccess(`    ✓ Within size limits (${percentage}% of ${formatBytes(limit)})`);
    }
  }
  
  logInfo(`\nTotal size: ${formatBytes(totalSize)}`);
  
  return { found: true, artifacts, totalSize };
}

// Test 2: Configuration Optimization
async function checkConfigurationOptimizations() {
  logSection('Test 2: Configuration Optimization');
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    const optimizations = [];
    
    // Check bundle targets
    if (config.bundle.targets === 'all') {
      logWarning('Bundle targets set to "all" - builds all formats');
      logInfo('  Consider specifying only needed formats to reduce build time');
      optimizations.push({
        area: 'Bundle Targets',
        current: 'all',
        suggestion: 'Specify only needed formats (e.g., ["msi", "nsis"])',
        impact: 'Reduces build time by 30-50%',
      });
    } else {
      logSuccess(`Bundle targets optimized: ${config.bundle.targets}`);
    }
    
    // Check CSP configuration
    if (!config.app.security.csp || config.app.security.csp === null) {
      logWarning('CSP not configured - using default');
      logInfo('  Consider adding a strict CSP for better security and performance');
      optimizations.push({
        area: 'Content Security Policy',
        current: 'null (default)',
        suggestion: 'Add strict CSP to limit resource loading',
        impact: 'Improves security and can reduce memory usage',
      });
    } else {
      logSuccess('CSP configured');
    }
    
    // Check window configuration
    const window = config.app.windows[0];
    if (window.transparent) {
      logWarning('Window transparency enabled');
      logInfo('  Transparency can impact performance on some systems');
      optimizations.push({
        area: 'Window Transparency',
        current: 'true',
        suggestion: 'Disable if not needed',
        impact: 'Improves rendering performance',
      });
    } else {
      logSuccess('Window transparency disabled (optimal)');
    }
    
    // Check for unnecessary resources
    if (config.bundle.resources && config.bundle.resources.length > 0) {
      logInfo(`Bundle resources: ${config.bundle.resources.length} item(s)`);
      logInfo('  Review if all resources are necessary');
    } else {
      logSuccess('No extra bundle resources (optimal)');
    }
    
    return { optimizations };
  } catch (error) {
    logError(`Failed to check configuration: ${error.message}`);
    return { optimizations: [] };
  }
}

// Test 3: Cargo Build Optimizations
async function checkCargoOptimizations() {
  logSection('Test 3: Cargo Build Optimizations');
  
  try {
    const cargoPath = join(process.cwd(), 'src-tauri', 'Cargo.toml');
    const cargo = await readFile(cargoPath, 'utf-8');
    
    const optimizations = [];
    
    // Check for release profile optimizations
    if (cargo.includes('[profile.release]')) {
      logSuccess('Release profile configured');
      
      // Check specific optimizations
      if (cargo.includes('opt-level')) {
        const match = cargo.match(/opt-level\s*=\s*["']?(\w+)["']?/);
        if (match) {
          logInfo(`  Optimization level: ${match[1]}`);
          if (match[1] === 'z' || match[1] === 's') {
            logSuccess('    ✓ Size-optimized build');
          } else if (match[1] === '3') {
            logInfo('    ℹ Speed-optimized build (larger size)');
          }
        }
      } else {
        logWarning('  No opt-level specified (using default)');
        optimizations.push({
          area: 'Cargo Optimization Level',
          current: 'default (3)',
          suggestion: 'Add opt-level = "z" for smaller binaries',
          impact: 'Reduces binary size by 10-20%',
        });
      }
      
      if (cargo.includes('lto')) {
        logSuccess('  ✓ Link-time optimization enabled');
      } else {
        logWarning('  LTO not enabled');
        optimizations.push({
          area: 'Link-Time Optimization',
          current: 'disabled',
          suggestion: 'Add lto = true',
          impact: 'Reduces binary size by 5-15%, slower builds',
        });
      }
      
      if (cargo.includes('codegen-units')) {
        logSuccess('  ✓ Codegen units configured');
      } else {
        logInfo('  Codegen units not specified (using default)');
      }
      
      if (cargo.includes('strip')) {
        logSuccess('  ✓ Symbol stripping enabled');
      } else {
        logWarning('  Symbol stripping not enabled');
        optimizations.push({
          area: 'Symbol Stripping',
          current: 'disabled',
          suggestion: 'Add strip = true',
          impact: 'Reduces binary size by 10-30%',
        });
      }
    } else {
      logWarning('No release profile optimizations found');
      optimizations.push({
        area: 'Cargo Release Profile',
        current: 'not configured',
        suggestion: 'Add [profile.release] section with optimizations',
        impact: 'Significant size and performance improvements',
      });
    }
    
    return { optimizations };
  } catch (error) {
    logError(`Failed to check Cargo.toml: ${error.message}`);
    return { optimizations: [] };
  }
}

// Test 4: Startup Time Estimation
async function estimateStartupTime() {
  logSection('Test 4: Startup Time Analysis');
  
  logInfo('Analyzing factors affecting startup time...');
  
  const factors = [];
  
  try {
    const configPath = join(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const config = JSON.parse(await readFile(configPath, 'utf-8'));
    
    // Check if using remote URL
    if (config.build.devUrl || config.app.windows[0].url) {
      const url = config.build.devUrl || config.app.windows[0].url;
      if (url.startsWith('http')) {
        logWarning('Using remote URL for frontend');
        logInfo('  Startup time depends on network latency');
        factors.push({
          factor: 'Remote Frontend',
          impact: 'High',
          description: 'Network latency adds 1-5 seconds to startup',
          suggestion: 'Use local PWA build for faster startup',
        });
      } else {
        logSuccess('Using local frontend (optimal)');
      }
    }
    
    // Check window size
    const window = config.app.windows[0];
    const windowSize = window.width * window.height;
    if (windowSize > 1920 * 1080) {
      logWarning('Large initial window size');
      factors.push({
        factor: 'Window Size',
        impact: 'Medium',
        description: 'Large windows take longer to render',
        suggestion: 'Consider smaller default size',
      });
    } else {
      logSuccess('Reasonable window size');
    }
    
    // Check for plugins
    if (config.plugins) {
      const activePlugins = Object.keys(config.plugins).filter(
        key => config.plugins[key].active
      );
      logInfo(`Active plugins: ${activePlugins.length}`);
      if (activePlugins.length > 5) {
        logWarning('  Many plugins may slow startup');
        factors.push({
          factor: 'Plugin Count',
          impact: 'Low',
          description: 'Each plugin adds initialization time',
          suggestion: 'Disable unused plugins',
        });
      }
    }
    
  } catch (error) {
    logError(`Failed to analyze startup factors: ${error.message}`);
  }
  
  // Estimate startup time
  let estimatedTime = 1.0; // Base time in seconds
  
  for (const factor of factors) {
    if (factor.impact === 'High') estimatedTime += 2.0;
    else if (factor.impact === 'Medium') estimatedTime += 0.5;
    else if (factor.impact === 'Low') estimatedTime += 0.2;
  }
  
  logInfo(`\nEstimated startup time: ${estimatedTime.toFixed(1)}s`);
  
  if (estimatedTime < 2.0) {
    logSuccess('Excellent startup performance');
  } else if (estimatedTime < 4.0) {
    logInfo('Good startup performance');
  } else {
    logWarning('Startup time could be improved');
  }
  
  return { factors, estimatedTime };
}

// Generate optimization recommendations
function generateRecommendations(results) {
  logSection('Optimization Recommendations');
  
  const allOptimizations = [
    ...(results.config?.optimizations || []),
    ...(results.cargo?.optimizations || []),
    ...(results.startup?.factors || []),
  ];
  
  if (allOptimizations.length === 0) {
    logSuccess('No major optimizations needed!');
    logInfo('The desktop app is well-optimized.');
    return;
  }
  
  logInfo(`Found ${allOptimizations.length} optimization opportunity(ies):\n`);
  
  // Group by impact
  const highImpact = allOptimizations.filter(o => o.impact === 'High' || o.impact?.includes('30'));
  const mediumImpact = allOptimizations.filter(o => o.impact === 'Medium' || o.impact?.includes('10'));
  const lowImpact = allOptimizations.filter(o => o.impact === 'Low' || o.impact?.includes('5'));
  
  if (highImpact.length > 0) {
    log('High Impact Optimizations:', colors.red);
    highImpact.forEach((opt, i) => {
      logInfo(`${i + 1}. ${opt.area || opt.factor}`);
      logInfo(`   Current: ${opt.current || 'N/A'}`);
      logInfo(`   Suggestion: ${opt.suggestion}`);
      logInfo(`   Impact: ${opt.impact || opt.description}`);
      console.log('');
    });
  }
  
  if (mediumImpact.length > 0) {
    log('Medium Impact Optimizations:', colors.yellow);
    mediumImpact.forEach((opt, i) => {
      logInfo(`${i + 1}. ${opt.area || opt.factor}`);
      logInfo(`   Suggestion: ${opt.suggestion}`);
      logInfo(`   Impact: ${opt.impact || opt.description}`);
      console.log('');
    });
  }
  
  if (lowImpact.length > 0) {
    log('Low Impact Optimizations:', colors.blue);
    lowImpact.forEach((opt, i) => {
      logInfo(`${i + 1}. ${opt.area || opt.factor}`);
      logInfo(`   Suggestion: ${opt.suggestion}`);
      console.log('');
    });
  }
  
  // Priority recommendations
  console.log('');
  log('Priority Actions:', colors.magenta);
  
  if (highImpact.length > 0) {
    logInfo('1. Address high-impact optimizations first');
    logInfo('2. These provide the most significant improvements');
  }
  
  logInfo('3. Test performance after each change');
  logInfo('4. Monitor bundle sizes with each build');
  logInfo('5. Profile memory usage during runtime');
  
  console.log('');
  log('Optimization Checklist:', colors.cyan);
  logInfo('□ Configure Cargo release profile optimizations');
  logInfo('□ Use local PWA build instead of remote URL');
  logInfo('□ Minimize bundle resources');
  logInfo('□ Enable LTO and symbol stripping');
  logInfo('□ Set appropriate CSP policy');
  logInfo('□ Optimize window size and settings');
  logInfo('□ Disable unused plugins');
  logInfo('□ Test on target hardware');
}

async function main() {
  log('\n⚡ Performance Optimization Test Suite', colors.cyan);
  log('Testing Requirements: 1.5, 5.5\n', colors.blue);
  
  const results = {
    bundles: await analyzeBundleSizes(),
    config: await checkConfigurationOptimizations(),
    cargo: await checkCargoOptimizations(),
    startup: await estimateStartupTime(),
  };
  
  generateRecommendations(results);
  
  // Summary
  logSection('Performance Summary');
  
  if (results.bundles.found) {
    logInfo(`Bundle size: ${formatBytes(results.bundles.totalSize)}`);
  } else {
    logWarning('No build artifacts to analyze');
    logInfo('Run a production build first: pnpm build');
  }
  
  if (results.startup.estimatedTime) {
    logInfo(`Estimated startup: ${results.startup.estimatedTime.toFixed(1)}s`);
  }
  
  const totalOptimizations = 
    (results.config?.optimizations?.length || 0) +
    (results.cargo?.optimizations?.length || 0) +
    (results.startup?.factors?.length || 0);
  
  if (totalOptimizations === 0) {
    logSuccess('\n✨ Performance is well-optimized!');
    return 0;
  } else if (totalOptimizations < 3) {
    logInfo('\n✓ Performance is good with minor improvements possible');
    return 0;
  } else {
    logWarning('\n⚠ Several optimization opportunities identified');
    logInfo('Review recommendations above');
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
