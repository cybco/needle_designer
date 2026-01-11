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
  includeColorLegend: boolean;
  includeStitchCounts: boolean;
  includeGridNumbers: boolean;
  useSymbols: boolean; // Use symbols instead of colors (for B&W printing)
  title?: string;
  shouldWatermark?: boolean; // Add trial watermark to all pages
}

const DEFAULT_OPTIONS: ExportOptions = {
  includePreviewPage: true,
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

// Add trial watermark to a PDF page
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addTrialWatermark(pdf: any, pageWidth: number, pageHeight: number): void {
  // Save current graphics state
  pdf.saveGraphicsState();

  // Set watermark style - semi-transparent gray
  pdf.setGState(new pdf.GState({ opacity: 0.15 }));
  pdf.setFontSize(40);
  pdf.setTextColor(128, 128, 128);

  // Draw diagonal watermark text across the page
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;

  // Calculate rotation angle (diagonal from bottom-left to top-right)
  const angle = Math.atan2(pageHeight, pageWidth) * (180 / Math.PI);

  pdf.text(WATERMARK_TEXT, centerX, centerY, {
    align: 'center',
    angle: angle,
  });

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
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
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

// Render pattern preview to a data URL for embedding in PDF
function renderPatternPreview(pattern: Pattern, maxWidth: number, maxHeight: number): string {
  // Calculate cell size to fit within max dimensions
  const cellSizeForWidth = maxWidth / pattern.canvas.width;
  const cellSizeForHeight = maxHeight / pattern.canvas.height;
  const cellSize = Math.min(cellSizeForWidth, cellSizeForHeight, 8); // Cap at 8px per cell for reasonable quality

  const width = Math.round(pattern.canvas.width * cellSize);
  const height = Math.round(pattern.canvas.height * cellSize);

  // Create offscreen canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Fill with canvas/fabric background color
  ctx.fillStyle = '#F5F5F0';
  ctx.fillRect(0, 0, width, height);

  // Add subtle fabric texture grid
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

      drawCrossStitch(ctx, x, y, cellSize, rgb);
    }
  }

  // Use synchronous approach via ImageData for compatibility
  const imageData = ctx.getImageData(0, 0, width, height);

  // Create a regular canvas to convert to data URL
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new Error('Failed to get temp canvas context');
  }
  tempCtx.putImageData(imageData, 0, 0);

  return tempCanvas.toDataURL('image/png');
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
      // Calculate pixel dimensions for high quality (aim for ~400-600px on longest side)
      const maxPixels = 600;
      const scaleFactor = maxPixels / Math.max(pattern.canvas.width, pattern.canvas.height);
      const previewPixelWidth = Math.round(pattern.canvas.width * scaleFactor);
      const previewPixelHeight = Math.round(pattern.canvas.height * scaleFactor);

      const previewDataUrl = renderPatternPreview(pattern, previewPixelWidth, previewPixelHeight);

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
      pdf.text(`Generated on ${date} with Stitch A Lot Studio`, pageWidth / 2, pageHeight - PAGE_MARGIN, {
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

      // Draw column numbers
      if (opts.includeGridNumbers) {
        pdf.setFontSize(FONT_SIZE_GRID);
        pdf.setTextColor(100, 100, 100);
        for (let x = startX; x < endX; x++) {
          const cellX = gridStartX + (x - startX) * CELL_SIZE_MM;
          if ((x + 1) % 10 === 0 || x === startX) {
            pdf.text(
              String(x + 1),
              cellX + CELL_SIZE_MM / 2,
              gridStartY - 2,
              { align: 'center' }
            );
          }
        }
      }

      // Draw row numbers and grid
      for (let y = startY; y < endY; y++) {
        const cellY = gridStartY + (y - startY) * CELL_SIZE_MM;

        // Row number
        if (opts.includeGridNumbers && ((y + 1) % 10 === 0 || y === startY)) {
          pdf.setFontSize(FONT_SIZE_GRID);
          pdf.setTextColor(100, 100, 100);
          pdf.text(String(y + 1), PAGE_MARGIN, cellY + CELL_SIZE_MM / 2 + 1);
        }

        // Draw cells
        for (let x = startX; x < endX; x++) {
          const cellX = gridStartX + (x - startX) * CELL_SIZE_MM;
          const stitch = grid[y]?.[x];

          if (stitch) {
            const color = pattern.colorPalette.find(c => c.id === stitch.colorId);
            if (color) {
              if (opts.useSymbols) {
                // Draw symbol
                pdf.setFillColor(255, 255, 255);
                pdf.rect(cellX, cellY, CELL_SIZE_MM, CELL_SIZE_MM, 'F');
                pdf.setFontSize(FONT_SIZE_GRID);
                pdf.setTextColor(0, 0, 0);
                const symbol = colorSymbols.get(color.id) || '?';
                pdf.text(symbol, cellX + CELL_SIZE_MM / 2, cellY + CELL_SIZE_MM / 2 + 0.8, {
                  align: 'center',
                });
              } else {
                // Draw colored cell
                pdf.setFillColor(color.rgb[0], color.rgb[1], color.rgb[2]);
                pdf.rect(cellX, cellY, CELL_SIZE_MM, CELL_SIZE_MM, 'F');
              }
            }
          }

          // Draw cell border
          pdf.setDrawColor(200, 200, 200);
          pdf.setLineWidth(0.1);
          pdf.rect(cellX, cellY, CELL_SIZE_MM, CELL_SIZE_MM, 'S');

          // Draw thicker lines every 10 cells
          if ((x + 1) % 10 === 0 && x < endX - 1) {
            pdf.setDrawColor(100, 100, 100);
            pdf.setLineWidth(0.3);
            pdf.line(cellX + CELL_SIZE_MM, cellY, cellX + CELL_SIZE_MM, cellY + CELL_SIZE_MM);
          }
        }

        // Draw thicker lines every 10 rows
        if ((y + 1) % 10 === 0 && y < endY - 1) {
          pdf.setDrawColor(100, 100, 100);
          pdf.setLineWidth(0.3);
          pdf.line(
            gridStartX,
            cellY + CELL_SIZE_MM,
            gridStartX + (endX - startX) * CELL_SIZE_MM,
            cellY + CELL_SIZE_MM
          );
        }
      }

      // Draw outer border
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.rect(
        gridStartX,
        gridStartY,
        (endX - startX) * CELL_SIZE_MM,
        (endY - startY) * CELL_SIZE_MM,
        'S'
      );
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
        pdf.setFontSize(FONT_SIZE_LEGEND);
        const contrastColor = getContrastColor(color.rgb);
        pdf.setTextColor(
          parseInt(contrastColor.slice(1, 3), 16),
          parseInt(contrastColor.slice(3, 5), 16),
          parseInt(contrastColor.slice(5, 7), 16)
        );
        pdf.text(symbol, x + LEGEND_CELL_SIZE / 2, y + LEGEND_CELL_SIZE / 2 + 1, {
          align: 'center',
        });
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
