/**
 * Canvas Mesh Pattern Generator
 * Creates realistic woven needlepoint canvas
 *
 * Structure (from reference images):
 * - Each cell has a CROSS-shaped thread area (not a square)
 * - Holes are at the 4 CORNERS of each cell
 * - Stitch color fills the CROSS shape, leaving corners empty
 */

export interface CanvasColors {
  thread: string;
  threadHighlight: string;
  threadShadow: string;
  hole: string;
}

export const CANVAS_COLOR_PRESETS: Record<string, CanvasColors> = {
  white: {
    thread: '#D8D8D8',
    threadHighlight: '#F0F0F0',
    threadShadow: '#B0B0B0',
    hole: '#909090',
  },
  ecru: {
    thread: '#D8D5CD',
    threadHighlight: '#F0EDE5',
    threadShadow: '#B0A8A0',
    hole: '#908880',
  },
};

export function getCanvasColors(colorNameOrHex: string): CanvasColors {
  if (CANVAS_COLOR_PRESETS[colorNameOrHex]) {
    return CANVAS_COLOR_PRESETS[colorNameOrHex];
  }
  return CANVAS_COLOR_PRESETS.white;
}

/**
 * Calculate the hole/corner size based on cell size
 * This determines how much of each corner is "cut off" from the cross
 */
function getHoleSize(cellSize: number, meshCount: number): number {
  // Holes are about 20-25% of cell size
  const baseRatio = 0.22;
  const adjustment = Math.max(0, (meshCount - 14) * 0.005);
  return Math.max(2, cellSize * Math.max(0.15, baseRatio - adjustment));
}

/**
 * Draw a CROSS-shaped stitch in a cell
 * The cross covers thread areas, corners (holes) are left empty
 *
 * Visual:
 *   ██████
 *   ██████
 * ██████████████
 * ██████████████
 *   ██████
 *   ██████
 */
export function drawCrossStitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  color: string,
  meshCount: number
): void {
  const holeSize = getHoleSize(cellSize, meshCount);
  const left = x * cellSize;
  const top = y * cellSize;

  ctx.fillStyle = color;

  // Horizontal bar of the cross (full width, but not full height)
  // Leaves top and bottom corners empty
  ctx.fillRect(
    left,
    top + holeSize,
    cellSize,
    cellSize - holeSize * 2
  );

  // Vertical bar of the cross (full height, but not full width)
  // Leaves left and right corners empty
  ctx.fillRect(
    left + holeSize,
    top,
    cellSize - holeSize * 2,
    cellSize
  );
}

/**
 * Draw the empty canvas background showing the woven thread pattern
 */
export function drawEmptyCanvasBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number,
  canvasColor: string,
  meshCount: number
): void {
  const colors = getCanvasColors(canvasColor);
  const holeSize = getHoleSize(cellSize, meshCount);

  // Draw each cell's thread cross pattern
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      const horizontalOnTop = (row + col) % 2 === 0;

      // Draw the cross-shaped thread area with weave shading
      drawThreadCross(ctx, x, y, cellSize, holeSize, colors, horizontalOnTop);
    }
  }

  // Draw holes at all corners
  ctx.fillStyle = colors.hole;
  for (let row = 0; row <= height; row++) {
    for (let col = 0; col <= width; col++) {
      ctx.fillRect(
        col * cellSize - holeSize / 2,
        row * cellSize - holeSize / 2,
        holeSize,
        holeSize
      );
    }
  }
}

/**
 * Draw a cross-shaped thread pattern for an empty cell
 */
function drawThreadCross(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  holeSize: number,
  colors: CanvasColors,
  horizontalOnTop: boolean
): void {
  // Draw the under thread first, then the over thread
  if (horizontalOnTop) {
    // Vertical thread (under)
    drawVerticalBar(ctx, x, y, cellSize, holeSize, colors, false);
    // Horizontal thread (over)
    drawHorizontalBar(ctx, x, y, cellSize, holeSize, colors, true);
  } else {
    // Horizontal thread (under)
    drawHorizontalBar(ctx, x, y, cellSize, holeSize, colors, false);
    // Vertical thread (over)
    drawVerticalBar(ctx, x, y, cellSize, holeSize, colors, true);
  }
}

/**
 * Draw horizontal bar of the cross
 */
function drawHorizontalBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  holeSize: number,
  colors: CanvasColors,
  isOnTop: boolean
): void {
  const barHeight = cellSize - holeSize * 2;
  const barY = y + holeSize;

  // Main thread color
  ctx.fillStyle = colors.thread;
  ctx.fillRect(x, barY, cellSize, barHeight);

  // Highlight on top edge
  ctx.fillStyle = colors.threadHighlight;
  ctx.fillRect(x, barY, cellSize, barHeight * 0.25);

  // Shadow on bottom edge (if on top)
  if (isOnTop) {
    ctx.fillStyle = colors.threadShadow;
    ctx.fillRect(x, barY + barHeight * 0.75, cellSize, barHeight * 0.25);
  }
}

/**
 * Draw vertical bar of the cross
 */
function drawVerticalBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  holeSize: number,
  colors: CanvasColors,
  isOnTop: boolean
): void {
  const barWidth = cellSize - holeSize * 2;
  const barX = x + holeSize;

  // Main thread color
  ctx.fillStyle = colors.thread;
  ctx.fillRect(barX, y, barWidth, cellSize);

  // Highlight on left edge
  ctx.fillStyle = colors.threadHighlight;
  ctx.fillRect(barX, y, barWidth * 0.25, cellSize);

  // Shadow on right edge (if on top)
  if (isOnTop) {
    ctx.fillStyle = colors.threadShadow;
    ctx.fillRect(barX + barWidth * 0.75, y, barWidth * 0.25, cellSize);
  }
}

/**
 * Draw mesh overlay - just the holes on top of stitches
 */
export function drawMeshOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cellSize: number,
  canvasColor: string,
  meshCount: number = 18
): void {
  const colors = getCanvasColors(canvasColor);
  const holeSize = getHoleSize(cellSize, meshCount);

  // Draw holes at all grid intersections (corners)
  ctx.fillStyle = colors.hole;
  for (let row = 0; row <= height; row++) {
    for (let col = 0; col <= width; col++) {
      ctx.fillRect(
        col * cellSize - holeSize / 2,
        row * cellSize - holeSize / 2,
        holeSize,
        holeSize
      );
    }
  }
}

/**
 * Clear the mesh tile cache
 */
export function clearMeshCache(): void {
  // No cache needed anymore since we draw directly
}
