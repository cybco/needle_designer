import { Pattern, Stitch } from '../stores/patternStore';
import { PATTERN_SYMBOLS } from './symbolAssignment';

// PDF export settings
const PAGE_MARGIN = 20; // mm
const CELL_SIZE_MM = 3; // Size of each stitch cell in mm
const HEADER_HEIGHT = 25; // mm for title and info
const LEGEND_CELL_SIZE = 8; // mm for color legend squares
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_INFO = 10;
const FONT_SIZE_LEGEND = 8;
const FONT_SIZE_GRID = 6;

// Fallback symbols if color has no assigned symbol
const FALLBACK_SYMBOLS = PATTERN_SYMBOLS.all;

interface ExportOptions {
  includePreviewPage: boolean; // Add a cover page with preview image and stats
  includeFullChartPage: boolean; // Add a full pattern chart scaled to fit one page
  includeColorLegend: boolean;
  includeStitchCounts: boolean;
  includeGridNumbers: boolean;
  useSymbols: boolean; // Use symbols instead of colors (for B&W printing)
  title?: string;
  shouldWatermark?: boolean; // Add trial watermark to all pages
}

const DEFAULT_OPTIONS: ExportOptions = {
  includePreviewPage: true,
  includeFullChartPage: false,
  includeColorLegend: true,
  includeStitchCounts: true,
  includeGridNumbers: true,
  useSymbols: false,
  shouldWatermark: false,
};

// Constants for preview page
const PREVIEW_MAX_WIDTH = 140; // mm - max width for preview image
const PREVIEW_MAX_HEIGHT = 120; // mm - max height for preview image
const MM_PER_INCH = 25.4;
const WATERMARK_TEXT = 'TRIAL VERSION - stitchalot.studio';

// Add trial watermarks to a PDF page (multiple watermarks for better coverage)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTrialWatermark(pdf: any, pageWidth: number, pageHeight: number): void {
  // Save current graphics state
  pdf.saveGraphicsState();

  // Set watermark style - semi-transparent gray
  pdf.setGState(new pdf.GState({ opacity: 0.12 }));
  pdf.setTextColor(128, 128, 128);

  // Calculate rotation angle (diagonal)
  const angle = -35;

  // Add multiple watermarks in a grid pattern
  const fontSize = 24;
  pdf.setFontSize(fontSize);

  // Create a grid of watermarks across the page
  const spacingX = 120;
  const spacingY = 60;

  for (let y = -spacingY; y < pageHeight + spacingY; y += spacingY) {
    for (let x = -spacingX; x < pageWidth + spacingX; x += spacingX) {
      // Offset every other row for a more natural pattern
      const offsetX = (Math.floor(y / spacingY) % 2) * (spacingX / 2);
      pdf.text(WATERMARK_TEXT, x + offsetX, y, {
        align: 'center',
        angle: angle,
      });
    }
  }

  // Restore graphics state
  pdf.restoreGraphicsState();
}

// Get all stitches from all visible layers
function getAllStitches(pattern: Pattern): Stitch[] {
  const stitches: Stitch[] = [];
  for (const layer of pattern.layers) {
    if (layer.visible) {
      stitches.push(...layer.stitches);
    }
  }
  return stitches;
}

// Count stitches per color
function countStitchesByColor(stitches: Stitch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stitch of stitches) {
    counts.set(stitch.colorId, (counts.get(stitch.colorId) || 0) + 1);
  }
  return counts;
}

// Create a 2D grid of stitches for rendering
function createStitchGrid(pattern: Pattern): (Stitch | null)[][] {
  const grid: (Stitch | null)[][] = [];

  // Initialize empty grid
  for (let y = 0; y < pattern.canvas.height; y++) {
    grid[y] = new Array(pattern.canvas.width).fill(null);
  }

  // Fill in stitches from all visible layers (later layers override earlier ones)
  for (const layer of pattern.layers) {
    if (layer.visible) {
      for (const stitch of layer.stitches) {
        if (stitch.x >= 0 && stitch.x < pattern.canvas.width &&
            stitch.y >= 0 && stitch.y < pattern.canvas.height) {
          grid[stitch.y][stitch.x] = stitch;
        }
      }
    }
  }

  return grid;
}

// Calculate contrast color (black or white) for text on a background
function getContrastColor(rgb: [number, number, number]): string {
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// Helper to draw a realistic cross-stitch on a canvas cell
function drawCrossStitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: [number, number, number]
) {
  const [r, g, b] = rgb;

  // Calculate lighter and darker shades for 3D effect
  const lighterR = Math.min(255, r + 40);
  const lighterG = Math.min(255, g + 40);
  const lighterB = Math.min(255, b + 40);

  const darkerR = Math.max(0, r - 50);
  const darkerG = Math.max(0, g - 50);
  const darkerB = Math.max(0, b - 50);

  const padding = size * 0.08;
  const threadWidth = size * 0.28;

  const left = x + padding;
  const right = x + size - padding;
  const top = y + padding;
  const bottom = y + size - padding;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the bottom-left to top-right stroke first (underneath)
  ctx.strokeStyle = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
  ctx.lineWidth = threadWidth;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, top);
  ctx.stroke();

  // Add highlight to the first stroke
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = threadWidth * 0.6;
  ctx.beginPath();
  ctx.moveTo(left + threadWidth * 0.15, bottom - threadWidth * 0.15);
  ctx.lineTo(right - threadWidth * 0.15, top + threadWidth * 0.15);
  ctx.stroke();

  // Draw the top-left to bottom-right stroke (on top)
  ctx.strokeStyle = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
  ctx.lineWidth = threadWidth;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // Add highlight to the second stroke (brighter since it's on top)
  ctx.strokeStyle = `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
  ctx.lineWidth = threadWidth * 0.5;
  ctx.beginPath();
  ctx.moveTo(left + threadWidth * 0.2, top + threadWidth * 0.2);
  ctx.lineTo(right - threadWidth * 0.2, bottom - threadWidth * 0.2);
  ctx.stroke();

  // Add a subtle center highlight where threads cross
  ctx.fillStyle = `rgba(${lighterR}, ${lighterG}, ${lighterB}, 0.3)`;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, threadWidth * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Generate a thumbnail for file preview (200x200 max for fast loading, no grid)
export function generatePatternThumbnail(pattern: Pattern): string {
  return renderPatternPreview(pattern, 200, 200, { includeGrid: false });
}

// Render pattern at 1 pixel per stitch for smoothest PDF preview
// This creates the cleanest possible image that PDF can scale smoothly
function renderPatternPreviewSmooth(pattern: Pattern): string {
  const width = pattern.canvas.width;
  const height = pattern.canvas.height;

  // Use regular canvas for iOS compatibility (OffscreenCanvas may not be fully supported)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill with white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Create a color lookup map
  const colorMap = new Map<string, [number, number, number]>();
  for (const color of pattern.colorPalette) {
    colorMap.set(color.id, color.rgb);
  }

  // Render all visible layers - each stitch is exactly 1 pixel
  for (const layer of pattern.layers) {
    if (!layer.visible) continue;

    for (const stitch of layer.stitches) {
      const rgb = colorMap.get(stitch.colorId);
      if (!rgb) continue;

      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(stitch.x, stitch.y, 1, 1);
    }
  }

  return canvas.toDataURL('image/png');
}

// Render pattern preview to a data URL for embedding in PDF or thumbnails
// Export for use in generating file thumbnails
interface RenderOptions {
  includeGrid?: boolean;
  maxCellSize?: number; // Max cell size in pixels (default 8 for thumbnails, higher for PDF)
}

export function renderPatternPreview(pattern: Pattern, maxWidth: number, maxHeight: number, options: RenderOptions = {}): string {
  const { includeGrid = true, maxCellSize = 8 } = options;

  // Calculate cell size to fit within max dimensions
  const cellSizeForWidth = maxWidth / pattern.canvas.width;
  const cellSizeForHeight = maxHeight / pattern.canvas.height;
  const cellSize = Math.min(cellSizeForWidth, cellSizeForHeight, maxCellSize);

  const width = Math.round(pattern.canvas.width * cellSize);
  const height = Math.round(pattern.canvas.height * cellSize);

  // Use regular canvas for iOS compatibility (OffscreenCanvas may not be fully supported)
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill with white background for clean preview, or fabric color for grid view
  ctx.fillStyle = includeGrid ? '#F5F5F0' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Add subtle fabric texture grid (optional)
  if (includeGrid) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= pattern.canvas.width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, height);
      ctx.stroke();
    }
    for (let j = 0; j <= pattern.canvas.height; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellSize);
      ctx.lineTo(width, j * cellSize);
      ctx.stroke();
    }
  }

  // Create a color lookup map
  const colorMap = new Map<string, [number, number, number]>();
  for (const color of pattern.colorPalette) {
    colorMap.set(color.id, color.rgb);
  }

  // Render all visible layers (bottom to top)
  for (const layer of pattern.layers) {
    if (!layer.visible) continue;

    for (const stitch of layer.stitches) {
      const rgb = colorMap.get(stitch.colorId);
      if (!rgb) continue;

      const x = stitch.x * cellSize;
      const y = stitch.y * cellSize;

      // Use flat colors for clean preview (no grid), cross-stitch effect otherwise
      if (includeGrid) {
        drawCrossStitch(ctx, x, y, cellSize, rgb);
      } else {
        // Simple solid color square
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// Draw a symbol as vector shape in PDF (since default fonts don't support Unicode symbols)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawSymbolShape(
  pdf: any,
  symbol: string,
  cx: number, // center x
  cy: number, // center y
  size: number, // cell size
  rgb: [number, number, number] // contrast color for the symbol
): void {
  // Symbol size - larger for better visibility on small PDF cells
  const r = size * 0.32;
  const [sr, sg, sb] = rgb;
  pdf.setDrawColor(sr, sg, sb);
  pdf.setFillColor(sr, sg, sb);
  pdf.setLineWidth(size * 0.1);

  switch (symbol) {
    // Filled shapes
    case '●': // Black Circle
      pdf.circle(cx, cy, r, 'F');
      break;
    case '■': // Black Square
      pdf.rect(cx - r, cy - r, r * 2, r * 2, 'F');
      break;
    case '▲': // Black Triangle (pointing up)
      pdf.triangle(cx, cy - r, cx - r, cy + r * 0.7, cx + r, cy + r * 0.7, 'F');
      break;
    case '▼': // Black Triangle (pointing down)
      pdf.triangle(cx, cy + r, cx - r, cy - r * 0.7, cx + r, cy - r * 0.7, 'F');
      break;
    case '★': // Black Star (simplified as filled diamond rotated)
    case '◆': // Black Diamond
      pdf.triangle(cx, cy - r, cx - r, cy, cx, cy + r, 'F');
      pdf.triangle(cx, cy - r, cx + r, cy, cx, cy + r, 'F');
      break;
    case '♦': // Diamond Suit
      pdf.triangle(cx, cy - r * 0.9, cx - r * 0.6, cy, cx, cy + r * 0.9, 'F');
      pdf.triangle(cx, cy - r * 0.9, cx + r * 0.6, cy, cx, cy + r * 0.9, 'F');
      break;
    case '♥': // Heart Suit (simplified)
      pdf.circle(cx - r * 0.35, cy - r * 0.2, r * 0.45, 'F');
      pdf.circle(cx + r * 0.35, cy - r * 0.2, r * 0.45, 'F');
      pdf.triangle(cx, cy + r * 0.8, cx - r * 0.75, cy, cx + r * 0.75, cy, 'F');
      break;
    case '♠': // Spade Suit (simplified)
      pdf.triangle(cx, cy - r * 0.8, cx - r * 0.7, cy + r * 0.3, cx + r * 0.7, cy + r * 0.3, 'F');
      pdf.circle(cx - r * 0.35, cy + r * 0.15, r * 0.35, 'F');
      pdf.circle(cx + r * 0.35, cy + r * 0.15, r * 0.35, 'F');
      break;

    // Outline shapes
    case '○': // White Circle
      pdf.circle(cx, cy, r, 'S');
      break;
    case '□': // White Square
      pdf.rect(cx - r, cy - r, r * 2, r * 2, 'S');
      break;
    case '△': // White Triangle
      pdf.triangle(cx, cy - r, cx - r, cy + r * 0.7, cx + r, cy + r * 0.7, 'S');
      break;
    case '☆': // White Star (outline diamond)
    case '◇': // White Diamond
      pdf.line(cx, cy - r, cx - r, cy);
      pdf.line(cx - r, cy, cx, cy + r);
      pdf.line(cx, cy + r, cx + r, cy);
      pdf.line(cx + r, cy, cx, cy - r);
      break;

    // Cross shapes
    case '✕': // Multiplication X
      pdf.line(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7);
      pdf.line(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7);
      break;
    case '✚': // Heavy Greek Cross / Plus
      pdf.line(cx - r * 0.8, cy, cx + r * 0.8, cy);
      pdf.line(cx, cy - r * 0.8, cx, cy + r * 0.8);
      break;

    // Hexagon
    case '⬡': // White Hexagon
      {
        const hr = r * 0.9;
        const points = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          points.push([cx + hr * Math.cos(angle), cy + hr * Math.sin(angle)]);
        }
        pdf.line(points[0][0], points[0][1], points[1][0], points[1][1]);
        pdf.line(points[1][0], points[1][1], points[2][0], points[2][1]);
        pdf.line(points[2][0], points[2][1], points[3][0], points[3][1]);
        pdf.line(points[3][0], points[3][1], points[4][0], points[4][1]);
        pdf.line(points[4][0], points[4][1], points[5][0], points[5][1]);
        pdf.line(points[5][0], points[5][1], points[0][0], points[0][1]);
      }
      break;

    // Half circles
    case '◐': // Circle Left Half Black
      pdf.circle(cx, cy, r, 'S');
      // Fill left half with arc approximation
      pdf.setFillColor(sr, sg, sb);
      pdf.rect(cx - r, cy - r, r, r * 2, 'F');
      break;
    case '◑': // Circle Right Half Black
      pdf.circle(cx, cy, r, 'S');
      pdf.setFillColor(sr, sg, sb);
      pdf.rect(cx, cy - r, r, r * 2, 'F');
      break;
    case '◒': // Circle Bottom Half Black
      pdf.circle(cx, cy, r, 'S');
      pdf.setFillColor(sr, sg, sb);
      pdf.rect(cx - r, cy, r * 2, r, 'F');
      break;
    case '◓': // Circle Top Half Black
      pdf.circle(cx, cy, r, 'S');
      pdf.setFillColor(sr, sg, sb);
      pdf.rect(cx - r, cy - r, r * 2, r, 'F');
      break;

    // Circled/Squared symbols
    case '⊕': // Circled Plus
      pdf.circle(cx, cy, r, 'S');
      pdf.line(cx - r * 0.6, cy, cx + r * 0.6, cy);
      pdf.line(cx, cy - r * 0.6, cx, cy + r * 0.6);
      break;
    case '⊗': // Circled Times
      pdf.circle(cx, cy, r, 'S');
      pdf.line(cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5);
      pdf.line(cx - r * 0.5, cy + r * 0.5, cx + r * 0.5, cy - r * 0.5);
      break;
    case '⊞': // Squared Plus
      pdf.rect(cx - r, cy - r, r * 2, r * 2, 'S');
      pdf.line(cx - r * 0.6, cy, cx + r * 0.6, cy);
      pdf.line(cx, cy - r * 0.6, cx, cy + r * 0.6);
      break;
    case '⊠': // Squared Times
      pdf.rect(cx - r, cy - r, r * 2, r * 2, 'S');
      pdf.line(cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6);
      pdf.line(cx - r * 0.6, cy + r * 0.6, cx + r * 0.6, cy - r * 0.6);
      break;

    // Letters and numbers - use text (these are ASCII and supported)
    default:
      if (/^[A-Z0-9]$/.test(symbol)) {
        // ASCII characters - use text
        pdf.setTextColor(sr, sg, sb);
        pdf.setFontSize(size * 2);
        pdf.text(symbol, cx, cy + size * 0.12, { align: 'center' });
      } else {
        // Unknown symbol - draw a small dot
        pdf.circle(cx, cy, r * 0.3, 'F');
      }
      break;
  }
}

// Draw a symbol on canvas context
function drawSymbolOnCanvas(
  ctx: CanvasRenderingContext2D,
  symbol: string,
  cx: number,
  cy: number,
  cellSize: number,
  color: string
): void {
  // Smaller radius for more delicate symbols (matches color palette style)
  const r = cellSize * 0.22;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, cellSize * 0.06);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (symbol) {
    case '●':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case '■':
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      break;
    case '▲':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.lineTo(cx + r, cy + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case '▼':
      ctx.beginPath();
      ctx.moveTo(cx, cy + r);
      ctx.lineTo(cx - r, cy - r * 0.7);
      ctx.lineTo(cx + r, cy - r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    case '★':
    case '◆':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx + r, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case '♦':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.9);
      ctx.lineTo(cx - r * 0.6, cy);
      ctx.lineTo(cx, cy + r * 0.9);
      ctx.lineTo(cx + r * 0.6, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case '♥':
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.2, r * 0.45, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.35, cy - r * 0.2, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.8);
      ctx.lineTo(cx - r * 0.75, cy);
      ctx.lineTo(cx + r * 0.75, cy);
      ctx.closePath();
      ctx.fill();
      break;
    case '♠':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx - r * 0.7, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy + r * 0.15, r * 0.35, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.35, cy + r * 0.15, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    case '○':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case '□':
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      break;
    case '△':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r, cy + r * 0.7);
      ctx.lineTo(cx + r, cy + r * 0.7);
      ctx.closePath();
      ctx.stroke();
      break;
    case '☆':
    case '◇':
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx - r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx + r, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    case '✕':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
      ctx.moveTo(cx - r * 0.7, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
      ctx.stroke();
      break;
    case '✚':
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.8, cy);
      ctx.lineTo(cx + r * 0.8, cy);
      ctx.moveTo(cx, cy - r * 0.8);
      ctx.lineTo(cx, cy + r * 0.8);
      ctx.stroke();
      break;
    case '⬡':
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = cx + r * 0.9 * Math.cos(angle);
        const py = cy + r * 0.9 * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    case '◐':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      break;
    case '◑':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.fill();
      break;
    case '◒':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI);
      ctx.fill();
      break;
    case '◓':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
      ctx.fill();
      break;
    case '⊕':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy);
      ctx.lineTo(cx + r * 0.6, cy);
      ctx.moveTo(cx, cy - r * 0.6);
      ctx.lineTo(cx, cy + r * 0.6);
      ctx.stroke();
      break;
    case '⊗':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy - r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.5);
      ctx.moveTo(cx - r * 0.5, cy + r * 0.5);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.5);
      ctx.stroke();
      break;
    case '⊞':
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy);
      ctx.lineTo(cx + r * 0.7, cy);
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(cx, cy + r * 0.7);
      ctx.stroke();
      break;
    case '⊠':
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy - r * 0.7);
      ctx.lineTo(cx + r * 0.7, cy + r * 0.7);
      ctx.moveTo(cx - r * 0.7, cy + r * 0.7);
      ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
      ctx.stroke();
      break;
    default:
      if (/^[A-Z0-9]$/.test(symbol)) {
        ctx.font = `bold ${cellSize * 0.45}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, cx, cy);
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
}

// Render full chart as high-resolution image
function renderFullChartImage(
  pattern: Pattern,
  grid: (Stitch | null)[][],
  colorSymbols: Map<string, string>,
  includeGridNumbers: boolean
): string {
  // Use a readable cell size in pixels (30px gives good detail for symbols)
  const cellSize = 30;
  console.log('renderFullChartImage called - generating high-res chart at', cellSize, 'px per cell');
  const numberMargin = includeGridNumbers ? 25 : 0;

  const canvasWidth = pattern.canvas.width * cellSize + numberMargin;
  const canvasHeight = pattern.canvas.height * cellSize + numberMargin;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const offsetX = numberMargin;
  const offsetY = numberMargin;

  // Draw colored cells with symbols
  for (let y = 0; y < pattern.canvas.height; y++) {
    for (let x = 0; x < pattern.canvas.width; x++) {
      const cellX = offsetX + x * cellSize;
      const cellY = offsetY + y * cellSize;
      const stitch = grid[y]?.[x];

      if (stitch) {
        const color = pattern.colorPalette.find(c => c.id === stitch.colorId);
        if (color) {
          // Draw colored cell
          ctx.fillStyle = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);

          // Draw symbol
          const symbol = colorSymbols.get(color.id) || '?';
          const contrastColor = getContrastColor(color.rgb);
          drawSymbolOnCanvas(ctx, symbol, cellX + cellSize / 2, cellY + cellSize / 2, cellSize, contrastColor);
        }
      }
    }
  }

  // Draw grid lines (5x5 pattern like canvas)
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 0.5;

  for (let x = 0; x <= pattern.canvas.width; x++) {
    const lineX = offsetX + x * cellSize;
    const isThick = x % 5 === 0;
    ctx.strokeStyle = isThick ? '#666666' : '#CCCCCC';
    ctx.lineWidth = isThick ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(lineX, offsetY);
    ctx.lineTo(lineX, offsetY + pattern.canvas.height * cellSize);
    ctx.stroke();
  }

  for (let y = 0; y <= pattern.canvas.height; y++) {
    const lineY = offsetY + y * cellSize;
    const isThick = y % 5 === 0;
    ctx.strokeStyle = isThick ? '#666666' : '#CCCCCC';
    ctx.lineWidth = isThick ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(offsetX, lineY);
    ctx.lineTo(offsetX + pattern.canvas.width * cellSize, lineY);
    ctx.stroke();
  }

  // Draw outer border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, pattern.canvas.width * cellSize, pattern.canvas.height * cellSize);

  // Draw row/column numbers (every 5 to match grid)
  if (includeGridNumbers) {
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Column numbers (top)
    for (let x = 0; x < pattern.canvas.width; x++) {
      if (x === 0 || (x + 1) % 5 === 0 || x === pattern.canvas.width - 1) {
        const labelX = offsetX + x * cellSize + cellSize / 2;
        ctx.fillText(String(x + 1), labelX, numberMargin / 2);
      }
    }

    // Row numbers (left)
    ctx.textAlign = 'right';
    for (let y = 0; y < pattern.canvas.height; y++) {
      if (y === 0 || (y + 1) % 5 === 0 || y === pattern.canvas.height - 1) {
        const labelY = offsetY + y * cellSize + cellSize / 2;
        ctx.fillText(String(y + 1), numberMargin - 5, labelY);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// Render a grid section as high-resolution image (for detail pages)
function renderGridSectionImage(
  pattern: Pattern,
  grid: (Stitch | null)[][],
  colorSymbols: Map<string, string>,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  const cellSize = 30; // Same as overview page
  const width = endX - startX;
  const height = endY - startY;

  const canvas = document.createElement('canvas');
  canvas.width = width * cellSize;
  canvas.height = height * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw colored cells with symbols
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const cellX = (x - startX) * cellSize;
      const cellY = (y - startY) * cellSize;
      const stitch = grid[y]?.[x];

      if (stitch) {
        const color = pattern.colorPalette.find(c => c.id === stitch.colorId);
        if (color) {
          // Draw colored cell
          ctx.fillStyle = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
          ctx.fillRect(cellX, cellY, cellSize, cellSize);

          // Draw symbol
          const symbol = colorSymbols.get(color.id) || '?';
          const contrastColor = getContrastColor(color.rgb);
          drawSymbolOnCanvas(ctx, symbol, cellX + cellSize / 2, cellY + cellSize / 2, cellSize, contrastColor);
        }
      }
    }
  }

  // Draw grid lines (5x5 pattern)
  for (let x = 0; x <= width; x++) {
    const lineX = x * cellSize;
    const isThick = (startX + x) % 5 === 0;
    ctx.strokeStyle = isThick ? '#666666' : '#CCCCCC';
    ctx.lineWidth = isThick ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(lineX, 0);
    ctx.lineTo(lineX, height * cellSize);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y++) {
    const lineY = y * cellSize;
    const isThick = (startY + y) % 5 === 0;
    ctx.strokeStyle = isThick ? '#666666' : '#CCCCCC';
    ctx.lineWidth = isThick ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(width * cellSize, lineY);
    ctx.stroke();
  }

  // Draw outer border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, width * cellSize, height * cellSize);

  return canvas.toDataURL('image/png');
}

// Render a full chart page with high-resolution image
// Automatically uses landscape or portrait based on pattern dimensions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderFullChartPage(
  pdf: any,
  pattern: Pattern,
  grid: (Stitch | null)[][],
  colorSymbols: Map<string, string>,
  opts: ExportOptions
): void {
  // Determine orientation based on pattern aspect ratio
  const isWide = pattern.canvas.width > pattern.canvas.height;
  const orientation = isWide ? 'landscape' : 'portrait';

  // Add page with appropriate orientation
  pdf.addPage('a4', orientation);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Minimal margins for maximum image size (10mm for printability)
  const margin = 10;

  // Render chart as high-resolution image
  const chartImage = renderFullChartImage(pattern, grid, colorSymbols, opts.includeGridNumbers);

  // Calculate image dimensions to fit on page
  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin;

  // Calculate aspect ratio
  const numberMargin = opts.includeGridNumbers ? 25 : 0;
  const imageAspect = (pattern.canvas.width * 30 + numberMargin) / (pattern.canvas.height * 30 + numberMargin);

  let imgWidth: number;
  let imgHeight: number;

  if (imageAspect > availableWidth / availableHeight) {
    imgWidth = availableWidth;
    imgHeight = availableWidth / imageAspect;
  } else {
    imgHeight = availableHeight;
    imgWidth = availableHeight * imageAspect;
  }

  // Center on page
  const imgX = margin + (availableWidth - imgWidth) / 2;
  const imgY = margin + (availableHeight - imgHeight) / 2;

  pdf.addImage(chartImage, 'PNG', imgX, imgY, imgWidth, imgHeight);
}

export async function exportPatternToPdf(
  pattern: Pattern,
  options: Partial<ExportOptions> = {}
): Promise<ArrayBuffer> {
  // Dynamic import to avoid loading jsPDF at startup
  const { jsPDF } = await import('jspdf');

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const stitches = getAllStitches(pattern);
  const stitchCounts = countStitchesByColor(stitches);
  const grid = createStitchGrid(pattern);

  // Create color to symbol mapping - use assigned symbols or fallback to sequential
  const colorSymbols = new Map<string, string>();
  let fallbackIndex = 0;
  pattern.colorPalette.forEach((color) => {
    if (color.symbol) {
      colorSymbols.set(color.id, color.symbol);
    } else {
      // Use fallback symbol if none assigned
      colorSymbols.set(color.id, FALLBACK_SYMBOLS[fallbackIndex % FALLBACK_SYMBOLS.length]);
      fallbackIndex++;
    }
  });

  // Calculate page dimensions
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 2 * PAGE_MARGIN;
  const contentHeight = pageHeight - 2 * PAGE_MARGIN;

  // Calculate how many cells can fit per page
  const cellsPerPageX = Math.floor(contentWidth / CELL_SIZE_MM);
  const cellsPerPageY = Math.floor((contentHeight - HEADER_HEIGHT) / CELL_SIZE_MM);

  // Calculate number of pages needed
  const pagesX = Math.ceil(pattern.canvas.width / cellsPerPageX);
  const pagesY = Math.ceil(pattern.canvas.height / cellsPerPageY);
  const totalGridPages = pagesX * pagesY;

  let pageNum = 0;

  // Generate preview/cover page if requested
  if (opts.includePreviewPage) {
    pageNum++;

    // Title
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    const title = opts.title || pattern.name;
    pdf.text(title, pageWidth / 2, PAGE_MARGIN + 10, { align: 'center' });

    // Render and add preview image
    try {
      // Render at exactly 1 pixel per stitch for smoothest result
      // The PDF will scale this up smoothly without visible grid artifacts
      const previewDataUrl = renderPatternPreviewSmooth(pattern);

      // Calculate image dimensions in mm for PDF (fit within available area)
      const aspectRatio = pattern.canvas.width / pattern.canvas.height;
      let imgWidthMm: number;
      let imgHeightMm: number;

      if (aspectRatio > PREVIEW_MAX_WIDTH / PREVIEW_MAX_HEIGHT) {
        // Width constrained
        imgWidthMm = PREVIEW_MAX_WIDTH;
        imgHeightMm = PREVIEW_MAX_WIDTH / aspectRatio;
      } else {
        // Height constrained
        imgHeightMm = PREVIEW_MAX_HEIGHT;
        imgWidthMm = PREVIEW_MAX_HEIGHT * aspectRatio;
      }

      // Center the image horizontally
      const imgX = (pageWidth - imgWidthMm) / 2;
      const imgY = PAGE_MARGIN + 25;

      pdf.addImage(previewDataUrl, 'PNG', imgX, imgY, imgWidthMm, imgHeightMm);

      // Add border around preview
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.5);
      pdf.rect(imgX, imgY, imgWidthMm, imgHeightMm, 'S');

      // Pattern information section
      const infoStartY = imgY + imgHeightMm + 15;

      // Calculate physical dimensions
      const physicalWidthInches = pattern.canvas.width / pattern.canvas.meshCount;
      const physicalHeightInches = pattern.canvas.height / pattern.canvas.meshCount;
      const physicalWidthMm = physicalWidthInches * MM_PER_INCH;
      const physicalHeightMm = physicalHeightInches * MM_PER_INCH;

      // Section: Size Information
      pdf.setFontSize(14);
      pdf.setTextColor(50, 50, 50);
      pdf.text('Pattern Information', PAGE_MARGIN, infoStartY);

      pdf.setFontSize(FONT_SIZE_INFO);
      pdf.setTextColor(80, 80, 80);

      const leftCol = PAGE_MARGIN;
      const rightCol = pageWidth / 2 + 10;
      let lineY = infoStartY + 10;
      const lineHeight = 6;

      // Left column - Size info
      pdf.setTextColor(100, 100, 100);
      pdf.text('Stitch Count:', leftCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${pattern.canvas.width} x ${pattern.canvas.height} stitches`, leftCol + 28, lineY);

      lineY += lineHeight;
      pdf.setTextColor(100, 100, 100);
      pdf.text('Mesh Count:', leftCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${pattern.canvas.meshCount} count (holes per inch)`, leftCol + 28, lineY);

      lineY += lineHeight;
      pdf.setTextColor(100, 100, 100);
      pdf.text('Physical Size:', leftCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(
        `${physicalWidthInches.toFixed(1)}" x ${physicalHeightInches.toFixed(1)}" (${physicalWidthMm.toFixed(0)} x ${physicalHeightMm.toFixed(0)} mm)`,
        leftCol + 28,
        lineY
      );

      // Right column - Stitch info
      lineY = infoStartY + 10;
      pdf.setTextColor(100, 100, 100);
      pdf.text('Total Stitches:', rightCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${stitches.length.toLocaleString()}`, rightCol + 28, lineY);

      lineY += lineHeight;
      pdf.setTextColor(100, 100, 100);
      pdf.text('Colors Used:', rightCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${stitchCounts.size}`, rightCol + 28, lineY);

      lineY += lineHeight;
      pdf.setTextColor(100, 100, 100);
      pdf.text('Pattern Pages:', rightCol, lineY);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${totalGridPages}`, rightCol + 28, lineY);

      // Footer with generation date
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      const date = new Date().toLocaleDateString();
      pdf.text(`Generated on ${date} with StitchALot Studio`, pageWidth / 2, pageHeight - PAGE_MARGIN, {
        align: 'center',
      });
    } catch (error) {
      console.error('Failed to render preview image:', error);
      // Continue without preview image
      pdf.setFontSize(FONT_SIZE_INFO);
      pdf.setTextColor(100, 100, 100);
      pdf.text('(Preview image could not be generated)', pageWidth / 2, PAGE_MARGIN + 60, { align: 'center' });
    }
  }

  // Generate full chart page if requested (entire pattern on one page)
  // This function adds its own page with automatic orientation (landscape/portrait)
  if (opts.includeFullChartPage) {
    renderFullChartPage(pdf, pattern, grid, colorSymbols, opts);
    pageNum++;
  }

  // Generate grid pages
  for (let pageY = 0; pageY < pagesY; pageY++) {
    for (let pageX = 0; pageX < pagesX; pageX++) {
      if (pageNum > 0) {
        pdf.addPage();
      }
      pageNum++;

      const startX = pageX * cellsPerPageX;
      const startY = pageY * cellsPerPageY;
      const endX = Math.min(startX + cellsPerPageX, pattern.canvas.width);
      const endY = Math.min(startY + cellsPerPageY, pattern.canvas.height);

      // Draw header
      pdf.setFontSize(FONT_SIZE_TITLE);
      pdf.setTextColor(0, 0, 0);
      const title = opts.title || pattern.name;
      pdf.text(title, PAGE_MARGIN, PAGE_MARGIN + 5);

      pdf.setFontSize(FONT_SIZE_INFO);
      pdf.text(
        `Page ${pageNum} of ${pagesX * pagesY} | Columns ${startX + 1}-${endX} | Rows ${startY + 1}-${endY}`,
        PAGE_MARGIN,
        PAGE_MARGIN + 12
      );
      pdf.text(
        `${pattern.canvas.width} x ${pattern.canvas.height} stitches | ${pattern.canvas.meshCount} count`,
        PAGE_MARGIN,
        PAGE_MARGIN + 18
      );

      const gridStartY = PAGE_MARGIN + HEADER_HEIGHT;
      const gridStartX = PAGE_MARGIN + (opts.includeGridNumbers ? 8 : 0);

      // Render grid section as canvas image (same as overview page)
      const sectionImage = renderGridSectionImage(pattern, grid, colorSymbols, startX, startY, endX, endY);

      // Calculate image size to fit available space
      const sectionWidth = endX - startX;
      const sectionHeight = endY - startY;
      const availableWidth = contentWidth - (opts.includeGridNumbers ? 8 : 0);
      const availableHeight = contentHeight - HEADER_HEIGHT;

      // Scale to fit while maintaining aspect ratio
      const imageAspect = sectionWidth / sectionHeight;
      let imgWidth: number;
      let imgHeight: number;

      if (imageAspect > availableWidth / availableHeight) {
        imgWidth = availableWidth;
        imgHeight = availableWidth / imageAspect;
      } else {
        imgHeight = availableHeight;
        imgWidth = availableHeight * imageAspect;
      }

      // Add the image
      pdf.addImage(sectionImage, 'PNG', gridStartX, gridStartY, imgWidth, imgHeight);

      // Draw column numbers on top of image
      if (opts.includeGridNumbers) {
        const cellSizeMm = imgWidth / sectionWidth;
        pdf.setFontSize(FONT_SIZE_GRID);
        pdf.setTextColor(100, 100, 100);
        for (let x = startX; x < endX; x++) {
          const cellX = gridStartX + (x - startX) * cellSizeMm;
          if ((x + 1) % 5 === 0 || x === startX) {
            pdf.text(
              String(x + 1),
              cellX + cellSizeMm / 2,
              gridStartY - 2,
              { align: 'center' }
            );
          }
        }

        // Draw row numbers
        const cellSizeMMY = imgHeight / sectionHeight;
        for (let y = startY; y < endY; y++) {
          if ((y + 1) % 5 === 0 || y === startY) {
            const cellY = gridStartY + (y - startY) * cellSizeMMY;
            pdf.text(String(y + 1), PAGE_MARGIN, cellY + cellSizeMMY / 2 + 1);
          }
        }
      }
    }
  }

  // Add color legend page if requested
  // Only include colors that are actually used on the canvas
  const usedColors = pattern.colorPalette.filter(color => stitchCounts.has(color.id));

  if (opts.includeColorLegend && usedColors.length > 0) {
    pdf.addPage();
    pageNum++;

    pdf.setFontSize(FONT_SIZE_TITLE);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Color Legend', PAGE_MARGIN, PAGE_MARGIN + 5);

    pdf.setFontSize(FONT_SIZE_INFO);
    pdf.text(
      `${usedColors.length} colors | ${stitches.length} total stitches`,
      PAGE_MARGIN,
      PAGE_MARGIN + 12
    );

    let legendY = PAGE_MARGIN + 25;
    const legendX = PAGE_MARGIN;
    const colWidth = contentWidth / 2;

    for (let i = 0; i < usedColors.length; i++) {
      const color = usedColors[i];
      const count = stitchCounts.get(color.id) || 0;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = legendX + col * colWidth;
      const y = legendY + row * (LEGEND_CELL_SIZE + 4);

      // Check if we need a new page
      if (y + LEGEND_CELL_SIZE > pageHeight - PAGE_MARGIN) {
        pdf.addPage();
        legendY = PAGE_MARGIN + 10;
        continue;
      }

      // Draw color swatch
      pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
      pdf.rect(x, y, LEGEND_CELL_SIZE, LEGEND_CELL_SIZE, 'F');
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, LEGEND_CELL_SIZE, LEGEND_CELL_SIZE, 'S');

      // Draw symbol if using symbols
      if (opts.useSymbols) {
        const symbol = colorSymbols.get(color.id) || '?';
        const contrastColor = getContrastColor(color.rgb);
        const contrastRgb: [number, number, number] = [
          parseInt(contrastColor.slice(1, 3), 16),
          parseInt(contrastColor.slice(3, 5), 16),
          parseInt(contrastColor.slice(5, 7), 16)
        ];
        drawSymbolShape(pdf, symbol, x + LEGEND_CELL_SIZE / 2, y + LEGEND_CELL_SIZE / 2, LEGEND_CELL_SIZE, contrastRgb);
      }

      // Draw color info
      pdf.setFontSize(FONT_SIZE_LEGEND);
      pdf.setTextColor(0, 0, 0);
      const textX = x + LEGEND_CELL_SIZE + 3;
      let colorText = color.name;
      if (color.threadBrand && color.threadCode) {
        colorText += ` (${color.threadBrand} ${color.threadCode})`;
      }
      pdf.text(colorText, textX, y + 3);

      if (opts.includeStitchCounts) {
        pdf.setTextColor(100, 100, 100);
        pdf.text(`${count} stitches`, textX, y + 7);
      }
    }
  }

  // Add watermark to all pages if in trial mode
  if (opts.shouldWatermark) {
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      addTrialWatermark(pdf, pageWidth, pageHeight);
    }
  }

  // Return the PDF as ArrayBuffer for saving via Tauri dialog
  return pdf.output('arraybuffer');
}
