// Pixel-optimized fonts that render well at small stitch sizes
// These fonts are designed for pixel-perfect display and work best for needlepoint text

export interface PixelFont {
  family: string;
  category: 'pixel';
  weights: number[];
  googleUrl: string;
  description: string;
  // Native height of the font's pixel grid - sizes should be multiples of this
  nativeHeight: number;
  // Recommended sizes that render cleanly (multiples of nativeHeight)
  recommendedSizes: number[];
  // Minimum usable size
  minSize: number;
}

// Curated list of pixel-optimized fonts from Google Fonts
// Each font has a native pixel height - use multiples of that for clean rendering
export const pixelFonts: PixelFont[] = [
  {
    family: 'Press Start 2P',
    category: 'pixel',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
    description: 'Classic 8-bit arcade style',
    nativeHeight: 8,
    recommendedSizes: [8, 16, 24, 32, 40, 48],
    minSize: 8,
  },
  {
    family: 'VT323',
    category: 'pixel',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=VT323&display=swap',
    description: 'Retro terminal/computer style',
    nativeHeight: 16,
    recommendedSizes: [8, 12, 16, 24, 32, 48],
    minSize: 8,
  },
  {
    family: 'Silkscreen',
    category: 'pixel',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap',
    description: 'Clean, readable pixel font',
    nativeHeight: 8,
    recommendedSizes: [8, 16, 24, 32, 40, 48],
    minSize: 8,
  },
  {
    family: 'DotGothic16',
    category: 'pixel',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=DotGothic16&display=swap',
    description: 'Japanese pixel style',
    nativeHeight: 16,
    recommendedSizes: [12, 16, 24, 32, 48],
    minSize: 12,
  },
  {
    family: 'Pixelify Sans',
    category: 'pixel',
    weights: [400, 500, 600, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap',
    description: 'Modern pixel font with multiple weights',
    nativeHeight: 8,
    recommendedSizes: [8, 12, 16, 20, 24, 32, 40, 48],
    minSize: 8,
  },
  {
    family: 'Tiny5',
    category: 'pixel',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Tiny5&display=swap',
    description: 'Ultra-compact 5-pixel height',
    nativeHeight: 5,
    recommendedSizes: [5, 10, 15, 20, 25, 30],
    minSize: 5,
  },
];

// Get pixel font data by family name
export function getPixelFontData(family: string): PixelFont | undefined {
  return pixelFonts.find(f => f.family === family);
}

// Get recommended sizes for a pixel font
export function getRecommendedSizes(family: string): number[] {
  const font = getPixelFontData(family);
  return font?.recommendedSizes ?? [];
}

// Check if a size is recommended for a pixel font
export function isRecommendedSize(family: string, size: number): boolean {
  const font = getPixelFontData(family);
  if (!font) return true; // Not a pixel font, any size is fine
  return font.recommendedSizes.includes(size);
}

// Get the nearest recommended size for a pixel font
export function getNearestRecommendedSize(family: string, targetSize: number): number {
  const font = getPixelFontData(family);
  if (!font) return targetSize;

  let nearest = font.recommendedSizes[0];
  let minDiff = Math.abs(targetSize - nearest);

  for (const size of font.recommendedSizes) {
    const diff = Math.abs(targetSize - size);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = size;
    }
  }

  return nearest;
}

// Load a pixel font from Google Fonts CDN
export function loadPixelFont(family: string, _weight: number = 400): void {
  const font = pixelFonts.find(f => f.family === family);
  if (!font) return;

  // Check if already loaded
  const existingLink = document.querySelector(`link[data-font="${family}"]`);
  if (existingLink) return;

  // Create and inject the font link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = font.googleUrl;
  link.setAttribute('data-font', family);
  document.head.appendChild(link);
}

// Check if a font family is a pixel font
export function isPixelFont(family: string): boolean {
  return pixelFonts.some(f => f.family === family);
}

// Check if a pixel font is loaded and ready
export function isPixelFontLoaded(family: string): boolean {
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

// Wait for a pixel font to load
export async function waitForPixelFont(family: string, weight: number = 400, timeout: number = 5000): Promise<boolean> {
  loadPixelFont(family, weight);

  const startTime = Date.now();
  const checkInterval = 50;

  while (Date.now() - startTime < timeout) {
    if (isPixelFontLoaded(family)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // Return true anyway after timeout - font might still work
  return true;
}
