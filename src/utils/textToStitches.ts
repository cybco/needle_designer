// Unified text-to-stitches renderer
// Uses high-resolution rendering + coverage-based sampling for all fonts
// Also supports custom bitmap fonts from Font Creator

import { Stitch, TextOrientation } from '../stores/patternStore';
import { getCustomFont, CustomFont } from '../data/customFonts';

export interface TextRenderOptions {
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  targetHeight: number;      // Desired stitch count (height)
  colorId: string;
  boldness?: number;         // 0.0-1.0, coverage threshold (default 0.5)
  orientation?: TextOrientation; // Text orientation (default: 'horizontal')
}

export interface TextRenderResult {
  stitches: Stitch[];
  width: number;
  height: number;
  // High-res canvas for preview (only when requested)
  highResCanvas?: HTMLCanvasElement;
  // Grid dimensions for overlay
  gridWidth: number;
  gridHeight: number;
}

// Metadata to store with text layers for re-rendering on resize
export interface TextLayerMetadata {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  colorId: string;
  boldness: number;
  orientation?: TextOrientation; // Default: 'horizontal'
}

const RENDER_SCALE = 8; // Always render at 8x target size for quality
const MIN_RENDER_HEIGHT = 48; // Minimum high-res height for readability

/**
 * Single entry point for ALL text rendering
 * Uses high-resolution rendering + coverage-based sampling
 * For custom bitmap fonts, uses pixel-perfect glyph data
 */
/**
 * Convert text to stacked format (one character per line)
 * Preserves existing newlines as double newlines for spacing
 */
function textToStacked(text: string): string {
  // Split by existing newlines first
  const lines = text.split('\n');
  const stackedLines: string[] = [];

  for (const line of lines) {
    // Stack each character in this line
    for (const char of line) {
      if (char !== ' ') {
        stackedLines.push(char);
      } else {
        // Treat spaces as blank lines for spacing
        stackedLines.push('');
      }
    }
    // Add extra blank line between original lines
    if (lines.length > 1) {
      stackedLines.push('');
    }
  }

  // Remove trailing empty line if present
  while (stackedLines.length > 0 && stackedLines[stackedLines.length - 1] === '') {
    stackedLines.pop();
  }

  return stackedLines.join('\n');
}

export function renderTextToStitches(
  options: TextRenderOptions,
  includeHighResCanvas: boolean = false
): TextRenderResult {
  const { text, fontFamily, targetHeight } = options;
  const boldness = options.boldness ?? 0.5;

  if (!text.trim()) {
    return {
      stitches: [],
      width: 0,
      height: 0,
      gridWidth: 0,
      gridHeight: 0,
    };
  }

  // For stacked orientation, convert text to one character per line
  // and adjust target height so each character is approximately the original target height
  let processedText = text;
  let adjustedTargetHeight = targetHeight;

  if (options.orientation === 'stacked') {
    processedText = textToStacked(text);
    // Count number of lines (characters) in stacked text
    const lineCount = processedText.split('\n').filter(line => line.trim()).length;
    if (lineCount > 0) {
      // Each character should be roughly targetHeight, no extra spacing for stacked
      adjustedTargetHeight = Math.round(targetHeight * lineCount);
    }
  }

  const processedOptions = { ...options, text: processedText, targetHeight: adjustedTargetHeight };

  // Check if this is a custom bitmap font
  const customFont = getCustomFont(fontFamily);
  if (customFont) {
    return renderCustomBitmapFont(customFont, processedOptions, includeHighResCanvas);
  }

  // Standard font rendering: high resolution + sampling
  const highRes = renderHighResolution(processedOptions);

  // Sample into stitch grid
  const sampled = sampleToStitchGrid(
    highRes.canvas,
    highRes.textBounds,
    adjustedTargetHeight,
    options.colorId,
    boldness
  );

  // Apply orientation transformation
  const oriented = applyOrientation(
    sampled.stitches,
    sampled.width,
    sampled.height,
    options.orientation
  );

  return {
    stitches: oriented.stitches,
    width: oriented.width,
    height: oriented.height,
    highResCanvas: includeHighResCanvas ? highRes.canvas : undefined,
    gridWidth: oriented.width,
    gridHeight: oriented.height,
  };
}

/**
 * Render text using custom bitmap font glyph data
 */
function renderCustomBitmapFont(
  font: CustomFont,
  options: TextRenderOptions,
  includeHighResCanvas: boolean
): TextRenderResult {
  const { text, targetHeight, colorId } = options;

  // Find the best matching size in the font
  // Prefer exact match, otherwise closest smaller, then closest larger
  let bestSize = font.sizes[0];
  if (font.sizes.length > 1) {
    // Sort by how close to target height
    const sorted = [...font.sizes].sort((a, b) => {
      const diffA = Math.abs(a.height - targetHeight);
      const diffB = Math.abs(b.height - targetHeight);
      return diffA - diffB;
    });
    bestSize = sorted[0];
  }

  if (!bestSize) {
    // No sizes available, return empty
    return {
      stitches: [],
      width: 0,
      height: 0,
      gridWidth: 0,
      gridHeight: 0,
    };
  }

  const sourceHeight = bestSize.height;
  const glyphs = bestSize.glyphs;

  // Build the pixel grid for the entire text
  // Handle multiline text
  const lines = text.split('\n');
  const lineGrids: boolean[][][] = [];
  let maxLineWidth = 0;

  for (const line of lines) {
    const linePixels: boolean[][] = Array(sourceHeight).fill(null).map(() => []);

    for (const char of line) {
      const glyph = glyphs[char];
      if (glyph) {
        // Add glyph pixels
        for (let y = 0; y < sourceHeight; y++) {
          const row = glyph.pixels[y] || '';
          for (let x = 0; x < glyph.width; x++) {
            linePixels[y].push(row[x] === '1');
          }
        }
        // Add 1px spacing between characters
        for (let y = 0; y < sourceHeight; y++) {
          linePixels[y].push(false);
        }
      } else if (char === ' ') {
        // Space character - add 3 pixels of space
        for (let y = 0; y < sourceHeight; y++) {
          linePixels[y].push(false, false, false);
        }
      } else {
        // Unknown character - add a placeholder box
        for (let y = 0; y < sourceHeight; y++) {
          const isEdge = y === 0 || y === sourceHeight - 1;
          for (let x = 0; x < 4; x++) {
            linePixels[y].push(isEdge || x === 0 || x === 3);
          }
          linePixels[y].push(false); // spacing
        }
      }
    }

    // Remove trailing space
    if (linePixels[0].length > 0) {
      for (let y = 0; y < sourceHeight; y++) {
        linePixels[y].pop();
      }
    }

    maxLineWidth = Math.max(maxLineWidth, linePixels[0]?.length || 0);
    lineGrids.push(linePixels);
  }

  // Combine lines into single grid with line spacing
  const lineSpacing = Math.max(1, Math.floor(sourceHeight * 0.2));
  const totalSourceHeight = sourceHeight * lines.length + lineSpacing * (lines.length - 1);
  const combinedGrid: boolean[][] = [];

  for (let lineIdx = 0; lineIdx < lineGrids.length; lineIdx++) {
    const linePixels = lineGrids[lineIdx];
    for (let y = 0; y < sourceHeight; y++) {
      // Pad lines to max width
      const row = [...linePixels[y]];
      while (row.length < maxLineWidth) {
        row.push(false);
      }
      combinedGrid.push(row);
    }
    // Add line spacing (except after last line)
    if (lineIdx < lineGrids.length - 1) {
      for (let s = 0; s < lineSpacing; s++) {
        combinedGrid.push(Array(maxLineWidth).fill(false));
      }
    }
  }

  const sourceWidth = maxLineWidth;

  // Scale to target height if needed
  const scale = targetHeight / totalSourceHeight;
  const finalHeight = targetHeight;
  const finalWidth = Math.max(1, Math.round(sourceWidth * scale));

  // Generate stitches by scaling
  const stitches: Stitch[] = [];

  for (let y = 0; y < finalHeight; y++) {
    for (let x = 0; x < finalWidth; x++) {
      // Map to source coordinates
      const srcY = Math.floor(y / scale);
      const srcX = Math.floor(x / scale);

      if (srcY < combinedGrid.length && srcX < (combinedGrid[srcY]?.length || 0)) {
        if (combinedGrid[srcY][srcX]) {
          stitches.push({
            x,
            y,
            colorId,
            completed: false,
          });
        }
      }
    }
  }

  // Create preview canvas if requested
  let highResCanvas: HTMLCanvasElement | undefined;
  if (includeHighResCanvas) {
    const cellSize = Math.max(4, Math.ceil(MIN_RENDER_HEIGHT / finalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = finalWidth * cellSize;
    canvas.height = finalHeight * cellSize;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    for (const stitch of stitches) {
      ctx.fillRect(stitch.x * cellSize, stitch.y * cellSize, cellSize, cellSize);
    }

    highResCanvas = canvas;
  }

  // Apply orientation transformation
  const oriented = applyOrientation(stitches, finalWidth, finalHeight, options.orientation);

  // Regenerate high-res canvas if orientation changed the dimensions
  if (includeHighResCanvas && options.orientation && options.orientation !== 'horizontal') {
    const cellSize = Math.max(4, Math.ceil(MIN_RENDER_HEIGHT / oriented.height));
    const canvas = document.createElement('canvas');
    canvas.width = oriented.width * cellSize;
    canvas.height = oriented.height * cellSize;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    for (const stitch of oriented.stitches) {
      ctx.fillRect(stitch.x * cellSize, stitch.y * cellSize, cellSize, cellSize);
    }

    highResCanvas = canvas;
  }

  return {
    stitches: oriented.stitches,
    width: oriented.width,
    height: oriented.height,
    highResCanvas,
    gridWidth: oriented.width,
    gridHeight: oriented.height,
  };
}

/**
 * Generate preview data with high-res canvas for grid overlay display
 */
export function generateTextPreview(options: TextRenderOptions): {
  highResCanvas: HTMLCanvasElement;
  gridWidth: number;
  gridHeight: number;
  stitches: Stitch[];
} {
  const result = renderTextToStitches(options, true);

  // If no high-res canvas (bitmap font), create one from stitches
  if (!result.highResCanvas) {
    const canvas = document.createElement('canvas');
    const cellSize = Math.max(4, Math.ceil(MIN_RENDER_HEIGHT / result.height));
    canvas.width = result.width * cellSize;
    canvas.height = result.height * cellSize;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';

    for (const stitch of result.stitches) {
      ctx.fillRect(stitch.x * cellSize, stitch.y * cellSize, cellSize, cellSize);
    }

    return {
      highResCanvas: canvas,
      gridWidth: result.gridWidth,
      gridHeight: result.gridHeight,
      stitches: result.stitches,
    };
  }

  return {
    highResCanvas: result.highResCanvas,
    gridWidth: result.gridWidth,
    gridHeight: result.gridHeight,
    stitches: result.stitches,
  };
}

interface HighResResult {
  canvas: HTMLCanvasElement;
  textBounds: { x: number; y: number; width: number; height: number };
}

/**
 * Render text at high resolution for quality sampling
 */
function renderHighResolution(options: TextRenderOptions): HighResResult {
  const { text, fontFamily, fontWeight, italic, targetHeight, orientation } = options;

  // Calculate render size - at least MIN_RENDER_HEIGHT or RENDER_SCALE * target
  const renderHeight = Math.max(MIN_RENDER_HEIGHT, targetHeight * RENDER_SCALE);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Set up font
  const fontStyle = `${italic ? 'italic ' : ''}${fontWeight} ${renderHeight}px "${fontFamily}"`;
  ctx.font = fontStyle;

  // Handle multiline text
  const lines = text.split('\n');
  // For stacked text, use tighter line spacing (no extra space between characters)
  const lineHeightMultiplier = orientation === 'stacked' ? 1.0 : 1.2;
  const lineHeight = Math.ceil(renderHeight * lineHeightMultiplier);

  // Measure text
  let maxWidth = 0;
  let maxLeft = 0;

  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, Math.ceil(metrics.width));
    if (metrics.actualBoundingBoxLeft !== undefined) {
      maxLeft = Math.max(maxLeft, Math.ceil(metrics.actualBoundingBoxLeft));
    }
  }

  // Add padding
  const italicExtra = italic ? Math.ceil(renderHeight * 0.4) : 0;
  const padding = Math.max(4, Math.ceil(renderHeight * 0.3));
  const leftPadding = padding + italicExtra + maxLeft;
  const totalHeight = lineHeight * lines.length;

  // Size canvas
  canvas.width = Math.ceil(maxWidth) + leftPadding + padding + italicExtra;
  canvas.height = totalHeight + padding * 2;

  // Clear canvas (white background)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Re-set font after resize
  ctx.font = fontStyle;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';

  // Render text
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], leftPadding, padding + i * lineHeight);
  }

  // Find actual text bounds (non-white pixels)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
      if (brightness < 250) { // Any non-white pixel
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Handle empty text
  if (minX > maxX) {
    return {
      canvas,
      textBounds: { x: 0, y: 0, width: 0, height: 0 },
    };
  }

  return {
    canvas,
    textBounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

interface SampleResult {
  stitches: Stitch[];
  width: number;
  height: number;
}

/**
 * Sample high-resolution canvas into stitch grid using coverage-based threshold
 */
function sampleToStitchGrid(
  sourceCanvas: HTMLCanvasElement,
  textBounds: { x: number; y: number; width: number; height: number },
  targetHeight: number,
  colorId: string,
  threshold: number
): SampleResult {
  if (textBounds.width === 0 || textBounds.height === 0) {
    return { stitches: [], width: 0, height: 0 };
  }

  const ctx = sourceCanvas.getContext('2d')!;
  const imageData = ctx.getImageData(
    textBounds.x,
    textBounds.y,
    textBounds.width,
    textBounds.height
  );

  // Calculate cell size (how many source pixels per stitch)
  const cellHeight = textBounds.height / targetHeight;
  const cellWidth = cellHeight; // Square cells
  const gridWidth = Math.max(1, Math.ceil(textBounds.width / cellWidth));

  const stitches: Stitch[] = [];

  for (let gy = 0; gy < targetHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      // Calculate coverage for this cell
      const coverage = calculateCellCoverage(
        imageData,
        gx * cellWidth,
        gy * cellHeight,
        cellWidth,
        cellHeight
      );

      // Threshold determines if stitch is filled
      // Invert threshold: higher boldness = lower threshold = more fill
      const adjustedThreshold = 1 - threshold;
      if (coverage >= adjustedThreshold) {
        stitches.push({
          x: gx,
          y: gy,
          colorId,
          completed: false,
        });
      }
    }
  }

  return { stitches, width: gridWidth, height: targetHeight };
}

/**
 * Calculate the coverage (filled percentage) of a cell
 */
function calculateCellCoverage(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  let filledWeight = 0;
  let totalWeight = 0;

  const startX = Math.floor(x);
  const startY = Math.floor(y);
  const endX = Math.min(Math.ceil(x + width), imageData.width);
  const endY = Math.min(Math.ceil(y + height), imageData.height);

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const idx = (py * imageData.width + px) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];

      // Calculate darkness (0 = white, 1 = black)
      const darkness = 1 - (r + g + b) / (3 * 255);

      filledWeight += darkness;
      totalWeight += 1;
    }
  }

  return totalWeight > 0 ? filledWeight / totalWeight : 0;
}

/**
 * Create metadata object for storing with text layers
 */
export function createTextLayerMetadata(options: TextRenderOptions): TextLayerMetadata {
  return {
    type: 'text',
    text: options.text,
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight,
    italic: options.italic,
    colorId: options.colorId,
    boldness: options.boldness ?? 0.5,
    orientation: options.orientation ?? 'horizontal',
  };
}

/**
 * Transform stitches based on text orientation
 * - horizontal: no change (default)
 * - vertical-up: rotate 90° counter-clockwise (text reads bottom to top)
 * - vertical-down: rotate 90° clockwise (text reads top to bottom)
 * - stacked: handled during rendering (each character on separate line)
 */
function applyOrientation(
  stitches: Stitch[],
  width: number,
  height: number,
  orientation: TextOrientation | undefined
): { stitches: Stitch[]; width: number; height: number } {
  // 'stacked' is handled by modifying text before rendering, not here
  if (!orientation || orientation === 'horizontal' || orientation === 'stacked') {
    return { stitches, width, height };
  }

  const transformed: Stitch[] = [];

  for (const stitch of stitches) {
    let newX: number, newY: number;

    switch (orientation) {
      case 'vertical-up':
        // Rotate 90° counter-clockwise: (x, y) -> (y, width - 1 - x)
        newX = stitch.y;
        newY = width - 1 - stitch.x;
        break;
      case 'vertical-down':
        // Rotate 90° clockwise: (x, y) -> (height - 1 - y, x)
        newX = height - 1 - stitch.y;
        newY = stitch.x;
        break;
      default:
        newX = stitch.x;
        newY = stitch.y;
    }

    transformed.push({
      ...stitch,
      x: newX,
      y: newY,
    });
  }

  // For 90° rotations, swap width and height
  if (orientation === 'vertical-up' || orientation === 'vertical-down') {
    return { stitches: transformed, width: height, height: width };
  }

  return { stitches: transformed, width, height };
}
