import { Pattern, Stitch } from '../stores/patternStore';

// PDF export settings
const PAGE_MARGIN = 20; // mm
const CELL_SIZE_MM = 3; // Size of each stitch cell in mm
const HEADER_HEIGHT = 25; // mm for title and info
const LEGEND_CELL_SIZE = 8; // mm for color legend squares
const FONT_SIZE_TITLE = 16;
const FONT_SIZE_INFO = 10;
const FONT_SIZE_LEGEND = 8;
const FONT_SIZE_GRID = 6;

// Symbols for different colors (used when printing in B&W)
const SYMBOLS = [
  '\u25A0', // Black square
  '\u25CF', // Black circle
  '\u25B2', // Black triangle
  '\u25C6', // Black diamond
  '\u2605', // Star
  '\u2665', // Heart
  '\u2660', // Spade
  '\u2663', // Club
  '\u25CB', // White circle
  '\u25A1', // White square
  '\u25B3', // White triangle
  '\u25C7', // White diamond
  '\u2606', // White star
  '+',
  'X',
  '/',
  '\\',
  '-',
  '|',
  'O',
];

interface ExportOptions {
  includeColorLegend: boolean;
  includeStitchCounts: boolean;
  includeGridNumbers: boolean;
  useSymbols: boolean; // Use symbols instead of colors (for B&W printing)
  title?: string;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeColorLegend: true,
  includeStitchCounts: true,
  includeGridNumbers: true,
  useSymbols: false,
};

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

  // Create color to symbol mapping
  const colorSymbols = new Map<string, string>();
  pattern.colorPalette.forEach((color, index) => {
    colorSymbols.set(color.id, SYMBOLS[index % SYMBOLS.length]);
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

  let pageNum = 0;

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

  // Return the PDF as ArrayBuffer for saving via Tauri dialog
  return pdf.output('arraybuffer');
}
