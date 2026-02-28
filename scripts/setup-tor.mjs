import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOR_VERSION = '14.0.6';
const DESKTOP_TAURI_DIR = path.resolve(__dirname, '../apps/desktop/src-tauri');

// Map Node `process.platform` and `process.arch` to Tor's bundle naming & Tauri's target triple
const TARGETS = {
  'win32-x64': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-x86_64-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor.exe',
    extractedPath: 'tor/tor.exe',
    tauriTriple: 'x86_64-pc-windows-msvc',
  },
  'win32-ia32': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-windows-i686-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor.exe',
    extractedPath: 'tor/tor.exe',
    tauriTriple: 'i686-pc-windows-msvc',
  },
  'darwin-x64': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-x86_64-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor',
    extractedPath: 'tor/tor',
    tauriTriple: 'x86_64-apple-darwin',
  },
  'darwin-arm64': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-macos-aarch64-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor',
    extractedPath: 'tor/tor',
    tauriTriple: 'aarch64-apple-darwin',
  },
  'linux-x64': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-linux-x86_64-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor',
    extractedPath: 'tor/tor',
    tauriTriple: 'x86_64-unknown-linux-gnu',
  },
  'linux-arm64': {
    url: `https://archive.torproject.org/tor-package-archive/torbrowser/${TOR_VERSION}/tor-expert-bundle-linux-aarch64-${TOR_VERSION}.tar.gz`,
    binaryName: 'tor',
    extractedPath: 'tor/tor',
    tauriTriple: 'aarch64-unknown-linux-gnu',
  }
};

const currentTarget = `${process.platform}-${process.arch}`;
const targetConfig = TARGETS[currentTarget];

if (!targetConfig) {
  console.error(`Unsupported platform/architecture: ${currentTarget}`);
  process.exit(1);
}

const finalBinaryName = `tor-${targetConfig.tauriTriple}${process.platform === 'win32' ? '.exe' : ''}`;
const finalBinaryPath = path.join(DESKTOP_TAURI_DIR, finalBinaryName);
const tempTarPath = path.join(DESKTOP_TAURI_DIR, `tor-temp-${Date.now()}.tar.gz`);

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  try {
    // Check if real binary exists (size > 0)
    if (fs.existsSync(finalBinaryPath)) {
      const stats = fs.statSync(finalBinaryPath);
      if (stats.size > 0) {
        console.log(`[Tor Setup] Valid binary already exists at ${finalBinaryPath}. Skipping download.`);
        return;
      } else {
         console.log(`[Tor Setup] Found 0-byte placeholder at ${finalBinaryPath}. Will replace.`);
      }
    } else {
      console.log(`[Tor Setup] Binary not found at ${finalBinaryPath}.`);
    }

    console.log(`[Tor Setup] Downloading Tor for ${currentTarget} from ${targetConfig.url}...`);
    await downloadFile(targetConfig.url, tempTarPath);
    console.log(`[Tor Setup] Download complete.`);

    console.log(`[Tor Setup] Extracting archive...`);
    // Modern Windows 10/11, macOS, and Linux all have `tar` natively available.
    execSync(`tar -xzf "${path.basename(tempTarPath)}" "${targetConfig.extractedPath}"`, { cwd: DESKTOP_TAURI_DIR });
    
    // Move extracted file
    const extractedFile = path.join(DESKTOP_TAURI_DIR, targetConfig.extractedPath);
    fs.renameSync(extractedFile, finalBinaryPath);
    
    // Cleanup Temp Tar and extracted 'tor' folder
    fs.unlinkSync(tempTarPath);
    const torFolder = path.join(DESKTOP_TAURI_DIR, 'tor');
    if (fs.existsSync(torFolder)) {
      fs.rmSync(torFolder, { recursive: true, force: true });
    }

    if (process.platform !== 'win32') {
      execSync(`chmod +x "${finalBinaryPath}"`);
    }

    console.log(`[Tor Setup] Successfully installed Tor sidecar to: ${finalBinaryPath}`);

  } catch (error) {
    console.error(`[Tor Setup] Failed to install Tor:`, error.message);
    if (fs.existsSync(tempTarPath)) {
      fs.unlinkSync(tempTarPath);
    }
    process.exit(1);
  }
}

main();
