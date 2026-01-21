# Desktop App Testing Guide

This directory contains test scripts and validation tools for the Obscur desktop application packaging system.

## Quick Start

Run all validation checks:

```bash
cd apps/desktop

# Validate development setup
node validate-dev-setup.js

# Validate build configuration  
node validate-build-config.js

# Validate GitHub Actions workflow
node validate-workflow.js
```

All three scripts should complete in under 5 seconds and provide immediate feedback.

## Test Scripts

### Validation Scripts (Fast, Non-Interactive)

#### `validate-dev-setup.js`
**Purpose**: Validate development environment  
**Runtime**: ~2 seconds  
**Tests**: 7.1 - Test local development builds  
**Requirements**: 5.1, 5.2

Checks:
- Node.js, pnpm, Rust, Cargo installed
- Tauri configuration valid
- Package.json configured
- Development scripts available

```bash
node validate-dev-setup.js
```

#### `validate-build-config.js`
**Purpose**: Validate production build configuration  
**Runtime**: ~2 seconds  
**Tests**: 7.2 - Test production builds locally  
**Requirements**: 1.1, 1.2, 1.3, 6.1

Checks:
- Icon assets present
- Bundle configuration complete
- Platform-specific settings
- Build paths configured
- Plugin configuration

```bash
node validate-build-config.js
```

#### `validate-workflow.js`
**Purpose**: Validate GitHub Actions workflow  
**Runtime**: ~2 seconds  
**Tests**: 7.3 - Validate GitHub Actions workflow  
**Requirements**: 7.1, 7.2, 7.3, 7.4

Checks:
- Workflow triggers configured
- Platform matrix complete
- Dependencies installation
- Tauri action configured
- Code signing setup
- Permissions granted
- Artifact handling

```bash
node validate-workflow.js
```

### Comprehensive Test Scripts (Slow, Interactive)

#### `test-dev-build.js`
**Purpose**: Comprehensive development build test  
**Runtime**: ~10-15 seconds (with dev server test)  
**Interactive**: Yes (asks to start dev server)

Includes all checks from `validate-dev-setup.js` plus:
- Dev server startup test
- Hot reload validation
- Detailed recommendations

```bash
node test-dev-build.js
```

#### `test-production-build.js`
**Purpose**: Full production build test  
**Runtime**: 10-30 minutes (runs actual build)  
**Interactive**: Yes (asks to continue if prerequisites fail)

Includes all checks from `validate-build-config.js` plus:
- Runs actual production build
- Locates and analyzes build artifacts
- Validates artifact integrity
- Provides detailed build report

```bash
node test-production-build.js
```

**Warning**: This script runs a full production build which can take 10-30 minutes depending on your system.

## Test Documentation

### `TEST_RESULTS.md`
Detailed test results for all sub-tasks:
- 7.1 Test local development builds
- 7.2 Test production builds locally
- 7.3 Validate GitHub Actions workflow

Includes:
- Test summaries
- Requirements validation
- Current limitations
- Next steps
- Detailed findings

### `TESTING_SUMMARY.md`
High-level summary of all testing:
- Overall assessment
- What works
- Known limitations
- Quick reference guide

## Recommended Testing Workflow

### 1. Initial Validation (5 seconds)

```bash
# Run all validation scripts
node validate-dev-setup.js
node validate-build-config.js
node validate-workflow.js
```

All should pass with green checkmarks. Yellow warnings are expected for:
- Remote PWA URL (task 1.3 incomplete)
- Unsigned builds (task 3 incomplete)

### 2. Review Results

```bash
# Read detailed results
cat TEST_RESULTS.md

# Read summary
cat TESTING_SUMMARY.md
```

### 3. Optional: Test Actual Build

Only if you want to verify the build process works:

```bash
# This will take 10-30 minutes
node test-production-build.js
```

Or build directly:

```bash
pnpm build
```

### 4. Optional: Test GitHub Actions

Create a test tag to trigger the workflow:

```bash
git tag v0.0.1-test
git push origin v0.0.1-test
```

Monitor in GitHub Actions tab.

## Understanding Test Results

### ✅ Green Checkmarks
Everything is working correctly. No action needed.

### ⚠️ Yellow Warnings
Expected limitations that don't prevent functionality:
- **Remote PWA URL**: Task 1.3 incomplete, using remote URL
- **Unsigned builds**: Task 3 incomplete, builds work but show security warnings
- **No beforeBuildCommand**: Task 1.3 incomplete, PWA not built automatically

These are documented and valid for the current development phase.

### ❌ Red Errors
Critical issues that need to be fixed:
- Missing dependencies
- Invalid configuration
- Missing required files

If you see red errors, review the output and fix the issues before proceeding.

## Exit Codes

All scripts use standard exit codes:
- `0`: All checks passed
- `1`: Some checks failed

Use in CI/CD:

```bash
node validate-dev-setup.js && \
node validate-build-config.js && \
node validate-workflow.js && \
echo "All validations passed!"
```

## Troubleshooting

### "Failed to load Tauri config"
- Ensure you're in the `apps/desktop` directory
- Check that `src-tauri/tauri.conf.json` exists

### "Node.js: Not found"
- Install Node.js 20 or later
- Ensure it's in your PATH

### "pnpm: Not found"
- Install pnpm: `npm install -g pnpm`
- Or use corepack: `corepack enable`

### "Rust: Not found"
- Install Rust: https://rustup.rs/
- Restart your terminal after installation

### "Build failed"
- Check that all dependencies are installed
- Review error messages in output
- Ensure task 1.3 is complete for local PWA builds

## Requirements Mapping

| Script | Tests | Requirements |
|--------|-------|--------------|
| `validate-dev-setup.js` | 7.1 | 5.1, 5.2 |
| `validate-build-config.js` | 7.2 | 1.1, 1.2, 1.3, 6.1 |
| `validate-workflow.js` | 7.3 | 7.1, 7.2, 7.3, 7.4 |

## Related Files

- **Spec**: `.kiro/specs/desktop-app-packaging/`
- **Requirements**: `.kiro/specs/desktop-app-packaging/requirements.md`
- **Design**: `.kiro/specs/desktop-app-packaging/design.md`
- **Tasks**: `.kiro/specs/desktop-app-packaging/tasks.md`
- **Workflow**: `.github/workflows/tauri-build.yml`
- **Tauri Config**: `src-tauri/tauri.conf.json`

## Contributing

When adding new tests:
1. Follow the existing script structure
2. Use consistent color coding
3. Provide clear success/error messages
4. Document in this README
5. Update TEST_RESULTS.md

## Support

For issues or questions:
1. Review TEST_RESULTS.md for detailed information
2. Check TESTING_SUMMARY.md for overview
3. Review the spec documents in `.kiro/specs/desktop-app-packaging/`
4. Check GitHub Actions logs for CI/CD issues
