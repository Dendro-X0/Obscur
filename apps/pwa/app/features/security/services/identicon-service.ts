/**
 * Identicon Service - Generate visual fingerprints from public keys
 * 
 * Creates deterministic, unique visual representations of public keys
 * for cross-device identity verification. Uses a grid-based pattern
 * generated from key hash bits.
 */

export interface IdenticonOptions {
  size?: number;
  gridSize?: number;
  colorSaturation?: number;
  colorLightness?: number;
}

export interface IdenticonData {
  svg: string;
  color: string;
  grid: boolean[][];
  keyFragment: string;
}

const DEFAULT_OPTIONS: Required<IdenticonOptions> = {
  size: 128,
  gridSize: 5,
  colorSaturation: 70,
  colorLightness: 50,
};

/**
 * Generate a deterministic color from a public key hash
 */
function generateColor(keyHash: string, saturation: number, lightness: number): string {
  // Use first 6 chars of hash as hue (0-360)
  const hue = parseInt(keyHash.slice(0, 6), 16) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generate symmetric grid pattern from key hash
 * Creates a mirrored pattern for visual balance
 */
function generateGridPattern(keyHash: string, gridSize: number): boolean[][] {
  const grid: boolean[][] = [];
  const midPoint = Math.ceil(gridSize / 2);
  
  // Use hash bytes to generate pattern
  const hashBytes = keyHash.match(/.{2}/g) || [];
  
  for (let row = 0; row < gridSize; row++) {
    const rowData: boolean[] = [];
    
    for (let col = 0; col < midPoint; col++) {
      // Use consecutive hash bytes, wrap if needed
      const byteIndex = (row * midPoint + col) % hashBytes.length;
      const byteValue = parseInt(hashBytes[byteIndex], 16);
      // True if byte value is > 127 (half of 255)
      rowData.push(byteValue > 127);
    }
    
    // Mirror the row for symmetry
    const mirrored = [...rowData];
    if (gridSize % 2 === 0) {
      // Even grid: mirror all
      rowData.push(...mirrored.reverse());
    } else {
      // Odd grid: mirror excluding middle
      rowData.push(...mirrored.slice(0, -1).reverse());
    }
    
    grid.push(rowData);
  }
  
  return grid;
}

/**
 * Generate SVG identicon from grid pattern
 */
function generateSvg(
  grid: boolean[][],
  color: string,
  size: number,
  gridSize: number
): string {
  const cellSize = size / gridSize;
  const bgColor = '#f0f0f0';
  
  let rects = '';
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (grid[row][col]) {
        const x = col * cellSize;
        const y = row * cellSize;
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" />`;
      }
    }
  }
  
  // Add rounded corners via clip path or overlay
  const borderRadius = cellSize * 0.2;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="border-radius: ${borderRadius}px;">
    <rect width="${size}" height="${size}" fill="${bgColor}" rx="${borderRadius * 2}" />
    ${rects}
  </svg>`;
}

/**
 * Extract a short, readable fragment from public key
 */
function generateKeyFragment(publicKeyHex: string): string {
  // Show first 8 and last 8 chars with ellipsis
  if (publicKeyHex.length <= 16) return publicKeyHex;
  return `${publicKeyHex.slice(0, 8)}...${publicKeyHex.slice(-8)}`;
}

/**
 * Generate a complete identicon from a public key
 */
export async function generateIdenticon(
  publicKeyHex: string,
  options: IdenticonOptions = {}
): Promise<IdenticonData> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create hash of the public key
  const encoder = new TextEncoder();
  const data = encoder.encode(publicKeyHex.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const color = generateColor(keyHash, opts.colorSaturation, opts.colorLightness);
  const grid = generateGridPattern(keyHash, opts.gridSize);
  const svg = generateSvg(grid, color, opts.size, opts.gridSize);
  const keyFragment = generateKeyFragment(publicKeyHex);
  
  return {
    svg,
    color,
    grid,
    keyFragment,
  };
}

/**
 * Generate a data URL for easy img src usage
 */
export async function generateIdenticonDataUrl(
  publicKeyHex: string,
  options: IdenticonOptions = {}
): Promise<string> {
  const identicon = await generateIdenticon(publicKeyHex, options);
  const svgBase64 = btoa(unescape(encodeURIComponent(identicon.svg)));
  return `data:image/svg+xml;base64,${svgBase64}`;
}

/**
 * Compare two identicons for visual verification
 * Returns similarity score (0-1)
 */
export function compareIdenticons(gridA: boolean[][], gridB: boolean[][]): number {
  if (gridA.length !== gridB.length) return 0;
  
  let matches = 0;
  let total = 0;
  
  for (let row = 0; row < gridA.length; row++) {
    if (gridA[row].length !== gridB[row].length) return 0;
    
    for (let col = 0; col < gridA[row].length; col++) {
      total++;
      if (gridA[row][col] === gridB[row][col]) {
        matches++;
      }
    }
  }
  
  return total > 0 ? matches / total : 0;
}
