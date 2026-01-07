// Bitmap font renderer - converts text to stitches using pre-rendered bitmap data
import { Stitch } from '../stores/patternStore';
import { getBitmapFont, hasBitmapSize } from './bitmapFonts';

interface RenderResult {
  stitches: Stitch[];
  width: number;
  height: number;
}

/**
 * Render text using bitmap font data
 * Returns pixel-perfect stitches at the exact requested size
 */
export function renderBitmapText(
  text: string,
  fontFamily: string,
  size: number,
  colorId: string
): RenderResult {
  const font = getBitmapFont(fontFamily);
  if (!font) {
    return { stitches: [], width: 0, height: 0 };
  }

  // Find the font size data
  const fontSizeData = font.sizes.find(s => s.height === size);
  if (!fontSizeData) {
    // If exact size not available, try to scale from available size
    return renderScaledBitmapText(text, fontFamily, size, colorId);
  }

  const stitches: Stitch[] = [];
  const lines = text.split('\n');
  const lineSpacing = 1; // 1 pixel between lines

  let maxWidth = 0;
  let currentY = 0;

  for (const line of lines) {
    let currentX = 0;

    for (const char of line) {
      const glyph = fontSizeData.glyphs[char];

      if (glyph) {
        // Render this glyph
        for (let y = 0; y < glyph.pixels.length; y++) {
          const row = glyph.pixels[y];
          for (let x = 0; x < row.length; x++) {
            if (row[x] === '1') {
              stitches.push({
                x: currentX + x,
                y: currentY + y,
                colorId,
                completed: false,
              });
            }
          }
        }
        currentX += glyph.width + 1; // 1 pixel kerning
      } else {
        // Unknown character - use space width
        const spaceGlyph = fontSizeData.glyphs[' '];
        currentX += (spaceGlyph?.width ?? 3) + 1;
      }
    }

    // Remove trailing kerning
    if (currentX > 0) currentX -= 1;
    maxWidth = Math.max(maxWidth, currentX);
    currentY += size + lineSpacing;
  }

  // Remove trailing line spacing
  if (currentY > 0) currentY -= lineSpacing;

  return {
    stitches,
    width: maxWidth,
    height: currentY,
  };
}

/**
 * Render text by scaling from a different available size
 */
function renderScaledBitmapText(
  text: string,
  fontFamily: string,
  targetSize: number,
  colorId: string
): RenderResult {
  const font = getBitmapFont(fontFamily);
  if (!font || font.sizes.length === 0) {
    return { stitches: [], width: 0, height: 0 };
  }

  // Find the best source size to scale from
  // Prefer sizes that are factors of target (for clean scaling)
  // or the closest available size
  const availableSizes = font.sizes.map(s => s.height).sort((a, b) => a - b);

  let sourceSize = availableSizes[0];
  let bestScore = Infinity;

  for (const size of availableSizes) {
    // Perfect divisor is best
    if (targetSize % size === 0) {
      const scale = targetSize / size;
      if (scale >= 1 && scale <= 4) {
        sourceSize = size;
        bestScore = 0;
        break;
      }
    }
    // Otherwise use closest
    const diff = Math.abs(targetSize - size);
    if (diff < bestScore) {
      bestScore = diff;
      sourceSize = size;
    }
  }

  // Render at source size first
  const sourceResult = renderBitmapText(text, fontFamily, sourceSize, colorId);

  if (sourceSize === targetSize) {
    return sourceResult;
  }

  // Scale the result
  const scale = targetSize / sourceSize;
  const scaledStitches: Stitch[] = [];

  for (const stitch of sourceResult.stitches) {
    // For each source pixel, create a block of scaled pixels
    const baseX = Math.round(stitch.x * scale);
    const baseY = Math.round(stitch.y * scale);
    const blockSize = Math.max(1, Math.round(scale));

    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        scaledStitches.push({
          x: baseX + dx,
          y: baseY + dy,
          colorId,
          completed: false,
        });
      }
    }
  }

  return {
    stitches: scaledStitches,
    width: Math.round(sourceResult.width * scale),
    height: Math.round(sourceResult.height * scale),
  };
}

/**
 * Check if a font/size combination can be rendered with bitmap data
 */
export function canRenderBitmap(fontFamily: string, size: number): boolean {
  const font = getBitmapFont(fontFamily);
  if (!font) return false;

  // Can render if exact size exists or we can scale from another size
  if (hasBitmapSize(fontFamily, size)) return true;

  // Check if we can cleanly scale
  for (const fontSizeData of font.sizes) {
    if (size % fontSizeData.height === 0) {
      const scale = size / fontSizeData.height;
      if (scale >= 1 && scale <= 4) return true;
    }
  }

  return font.sizes.length > 0; // Can always scale, just might not be perfect
}

/**
 * Get the nearest recommended size for a bitmap font
 */
export function getNearestBitmapSize(fontFamily: string, targetSize: number): number {
  const font = getBitmapFont(fontFamily);
  if (!font || font.sizes.length === 0) return targetSize;

  const availableSizes = font.sizes.map(s => s.height);

  // First check for exact match
  if (availableSizes.includes(targetSize)) return targetSize;

  // Check for clean multiples
  for (const size of availableSizes) {
    if (targetSize % size === 0) {
      const scale = targetSize / size;
      if (scale >= 1 && scale <= 4) return targetSize; // Can scale cleanly
    }
  }

  // Return closest available size
  let nearest = availableSizes[0];
  let minDiff = Math.abs(targetSize - nearest);

  for (const size of availableSizes) {
    const diff = Math.abs(targetSize - size);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = size;
    }
  }

  return nearest;
}
