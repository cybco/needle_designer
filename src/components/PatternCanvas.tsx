import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { usePatternStore, ResizeHandle, Color, CirclePosition, getCirclePositionFromClick, StitchType, Stitch, isHalfSquareType, isBorderType, isCrossType } from '../stores/patternStore';

const CELL_SIZE = 20; // Base cell size in pixels
const RULER_SIZE = 24; // Width/height of rulers in pixels
const HANDLE_SIZE = 8; // Size of resize handles in pixels
const SCROLLBAR_SIZE = 14; // Width/height of scrollbars
const CIRCLE_RADIUS_FACTOR = 0.28; // Circle radius relative to cell size (25% larger than half cell)

// Helper to get circle center offset within a cell based on position
function getCircleCenterOffset(position: CirclePosition): { dx: number; dy: number } {
  switch (position) {
    case 'top-left':     return { dx: 0, dy: 0 };
    case 'top-center':   return { dx: 0.5, dy: 0 };
    case 'top-right':    return { dx: 1, dy: 0 };
    case 'middle-left':  return { dx: 0, dy: 0.5 };
    case 'center':       return { dx: 0.5, dy: 0.5 };
    case 'middle-right': return { dx: 1, dy: 0.5 };
    case 'bottom-left':  return { dx: 0, dy: 1 };
    case 'bottom-center':return { dx: 0.5, dy: 1 };
    case 'bottom-right': return { dx: 1, dy: 1 };
    default:             return { dx: 0.5, dy: 0.5 }; // Default to center
  }
}

// Helper to get the center point of a partial-square shape for symbol placement
function getHalfSquareCentroid(
  type: StitchType,
  x: number,
  y: number,
  cellSize: number
): { cx: number; cy: number } {
  const left = x * cellSize;
  const top = y * cellSize;
  const right = left + cellSize;
  const bottom = top + cellSize;
  const midX = left + cellSize / 2;
  const midY = top + cellSize / 2;

  switch (type) {
    // Triangle centroids (average of three vertices)
    case 'half-tl': // Vertices: (left, top), (right, top), (left, bottom)
      return { cx: (left + right + left) / 3, cy: (top + top + bottom) / 3 };
    case 'half-tr': // Vertices: (left, top), (right, top), (right, bottom)
      return { cx: (left + right + right) / 3, cy: (top + top + bottom) / 3 };
    case 'half-bl': // Vertices: (left, top), (left, bottom), (right, bottom)
      return { cx: (left + left + right) / 3, cy: (top + bottom + bottom) / 3 };
    case 'half-br': // Vertices: (right, top), (left, bottom), (right, bottom)
      return { cx: (right + left + right) / 3, cy: (top + bottom + bottom) / 3 };
    // Half rectangle centers
    case 'half-top':
      return { cx: midX, cy: top + cellSize / 4 };
    case 'half-bottom':
      return { cx: midX, cy: bottom - cellSize / 4 };
    case 'half-left':
      return { cx: left + cellSize / 4, cy: midY };
    case 'half-right':
      return { cx: right - cellSize / 4, cy: midY };
    // Quarter square centers
    case 'quarter-tl':
      return { cx: left + cellSize / 4, cy: top + cellSize / 4 };
    case 'quarter-tr':
      return { cx: right - cellSize / 4, cy: top + cellSize / 4 };
    case 'quarter-bl':
      return { cx: left + cellSize / 4, cy: bottom - cellSize / 4 };
    case 'quarter-br':
      return { cx: right - cellSize / 4, cy: bottom - cellSize / 4 };
    // Border centers (borders are thin, so center symbol in middle of border)
    case 'border-top':
      return { cx: midX, cy: top + cellSize * 0.1 };
    case 'border-bottom':
      return { cx: midX, cy: bottom - cellSize * 0.1 };
    case 'border-left':
      return { cx: left + cellSize * 0.1, cy: midY };
    case 'border-right':
      return { cx: right - cellSize * 0.1, cy: midY };
    default:
      return { cx: midX, cy: midY };
  }
}

// Helper to draw partial-square shape on canvas (triangle, rectangle, or quarter)
function drawHalfSquare(
  ctx: CanvasRenderingContext2D,
  type: StitchType,
  x: number,
  y: number,
  cellSize: number,
  fillStyle: string
) {
  const left = x * cellSize;
  const top = y * cellSize;
  const right = left + cellSize;
  const bottom = top + cellSize;
  const midX = left + cellSize / 2;
  const midY = top + cellSize / 2;

  ctx.fillStyle = fillStyle;

  switch (type) {
    // Triangles
    case 'half-tl': // Top-left corner - diagonal from top-left to bottom-right
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.fill();
      break;
    case 'half-tr': // Top-right corner - diagonal from top-right to bottom-left
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.fill();
      break;
    case 'half-bl': // Bottom-left corner - diagonal from bottom-left to top-right
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.fill();
      break;
    case 'half-br': // Bottom-right corner - diagonal from bottom-right to top-left
      ctx.beginPath();
      ctx.moveTo(right, top);
      ctx.lineTo(left, bottom);
      ctx.lineTo(right, bottom);
      ctx.closePath();
      ctx.fill();
      break;
    // Half rectangles (horizontal/vertical halves)
    case 'half-top':
      ctx.fillRect(left, top, cellSize, cellSize / 2);
      break;
    case 'half-bottom':
      ctx.fillRect(left, midY, cellSize, cellSize / 2);
      break;
    case 'half-left':
      ctx.fillRect(left, top, cellSize / 2, cellSize);
      break;
    case 'half-right':
      ctx.fillRect(midX, top, cellSize / 2, cellSize);
      break;
    // Quarter squares
    case 'quarter-tl':
      ctx.fillRect(left, top, cellSize / 2, cellSize / 2);
      break;
    case 'quarter-tr':
      ctx.fillRect(midX, top, cellSize / 2, cellSize / 2);
      break;
    case 'quarter-bl':
      ctx.fillRect(left, midY, cellSize / 2, cellSize / 2);
      break;
    case 'quarter-br':
      ctx.fillRect(midX, midY, cellSize / 2, cellSize / 2);
      break;
    // Borders (thin rectangles along edges, extend slightly beyond cell)
    // Border thickness is ~20% of cell, extends 10% beyond each end
    case 'border-top': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedRect(ctx, left - extend, top, cellSize + extend * 2, thickness, thickness / 2);
      break;
    }
    case 'border-bottom': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedRect(ctx, left - extend, bottom - thickness, cellSize + extend * 2, thickness, thickness / 2);
      break;
    }
    case 'border-left': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedRect(ctx, left, top - extend, thickness, cellSize + extend * 2, thickness / 2);
      break;
    }
    case 'border-right': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedRect(ctx, right - thickness, top - extend, thickness, cellSize + extend * 2, thickness / 2);
      break;
    }
    // Cross lines (diagonal lines from corner to corner, extend beyond cell)
    case 'cross-tlbr': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedLine(ctx, left - extend, top - extend, right + extend, bottom + extend, thickness);
      break;
    }
    case 'cross-trbl': {
      const extend = cellSize * 0.1;
      const thickness = cellSize * 0.2;
      drawRoundedLine(ctx, right + extend, top - extend, left - extend, bottom + extend, thickness);
      break;
    }
    // Full circle (fills entire cell like square but with circle shape)
    case 'circle-full': {
      const radius = cellSize * 0.45;
      ctx.beginPath();
      ctx.arc(midX, midY, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

// Helper to draw a rounded line (thick line with rounded ends)
// Uses fillStyle as the stroke color for consistency with other shapes
function drawRoundedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number
) {
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineWidth = thickness;
  // Use fillStyle as the stroke color (fillStyle is set before calling this)
  ctx.strokeStyle = ctx.fillStyle;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Reset line cap
  ctx.lineCap = 'butt';
}

// Helper to draw a rounded rectangle
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

interface PatternCanvasProps {
  showSymbols?: boolean;
  showCenterMarker?: boolean;
}

export function PatternCanvas({ showSymbols = true, showCenterMarker = true }: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const rightRulerRef = useRef<HTMLCanvasElement>(null);
  // Debounce ref for progress mode toggles (prevents double-toggle from touch + synthetic mouse)
  const lastToggleRef = useRef<{ x: number; y: number; time: number } | null>(null);
  // Track if we're in a touch interaction to completely block mouse events
  const isTouchActiveRef = useRef(false);
  // Progress mode drag state: tracks the target completion state and last cell processed
  const progressDragRef = useRef<{ targetState: boolean; lastCellX: number; lastCellY: number } | null>(null);
  // Block fill drag state: tracks the target completion state and last block processed
  const blockFillDragRef = useRef<{ targetState: boolean; lastBlockX: number; lastBlockY: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [lastCell, setLastCell] = useState<{ x: number; y: number; type?: StitchType } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  // Shape drawing state
  const [shapeStart, setShapeStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeEnd, setShapeEnd] = useState<{ x: number; y: number } | null>(null);

  const {
    pattern,
    selectedColorId,
    activeTool,
    zoom,
    panOffset,
    showGrid,
    gridDivisions,
    rulerUnit,
    selection,
    overlayImages,
    selectedOverlayId,
    setStitch,
    fillArea,
    drawLine,
    drawRectangle,
    drawEllipse,
    setZoom,
    setPanOffset,
    selectLayerForTransform,
    clearSelection,
    startDrag,
    updateDrag,
    endDrag,
    startResize,
    updateResize,
    endResize,
    startRotation,
    updateRotation,
    endRotation,
    commitFloatingSelection,
    selectOverlay,
    deselectOverlay,
    updateOverlayPosition,
    updateOverlaySize,
    isProgressMode,
    setStitchCompleted,
    setAreaCompleted,
    fillContiguousCompleted,
    getStitchCompleted,
    progressShadingColor: storeShadingColor,
    progressShadingOpacity: storeShadingOpacity,
    activeLayerId,
    swapColorOnLayer,
    startAreaSelection,
    updateAreaSelection,
    endAreaSelection,
    activeStitchType,
    removeStitchAtPoint,
    beginStroke,
    endStroke,
    selectedLayerIds,
    multiLayerDragState,
    startMultiLayerDrag,
    updateMultiLayerDrag,
    endMultiLayerDrag,
    getMultiLayerBounds,
  } = usePatternStore();

  // Ensure shading values have defaults
  const progressShadingColor = storeShadingColor ?? [128, 128, 128] as [number, number, number];
  const progressShadingOpacity = storeShadingOpacity ?? 70;

  // Overlay drag/resize state
  const [overlayDragState, setOverlayDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: ResizeHandle | null;
    startX: number;
    startY: number;
    startOverlayX: number;
    startOverlayY: number;
    startOverlayWidth: number;
    startOverlayHeight: number;
  } | null>(null);

  // Load overlay images - store loaded HTMLImageElements keyed by overlay ID
  const [overlayImageElements, setOverlayImageElements] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    const loadedImages: Record<string, HTMLImageElement> = {};
    let loadCount = 0;
    const totalToLoad = overlayImages.length;

    if (totalToLoad === 0) {
      setOverlayImageElements({});
      return;
    }

    overlayImages.forEach((overlay) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[overlay.id] = img;
        loadCount++;
        if (loadCount === totalToLoad) {
          setOverlayImageElements({ ...loadedImages });
        }
      };
      img.onerror = () => {
        loadCount++;
        if (loadCount === totalToLoad) {
          setOverlayImageElements({ ...loadedImages });
        }
      };
      img.src = overlay.dataUrl;
    });
  }, [overlayImages]);

  // Get color by ID
  const getColor = useCallback((colorId: string): [number, number, number] | null => {
    if (!pattern) return null;
    const color = pattern.colorPalette.find(c => c.id === colorId);
    return color?.rgb ?? null;
  }, [pattern]);

  // Get full color object by ID (includes symbol)
  const getColorObject = useCallback((colorId: string): Color | null => {
    if (!pattern) return null;
    return pattern.colorPalette.find(c => c.id === colorId) ?? null;
  }, [pattern]);

  // Calculate contrast color for symbol text
  const getContrastColor = useCallback((rgb: [number, number, number]): string => {
    const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    return luminance > 0.5 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
  }, []);

  // Get resize handle at canvas position
  const getResizeHandleAt = useCallback((canvasX: number, canvasY: number): ResizeHandle | null => {
    if (!selection) return null;

    const cellSize = CELL_SIZE * zoom;
    const bounds = selection.bounds;

    // Convert bounds to canvas coordinates
    const left = bounds.x * cellSize + panOffset.x;
    const top = bounds.y * cellSize + panOffset.y;
    const right = (bounds.x + bounds.width) * cellSize + panOffset.x;
    const bottom = (bounds.y + bounds.height) * cellSize + panOffset.y;

    const handles: { x: number; y: number; handle: ResizeHandle }[] = [
      { x: left, y: top, handle: 'nw' },
      { x: (left + right) / 2, y: top, handle: 'n' },
      { x: right, y: top, handle: 'ne' },
      { x: right, y: (top + bottom) / 2, handle: 'e' },
      { x: right, y: bottom, handle: 'se' },
      { x: (left + right) / 2, y: bottom, handle: 's' },
      { x: left, y: bottom, handle: 'sw' },
      { x: left, y: (top + bottom) / 2, handle: 'w' },
    ];

    for (const h of handles) {
      if (
        canvasX >= h.x - HANDLE_SIZE &&
        canvasX <= h.x + HANDLE_SIZE &&
        canvasY >= h.y - HANDLE_SIZE &&
        canvasY <= h.y + HANDLE_SIZE
      ) {
        return h.handle;
      }
    }

    return null;
  }, [selection, zoom, panOffset]);

  // Check if point is on the rotation handle
  const isOnRotationHandle = useCallback((canvasX: number, canvasY: number): boolean => {
    if (!selection || selection.selectionType === 'area') return false;

    const cellSize = CELL_SIZE * zoom;
    const bounds = selection.bounds;

    // Convert bounds to canvas coordinates
    const left = bounds.x * cellSize + panOffset.x;
    const top = bounds.y * cellSize + panOffset.y;
    const selWidth = bounds.width * cellSize;

    // Rotation handle position (same as in rendering)
    const rotationHandleDistance = 35;
    const rotationHandleRadius = 8; // Slightly larger hit area than visual radius
    const rotationHandleX = left + selWidth / 2;
    const rotationHandleY = top - rotationHandleDistance;

    // Check if point is within the rotation handle circle
    const dx = canvasX - rotationHandleX;
    const dy = canvasY - rotationHandleY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= rotationHandleRadius;
  }, [selection, zoom, panOffset]);

  // Check if point is inside selection bounds
  const isPointInSelectionBounds = useCallback((canvasX: number, canvasY: number): boolean => {
    if (!selection) return false;

    const cellSize = CELL_SIZE * zoom;
    const bounds = selection.bounds;

    const left = bounds.x * cellSize + panOffset.x;
    const top = bounds.y * cellSize + panOffset.y;
    const right = (bounds.x + bounds.width) * cellSize + panOffset.x;
    const bottom = (bounds.y + bounds.height) * cellSize + panOffset.y;

    return canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom;
  }, [selection, zoom, panOffset]);

  // Check if a point is inside the multi-layer selection bounds
  const isPointInMultiLayerBounds = useCallback((canvasX: number, canvasY: number): boolean => {
    if (selectedLayerIds.length === 0) return false;

    const bounds = getMultiLayerBounds();
    if (!bounds) return false;

    const cellSize = CELL_SIZE * zoom;

    const left = bounds.x * cellSize + panOffset.x;
    const top = bounds.y * cellSize + panOffset.y;
    const right = (bounds.x + bounds.width) * cellSize + panOffset.x;
    const bottom = (bounds.y + bounds.height) * cellSize + panOffset.y;

    return canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom;
  }, [selectedLayerIds, getMultiLayerBounds, zoom, panOffset]);

  // Get the currently selected overlay
  const selectedOverlay = useMemo(() => {
    return overlayImages.find(o => o.id === selectedOverlayId) || null;
  }, [overlayImages, selectedOverlayId]);

  // Check if a point is on an overlay resize handle (only if not locked)
  const getOverlayResizeHandle = useCallback((canvasX: number, canvasY: number): ResizeHandle | null => {
    if (!selectedOverlay || selectedOverlay.locked) return null;

    const cellSize = CELL_SIZE * zoom;
    const ox = selectedOverlay.x * cellSize + panOffset.x;
    const oy = selectedOverlay.y * cellSize + panOffset.y;
    const ow = selectedOverlay.width * cellSize;
    const oh = selectedOverlay.height * cellSize;

    const handlePositions: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: 'nw', x: ox, y: oy },
      { handle: 'n', x: ox + ow / 2, y: oy },
      { handle: 'ne', x: ox + ow, y: oy },
      { handle: 'e', x: ox + ow, y: oy + oh / 2 },
      { handle: 'se', x: ox + ow, y: oy + oh },
      { handle: 's', x: ox + ow / 2, y: oy + oh },
      { handle: 'sw', x: ox, y: oy + oh },
      { handle: 'w', x: ox, y: oy + oh / 2 },
    ];

    for (const pos of handlePositions) {
      if (
        canvasX >= pos.x - HANDLE_SIZE &&
        canvasX <= pos.x + HANDLE_SIZE &&
        canvasY >= pos.y - HANDLE_SIZE &&
        canvasY <= pos.y + HANDLE_SIZE
      ) {
        return pos.handle;
      }
    }

    return null;
  }, [selectedOverlay, zoom, panOffset]);

  // Check if a point is inside any overlay (returns overlay id or null)
  // Checks from top to bottom (reverse order) to get the topmost overlay
  // Skips locked and hidden overlays
  const getOverlayAtPoint = useCallback((canvasX: number, canvasY: number): string | null => {
    const cellSize = CELL_SIZE * zoom;

    // Check overlays from top to bottom (reverse order)
    for (let i = overlayImages.length - 1; i >= 0; i--) {
      const overlay = overlayImages[i];
      if (!overlay.visible || overlay.locked) continue;

      const ox = overlay.x * cellSize + panOffset.x;
      const oy = overlay.y * cellSize + panOffset.y;
      const ow = overlay.width * cellSize;
      const oh = overlay.height * cellSize;

      if (canvasX >= ox && canvasX <= ox + ow && canvasY >= oy && canvasY <= oy + oh) {
        return overlay.id;
      }
    }

    return null;
  }, [overlayImages, zoom, panOffset]);

  // Check if a point is inside the selected overlay (only if not locked)
  const isPointInSelectedOverlay = useCallback((canvasX: number, canvasY: number): boolean => {
    if (!selectedOverlay?.visible || selectedOverlay?.locked) return false;

    const cellSize = CELL_SIZE * zoom;
    const ox = selectedOverlay.x * cellSize + panOffset.x;
    const oy = selectedOverlay.y * cellSize + panOffset.y;
    const ow = selectedOverlay.width * cellSize;
    const oh = selectedOverlay.height * cellSize;

    return canvasX >= ox && canvasX <= ox + ow && canvasY >= oy && canvasY <= oy + oh;
  }, [selectedOverlay, zoom, panOffset]);

  // Convert canvas coordinates to grid cell
  const canvasToCell = useCallback((canvasX: number, canvasY: number): { x: number; y: number } | null => {
    if (!pattern) return null;

    const cellSize = CELL_SIZE * zoom;
    const x = Math.floor((canvasX - panOffset.x) / cellSize);
    const y = Math.floor((canvasY - panOffset.y) / cellSize);

    if (x < 0 || x >= pattern.canvas.width || y < 0 || y >= pattern.canvas.height) {
      return null;
    }

    return { x, y };
  }, [pattern, zoom, panOffset]);

  // Convert canvas coordinates to grid cell without bounds checking (for resize/drag operations)
  const canvasToCellUnbounded = useCallback((canvasX: number, canvasY: number): { x: number; y: number } | null => {
    if (!pattern) return null;

    const cellSize = CELL_SIZE * zoom;
    const x = Math.floor((canvasX - panOffset.x) / cellSize);
    const y = Math.floor((canvasY - panOffset.y) / cellSize);

    return { x, y };
  }, [pattern, zoom, panOffset]);

  // Draw the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !pattern) return;

    const { width, height } = pattern.canvas;
    const cellSize = CELL_SIZE * zoom;

    // Clear canvas
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply pan offset
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);

    // Draw canvas background (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width * cellSize, height * cellSize);

    // Helper to get fill style with progress mode blending
    const getStitchFillStyle = (rgb: [number, number, number], isCompleted: boolean): string => {
      if (isCompleted) {
        const blendFactor = progressShadingOpacity / 100;
        const blendedR = Math.round(rgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor);
        const blendedG = Math.round(rgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor);
        const blendedB = Math.round(rgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor);
        return `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
      }
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };

    // Helper to get symbol fill style with progress mode blending
    const getSymbolFillStyle = (rgb: [number, number, number], isCompleted: boolean): string => {
      if (isCompleted) {
        const blendFactor = progressShadingOpacity / 100;
        const blendedRgb: [number, number, number] = [
          Math.round(rgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor),
          Math.round(rgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor),
          Math.round(rgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor),
        ];
        const baseContrastColor = getContrastColor(blendedRgb);
        const contrastRgb = baseContrastColor === '#ffffff' ? [255, 255, 255] : [0, 0, 0];
        const shadedSymbolR = Math.round(contrastRgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor);
        const shadedSymbolG = Math.round(contrastRgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor);
        const shadedSymbolB = Math.round(contrastRgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor);
        return `rgb(${shadedSymbolR}, ${shadedSymbolG}, ${shadedSymbolB})`;
      }
      return getContrastColor(rgb);
    };

    // Draw all visible layers (bottom to top) - Square and half-square stitches first
    // Skip circles and borders - they'll be drawn in later passes
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;
      // Skip this layer if it's being rotated (we'll draw the preview instead)
      if (selection?.isRotating && selection.layerId === layer.id && selection.selectionType !== 'area') continue;

      for (const stitch of layer.stitches) {
        // Skip circle, border, and cross stitches - they'll be drawn in later passes
        if (stitch.type === 'circle' || isBorderType(stitch.type) || isCrossType(stitch.type)) continue;

        const colorObj = getColorObject(stitch.colorId);
        if (colorObj) {
          const rgb = colorObj.rgb;
          const isCompleted = isProgressMode && stitch.completed;
          const fillStyle = getStitchFillStyle(rgb, isCompleted);
          const stitchType = stitch.type || 'square';

          // Draw based on stitch type
          if (isHalfSquareType(stitchType)) {
            // Draw half-square shape (triangle or rectangle)
            drawHalfSquare(ctx, stitchType, stitch.x, stitch.y, cellSize, fillStyle);

            // Draw symbol centered in the shape
            if (showSymbols && colorObj.symbol && cellSize >= 12) {
              const { cx, cy } = getHalfSquareCentroid(stitchType, stitch.x, stitch.y, cellSize);
              const fontSize = Math.max(8, Math.min(cellSize * 0.5, 14)); // Slightly smaller for half-squares
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = getSymbolFillStyle(rgb, isCompleted);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(colorObj.symbol, cx, cy);
            }
          } else {
            // Draw the square stitch background
            ctx.fillStyle = fillStyle;
            ctx.fillRect(
              stitch.x * cellSize,
              stitch.y * cellSize,
              cellSize,
              cellSize
            );

            // Draw symbol if enabled and cell is large enough
            if (showSymbols && colorObj.symbol && cellSize >= 12) {
              const fontSize = Math.max(8, Math.min(cellSize * 0.7, 16));
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = getSymbolFillStyle(rgb, isCompleted);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                colorObj.symbol,
                stitch.x * cellSize + cellSize / 2,
                stitch.y * cellSize + cellSize / 2
              );
            }
          }
        }
      }
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x <= width; x++) {
        const lineWidth = x % gridDivisions === 0 ? 2 : 1;
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = x % gridDivisions === 0 ? '#999' : '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, height * cellSize);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= height; y++) {
        const lineWidth = y % gridDivisions === 0 ? 2 : 1;
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = y % gridDivisions === 0 ? '#999' : '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(width * cellSize, y * cellSize);
        ctx.stroke();
      }
    }

    // Draw all visible layers - Circle stitches on top of grid (they overlap cells)
    const circleRadius = cellSize * CIRCLE_RADIUS_FACTOR;
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;
      // Skip this layer if it's being rotated (we'll draw the preview instead)
      if (selection?.isRotating && selection.layerId === layer.id && selection.selectionType !== 'area') continue;

      for (const stitch of layer.stitches) {
        // Only draw circle stitches in this pass
        if (stitch.type !== 'circle') continue;

        const colorObj = getColorObject(stitch.colorId);
        if (colorObj) {
          const rgb = colorObj.rgb;
          const isCompleted = isProgressMode && stitch.completed;

          // Get circle center position based on position property
          const position = stitch.position || 'center';
          const offset = getCircleCenterOffset(position);
          const cx = stitch.x * cellSize + offset.dx * cellSize;
          const cy = stitch.y * cellSize + offset.dy * cellSize;

          // Draw circle fill
          ctx.beginPath();
          ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
          ctx.fillStyle = getStitchFillStyle(rgb, isCompleted);
          ctx.fill();

          // Draw circle outline (black)
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = Math.max(1, cellSize * 0.05);
          ctx.stroke();

          // Draw symbol if enabled and circle is large enough
          if (showSymbols && colorObj.symbol && circleRadius >= 8) {
            const fontSize = Math.max(8, Math.min(circleRadius * 0.8, 16));
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = getSymbolFillStyle(rgb, isCompleted);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(colorObj.symbol, cx, cy);
          }
        }
      }
    }

    // Draw all visible layers - Border and cross stitches on top (they extend beyond cells)
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;
      // Skip this layer if it's being rotated (we'll draw the preview instead)
      if (selection?.isRotating && selection.layerId === layer.id && selection.selectionType !== 'area') continue;

      for (const stitch of layer.stitches) {
        // Only draw border and cross stitches in this pass
        if (!isBorderType(stitch.type) && !isCrossType(stitch.type)) continue;

        const colorObj = getColorObject(stitch.colorId);
        if (colorObj) {
          const rgb = colorObj.rgb;
          const isCompleted = isProgressMode && stitch.completed;
          const fillStyle = getStitchFillStyle(rgb, isCompleted);

          // Draw border
          drawHalfSquare(ctx, stitch.type!, stitch.x, stitch.y, cellSize, fillStyle);
        }
      }
    }

    // Draw all overlay images on top (for tracing) - hide in progress mode
    if (!isProgressMode) {
    for (const overlay of overlayImages) {
      if (!overlay.visible) continue;

      const imgElement = overlayImageElements[overlay.id];
      if (!imgElement || !imgElement.complete) continue;

      ctx.save();
      ctx.globalAlpha = overlay.opacity / 100;

      // Draw at specified position and size
      const drawX = overlay.x * cellSize;
      const drawY = overlay.y * cellSize;
      const drawWidth = overlay.width * cellSize;
      const drawHeight = overlay.height * cellSize;

      ctx.drawImage(imgElement, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      // Draw selection handles if this overlay is selected
      if (overlay.id === selectedOverlayId) {
        ctx.strokeStyle = '#f59e0b'; // Amber color
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        ctx.setLineDash([]);

        // Draw resize handles
        const handles = [
          { x: drawX, y: drawY },                              // nw
          { x: drawX + drawWidth / 2, y: drawY },              // n
          { x: drawX + drawWidth, y: drawY },                  // ne
          { x: drawX + drawWidth, y: drawY + drawHeight / 2 }, // e
          { x: drawX + drawWidth, y: drawY + drawHeight },     // se
          { x: drawX + drawWidth / 2, y: drawY + drawHeight }, // s
          { x: drawX, y: drawY + drawHeight },                 // sw
          { x: drawX, y: drawY + drawHeight / 2 },             // w
        ];

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        for (const handle of handles) {
          ctx.fillRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
          ctx.strokeRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
        }
      }
    }
    } // End of overlay rendering (hidden in progress mode)

    // Draw canvas border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width * cellSize, height * cellSize);

    // Draw center marker (bullseye/target symbol)
    if (showCenterMarker) {
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      // Center of the center cell
      const cx = centerX * cellSize + cellSize / 2;
      const cy = centerY * cellSize + cellSize / 2;

      const radius = cellSize * 0.45;
      const ringWidth = radius * 0.25;

      ctx.strokeStyle = '#22c55e';

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius - ringWidth / 2, 0, Math.PI * 2);
      ctx.lineWidth = ringWidth;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
      ctx.lineWidth = ringWidth * 0.8;
      ctx.stroke();
    }

    // Draw selection overlay
    if (selection) {
      const bounds = selection.bounds;
      const left = bounds.x * cellSize;
      const top = bounds.y * cellSize;
      const selWidth = bounds.width * cellSize;
      const selHeight = bounds.height * cellSize;

      // Draw floating stitches (new content being placed) - squares first
      if (selection.floatingStitches) {
        for (const stitch of selection.floatingStitches) {
          if (stitch.type === 'circle') continue; // Draw circles in second pass
          const colorObj = getColorObject(stitch.colorId);
          if (colorObj) {
            const rgb = colorObj.rgb;
            ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            ctx.fillRect(
              stitch.x * cellSize,
              stitch.y * cellSize,
              cellSize,
              cellSize
            );

            // Draw symbol if enabled and cell is large enough
            if (showSymbols && colorObj.symbol && cellSize >= 12) {
              const fontSize = Math.max(8, Math.min(cellSize * 0.7, 16));
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = getContrastColor(rgb);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(
                colorObj.symbol,
                stitch.x * cellSize + cellSize / 2,
                stitch.y * cellSize + cellSize / 2
              );
            }
          }
        }
        // Draw floating circle stitches on top
        for (const stitch of selection.floatingStitches) {
          if (stitch.type !== 'circle') continue;
          const colorObj = getColorObject(stitch.colorId);
          if (colorObj) {
            const rgb = colorObj.rgb;
            const position = stitch.position || 'center';
            const offset = getCircleCenterOffset(position);
            const cx = stitch.x * cellSize + offset.dx * cellSize;
            const cy = stitch.y * cellSize + offset.dy * cellSize;

            // Draw circle fill
            ctx.beginPath();
            ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            ctx.fill();

            // Draw circle outline (black)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(1, cellSize * 0.05);
            ctx.stroke();

            // Draw symbol if enabled and circle is large enough
            if (showSymbols && colorObj.symbol && circleRadius >= 8) {
              const fontSize = Math.max(8, Math.min(circleRadius * 0.8, 16));
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = getContrastColor(rgb);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(colorObj.symbol, cx, cy);
            }
          }
        }
      }

      // Draw rotation preview when rotating (using inverse mapping to prevent gaps)
      if (selection.isRotating && selection.originalStitches && selection.rotationAngle !== undefined) {
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const angleRad = (selection.rotationAngle * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const invCos = Math.cos(-angleRad);
        const invSin = Math.sin(-angleRad);

        // Build lookup map of original stitches and find bounds
        const originalMap = new Map<string, Stitch>();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const stitch of selection.originalStitches) {
          originalMap.set(`${stitch.x},${stitch.y}`, stitch);
          minX = Math.min(minX, stitch.x);
          minY = Math.min(minY, stitch.y);
          maxX = Math.max(maxX, stitch.x);
          maxY = Math.max(maxY, stitch.y);
        }

        // Calculate rotated bounding box
        const corners = [
          { x: minX, y: minY }, { x: maxX, y: minY },
          { x: minX, y: maxY }, { x: maxX, y: maxY },
        ];
        let rotMinX = Infinity, rotMinY = Infinity, rotMaxX = -Infinity, rotMaxY = -Infinity;
        for (const corner of corners) {
          const dx = corner.x - centerX;
          const dy = corner.y - centerY;
          const rotX = dx * cos - dy * sin + centerX;
          const rotY = dx * sin + dy * cos + centerY;
          rotMinX = Math.min(rotMinX, rotX);
          rotMinY = Math.min(rotMinY, rotY);
          rotMaxX = Math.max(rotMaxX, rotX);
          rotMaxY = Math.max(rotMaxY, rotY);
        }
        rotMinX = Math.floor(rotMinX) - 1;
        rotMinY = Math.floor(rotMinY) - 1;
        rotMaxX = Math.ceil(rotMaxX) + 1;
        rotMaxY = Math.ceil(rotMaxY) + 1;

        // Draw rotated stitches preview using inverse mapping
        ctx.globalAlpha = 0.8;
        for (let y = rotMinY; y <= rotMaxY; y++) {
          for (let x = rotMinX; x <= rotMaxX; x++) {
            // Inverse rotate to find source position
            const dx = x - centerX;
            const dy = y - centerY;
            const srcX = Math.round(dx * invCos - dy * invSin + centerX);
            const srcY = Math.round(dx * invSin + dy * invCos + centerY);

            const srcStitch = originalMap.get(`${srcX},${srcY}`);
            if (srcStitch && srcStitch.type !== 'circle') {
              const colorObj = getColorObject(srcStitch.colorId);
              if (colorObj) {
                const rgb = colorObj.rgb;
                ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
              }
            }
          }
        }

        // Draw rotated circle stitches (forward mapping is fine for circles)
        for (const stitch of selection.originalStitches) {
          if (stitch.type !== 'circle') continue;

          const colorObj = getColorObject(stitch.colorId);
          if (colorObj) {
            const dx = stitch.x - centerX;
            const dy = stitch.y - centerY;
            const rotatedX = Math.round(dx * cos - dy * sin + centerX);
            const rotatedY = Math.round(dx * sin + dy * cos + centerY);

            const rgb = colorObj.rgb;
            const position = stitch.position || 'center';
            const offset = getCircleCenterOffset(position);
            const cx = rotatedX * cellSize + offset.dx * cellSize;
            const cy = rotatedY * cellSize + offset.dy * cellSize;

            ctx.beginPath();
            ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(1, cellSize * 0.05);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw semi-transparent fill for area selection
      if (selection.selectionType === 'area') {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.fillRect(left, top, selWidth, selHeight);
      }

      // Draw selection rectangle (dashed)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(left, top, selWidth, selHeight);
      ctx.setLineDash([]);

      // Draw resize handles (only when not actively selecting and not a completed area selection)
      if (!selection.isSelectingArea && selection.selectionType !== 'area') {
        const handles = [
          { x: left, y: top },                          // nw
          { x: left + selWidth / 2, y: top },           // n
          { x: left + selWidth, y: top },               // ne
          { x: left + selWidth, y: top + selHeight / 2 }, // e
          { x: left + selWidth, y: top + selHeight },   // se
          { x: left + selWidth / 2, y: top + selHeight }, // s
          { x: left, y: top + selHeight },              // sw
          { x: left, y: top + selHeight / 2 },          // w
        ];

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        for (const handle of handles) {
          ctx.fillRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
          ctx.strokeRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
        }

        // Draw rotation handle (dotted line + circle above top center)
        const rotationHandleDistance = 35; // pixels above selection
        const rotationHandleRadius = 6;
        const rotationLineStartX = left + selWidth / 2;
        const rotationLineStartY = top;
        const rotationHandleX = rotationLineStartX;
        const rotationHandleY = top - rotationHandleDistance;

        // Draw dotted line from top center to rotation handle
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(rotationLineStartX, rotationLineStartY);
        ctx.lineTo(rotationHandleX, rotationHandleY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw rotation handle circle
        ctx.beginPath();
        ctx.arc(rotationHandleX, rotationHandleY, rotationHandleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw hint text for floating selection
      if (selection.floatingStitches) {
        const hintText = 'Enter: Place | Esc: Cancel';
        ctx.font = '12px sans-serif';
        const textMetrics = ctx.measureText(hintText);
        const padding = 6;
        const hintX = left + selWidth / 2 - textMetrics.width / 2 - padding;
        const hintY = top + selHeight + 8;

        // Background
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.fillRect(hintX, hintY, textMetrics.width + padding * 2, 20);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(hintText, hintX + padding, hintY + 10);
      }
    }

    // Draw multi-layer selection overlay
    if (selectedLayerIds.length > 0) {
      const multiLayerBounds = getMultiLayerBounds();
      if (multiLayerBounds) {
        const left = multiLayerBounds.x * cellSize;
        const top = multiLayerBounds.y * cellSize;
        const selWidth = multiLayerBounds.width * cellSize;
        const selHeight = multiLayerBounds.height * cellSize;

        // Draw selection rectangle (dashed purple for multi-layer)
        ctx.strokeStyle = '#9333ea'; // Purple for multi-selection
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(left, top, selWidth, selHeight);
        ctx.setLineDash([]);

        // Draw count badge
        const badgeText = `${selectedLayerIds.length} layers`;
        ctx.font = '11px sans-serif';
        const textMetrics = ctx.measureText(badgeText);
        const padding = 4;
        const badgeX = left + selWidth - textMetrics.width - padding * 2 - 4;
        const badgeY = top - 20;

        // Background
        ctx.fillStyle = 'rgba(147, 51, 234, 0.9)';
        ctx.fillRect(badgeX, badgeY, textMetrics.width + padding * 2, 16);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + padding, badgeY + 8);
      }
    }

    // Draw guide lines for selected overlay or layer
    const selectedOverlay = selectedOverlayId ? overlayImages.find(o => o.id === selectedOverlayId) : null;
    const hasSelection = selection?.selectionType === 'layer' || selectedOverlay;

    if (hasSelection) {
      const meshCount = pattern.canvas.meshCount;
      const canvasWidthPx = width * cellSize;
      const canvasHeightPx = height * cellSize;

      // Get bounds of selected item (in pixels)
      let itemLeft: number, itemTop: number, itemWidth: number, itemHeight: number;

      if (selectedOverlay) {
        itemLeft = selectedOverlay.x * cellSize;
        itemTop = selectedOverlay.y * cellSize;
        itemWidth = selectedOverlay.width * cellSize;
        itemHeight = selectedOverlay.height * cellSize;
      } else if (selection) {
        itemLeft = selection.bounds.x * cellSize;
        itemTop = selection.bounds.y * cellSize;
        itemWidth = selection.bounds.width * cellSize;
        itemHeight = selection.bounds.height * cellSize;
      } else {
        itemLeft = 0; itemTop = 0; itemWidth = 0; itemHeight = 0;
      }

      const itemRight = itemLeft + itemWidth;
      const itemBottom = itemTop + itemHeight;
      const itemCenterX = itemLeft + itemWidth / 2;
      const itemCenterY = itemTop + itemHeight / 2;
      const canvasCenterX = canvasWidthPx / 2;
      const canvasCenterY = canvasHeightPx / 2;

      // Check if centered (within 0.5 cells tolerance)
      const centerTolerancePx = cellSize * 0.5;
      const isCenteredH = Math.abs(itemCenterX - canvasCenterX) < centerTolerancePx;
      const isCenteredV = Math.abs(itemCenterY - canvasCenterY) < centerTolerancePx;

      // Format distance based on ruler unit
      const formatDistance = (pixels: number): string => {
        const cells = pixels / cellSize;
        if (rulerUnit === 'squares') {
          return `${cells.toFixed(1)}`;
        } else if (rulerUnit === 'mm') {
          const mm = (cells / meshCount) * 25.4;
          return `${mm.toFixed(1)}mm`;
        } else {
          // inches
          const inches = cells / meshCount;
          return `${inches.toFixed(2)}"`;
        }
      };

      // Guide line style
      const guideColor = '#3b82f6'; // Blue
      const centerColor = '#22c55e'; // Green for centered
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Distance from left edge
      if (itemLeft > 5) {
        ctx.strokeStyle = isCenteredH ? centerColor : guideColor;
        ctx.beginPath();
        ctx.moveTo(0, itemCenterY);
        ctx.lineTo(itemLeft, itemCenterY);
        ctx.stroke();

        // Label
        const leftDist = formatDistance(itemLeft);
        const labelX = itemLeft / 2;
        ctx.fillStyle = '#ffffff';
        const textWidth = ctx.measureText(leftDist).width + 6;
        ctx.fillRect(labelX - textWidth / 2, itemCenterY - 8, textWidth, 16);
        ctx.fillStyle = isCenteredH ? centerColor : guideColor;
        ctx.fillText(leftDist, labelX, itemCenterY);
      }

      // Distance from right edge
      if (canvasWidthPx - itemRight > 5) {
        ctx.strokeStyle = isCenteredH ? centerColor : guideColor;
        ctx.beginPath();
        ctx.moveTo(itemRight, itemCenterY);
        ctx.lineTo(canvasWidthPx, itemCenterY);
        ctx.stroke();

        // Label
        const rightDist = formatDistance(canvasWidthPx - itemRight);
        const labelX = itemRight + (canvasWidthPx - itemRight) / 2;
        ctx.fillStyle = '#ffffff';
        const textWidth = ctx.measureText(rightDist).width + 6;
        ctx.fillRect(labelX - textWidth / 2, itemCenterY - 8, textWidth, 16);
        ctx.fillStyle = isCenteredH ? centerColor : guideColor;
        ctx.fillText(rightDist, labelX, itemCenterY);
      }

      // Distance from top edge
      if (itemTop > 5) {
        ctx.strokeStyle = isCenteredV ? centerColor : guideColor;
        ctx.beginPath();
        ctx.moveTo(itemCenterX, 0);
        ctx.lineTo(itemCenterX, itemTop);
        ctx.stroke();

        // Label
        const topDist = formatDistance(itemTop);
        const labelY = itemTop / 2;
        ctx.fillStyle = '#ffffff';
        const textWidth = ctx.measureText(topDist).width + 6;
        ctx.fillRect(itemCenterX - textWidth / 2, labelY - 8, textWidth, 16);
        ctx.fillStyle = isCenteredV ? centerColor : guideColor;
        ctx.fillText(topDist, itemCenterX, labelY);
      }

      // Distance from bottom edge
      if (canvasHeightPx - itemBottom > 5) {
        ctx.strokeStyle = isCenteredV ? centerColor : guideColor;
        ctx.beginPath();
        ctx.moveTo(itemCenterX, itemBottom);
        ctx.lineTo(itemCenterX, canvasHeightPx);
        ctx.stroke();

        // Label
        const bottomDist = formatDistance(canvasHeightPx - itemBottom);
        const labelY = itemBottom + (canvasHeightPx - itemBottom) / 2;
        ctx.fillStyle = '#ffffff';
        const textWidth = ctx.measureText(bottomDist).width + 6;
        ctx.fillRect(itemCenterX - textWidth / 2, labelY - 8, textWidth, 16);
        ctx.fillStyle = isCenteredV ? centerColor : guideColor;
        ctx.fillText(bottomDist, itemCenterX, labelY);
      }

      // Draw center indicator if centered
      if (isCenteredH && isCenteredV) {
        ctx.setLineDash([]);
        ctx.strokeStyle = centerColor;
        ctx.lineWidth = 2;
        // Draw a small crosshair at the center
        const crossSize = 10;
        ctx.beginPath();
        ctx.moveTo(itemCenterX - crossSize, itemCenterY);
        ctx.lineTo(itemCenterX + crossSize, itemCenterY);
        ctx.moveTo(itemCenterX, itemCenterY - crossSize);
        ctx.lineTo(itemCenterX, itemCenterY + crossSize);
        ctx.stroke();

        // "Centered" label above the item
        ctx.font = 'bold 12px sans-serif';
        const centeredText = 'CENTERED';
        const textWidth = ctx.measureText(centeredText).width + 10;
        const labelY = itemTop - 20;
        ctx.fillStyle = centerColor;
        ctx.fillRect(itemCenterX - textWidth / 2, labelY - 10, textWidth, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(centeredText, itemCenterX, labelY);
      }

      ctx.setLineDash([]);
    }

    // Draw shape preview while dragging
    if (shapeStart && shapeEnd && selectedColorId) {
      const rgb = getColor(selectedColorId);
      if (rgb) {
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.5)`;
        ctx.strokeStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.lineWidth = 2;

        if (activeTool === 'line') {
          // Draw line preview
          ctx.beginPath();
          ctx.moveTo(shapeStart.x * cellSize + cellSize / 2, shapeStart.y * cellSize + cellSize / 2);
          ctx.lineTo(shapeEnd.x * cellSize + cellSize / 2, shapeEnd.y * cellSize + cellSize / 2);
          ctx.stroke();
        } else if (activeTool === 'rectangle') {
          // Draw rectangle preview
          const minX = Math.min(shapeStart.x, shapeEnd.x);
          const minY = Math.min(shapeStart.y, shapeEnd.y);
          const rectWidth = Math.abs(shapeEnd.x - shapeStart.x) + 1;
          const rectHeight = Math.abs(shapeEnd.y - shapeStart.y) + 1;
          ctx.fillRect(minX * cellSize, minY * cellSize, rectWidth * cellSize, rectHeight * cellSize);
          ctx.strokeRect(minX * cellSize, minY * cellSize, rectWidth * cellSize, rectHeight * cellSize);
        } else if (activeTool === 'ellipse') {
          // Draw ellipse preview
          const cx = ((shapeStart.x + shapeEnd.x) / 2 + 0.5) * cellSize;
          const cy = ((shapeStart.y + shapeEnd.y) / 2 + 0.5) * cellSize;
          const ellipseWidth = Math.abs(shapeEnd.x - shapeStart.x) + 1;
          const ellipseHeight = Math.abs(shapeEnd.y - shapeStart.y) + 1;
          const rx = ellipseWidth * cellSize / 2;
          const ry = ellipseHeight * cellSize / 2;

          // Check if it's a perfect circle (width equals height)
          const isCircle = ellipseWidth === ellipseHeight;
          if (isCircle) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; // Red fill
            ctx.strokeStyle = 'rgb(239, 68, 68)'; // Red stroke
          }

          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [pattern, zoom, panOffset, showGrid, gridDivisions, getColor, getColorObject, getContrastColor, showSymbols, showCenterMarker, selection, shapeStart, shapeEnd, selectedColorId, activeTool, overlayImages, overlayImageElements, selectedOverlayId, isProgressMode, progressShadingColor, progressShadingOpacity, rulerUnit, selectedLayerIds, getMultiLayerBounds]);

  // Draw horizontal ruler (top)
  const drawTopRuler = useCallback(() => {
    const ruler = topRulerRef.current;
    const ctx = ruler?.getContext('2d');
    if (!ruler || !ctx || !pattern) return;

    const meshCount = pattern.canvas.meshCount;
    const cellSize = CELL_SIZE * zoom;
    const pixelsPerInch = meshCount * cellSize;
    const pixelsPerMm = pixelsPerInch / 25.4;
    const pixelsPerSquare = cellSize;

    // Clear ruler
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, ruler.width, ruler.height);

    // Draw border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ruler.width, ruler.height);

    ctx.save();
    ctx.translate(panOffset.x, 0);

    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    if (rulerUnit === 'squares') {
      // Draw square count markers
      const startSquare = Math.floor(-panOffset.x / pixelsPerSquare);
      const endSquare = Math.ceil((ruler.width - panOffset.x) / pixelsPerSquare);
      const totalSquares = pattern.canvas.width;

      // Determine step based on zoom level
      let step = 1;
      if (pixelsPerSquare < 8) step = 20;
      else if (pixelsPerSquare < 15) step = 10;
      else if (pixelsPerSquare < 25) step = 5;

      for (let sq = Math.max(0, startSquare); sq <= Math.min(totalSquares, endSquare); sq++) {
        const x = sq * pixelsPerSquare;

        if (sq % step === 0) {
          // Major tick
          ctx.beginPath();
          ctx.moveTo(x, RULER_SIZE);
          ctx.lineTo(x, RULER_SIZE - 10);
          ctx.stroke();
          if (sq > 0) {
            ctx.fillText(String(sq), x, 12);
          }
        } else if (step <= 5 && sq % (step / 5 || 1) === 0) {
          // Minor tick
          ctx.beginPath();
          ctx.moveTo(x, RULER_SIZE);
          ctx.lineTo(x, RULER_SIZE - 4);
          ctx.stroke();
        }
      }
    } else if (rulerUnit === 'mm') {
      // Draw millimeter markers
      const startMm = Math.floor(-panOffset.x / pixelsPerMm);
      const endMm = Math.ceil((ruler.width - panOffset.x) / pixelsPerMm);
      const totalMm = (pattern.canvas.width / meshCount) * 25.4;

      // Determine step based on zoom level
      let step = 10; // Show every cm by default
      if (pixelsPerMm > 3) step = 5;
      if (pixelsPerMm > 6) step = 1;

      for (let mm = Math.max(0, startMm); mm <= Math.min(totalMm, endMm); mm++) {
        const x = mm * pixelsPerMm;

        if (mm % 10 === 0) {
          // Centimeter tick (major)
          ctx.beginPath();
          ctx.moveTo(x, RULER_SIZE);
          ctx.lineTo(x, RULER_SIZE - 10);
          ctx.stroke();
          if (mm > 0) {
            ctx.fillText(String(mm / 10), x, 12);
          }
        } else if (mm % 5 === 0 && step <= 5) {
          // Half-cm tick
          ctx.beginPath();
          ctx.moveTo(x, RULER_SIZE);
          ctx.lineTo(x, RULER_SIZE - 6);
          ctx.stroke();
        } else if (step === 1) {
          // Mm tick
          ctx.beginPath();
          ctx.moveTo(x, RULER_SIZE);
          ctx.lineTo(x, RULER_SIZE - 3);
          ctx.stroke();
        }
      }
      // Draw "cm" unit label at the start of the ruler
      ctx.fillStyle = '#999';
      ctx.font = '9px sans-serif';
      ctx.fillText('cm', 3, 12);
      ctx.fillStyle = '#333';
      ctx.font = '10px sans-serif';
    } else {
      // Draw inch markers (default)
      const startInch = Math.floor(-panOffset.x / pixelsPerInch);
      const endInch = Math.ceil((ruler.width - panOffset.x) / pixelsPerInch);
      const totalInches = pattern.canvas.width / meshCount;

      for (let inch = Math.max(0, startInch); inch <= Math.min(totalInches, endInch); inch++) {
        const x = inch * pixelsPerInch;

        // Major tick and number
        ctx.beginPath();
        ctx.moveTo(x, RULER_SIZE);
        ctx.lineTo(x, RULER_SIZE - 10);
        ctx.stroke();

        if (inch > 0) {
          ctx.fillText(String(inch), x, 12);
        }

        // Half-inch tick
        if (inch < totalInches) {
          const halfX = x + pixelsPerInch / 2;
          ctx.beginPath();
          ctx.moveTo(halfX, RULER_SIZE);
          ctx.lineTo(halfX, RULER_SIZE - 6);
          ctx.stroke();
        }

        // Quarter-inch ticks (if zoomed in enough)
        if (pixelsPerInch > 40 && inch < totalInches) {
          for (let q = 1; q < 4; q++) {
            if (q === 2) continue; // Skip half (already drawn)
            const qX = x + (pixelsPerInch * q) / 4;
            ctx.beginPath();
            ctx.moveTo(qX, RULER_SIZE);
            ctx.lineTo(qX, RULER_SIZE - 4);
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }, [pattern, zoom, panOffset, rulerUnit]);

  // Draw vertical ruler (left)
  const drawLeftRuler = useCallback(() => {
    const ruler = leftRulerRef.current;
    const ctx = ruler?.getContext('2d');
    if (!ruler || !ctx || !pattern) return;

    const meshCount = pattern.canvas.meshCount;
    const cellSize = CELL_SIZE * zoom;
    const pixelsPerInch = meshCount * cellSize;
    const pixelsPerMm = pixelsPerInch / 25.4;
    const pixelsPerSquare = cellSize;

    // Clear ruler
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, ruler.width, ruler.height);

    // Draw border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ruler.width, ruler.height);

    ctx.save();
    ctx.translate(0, panOffset.y);

    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    if (rulerUnit === 'squares') {
      // Draw square count markers
      const startSquare = Math.floor(-panOffset.y / pixelsPerSquare);
      const endSquare = Math.ceil((ruler.height - panOffset.y) / pixelsPerSquare);
      const totalSquares = pattern.canvas.height;

      let step = 1;
      if (pixelsPerSquare < 8) step = 20;
      else if (pixelsPerSquare < 15) step = 10;
      else if (pixelsPerSquare < 25) step = 5;

      for (let sq = Math.max(0, startSquare); sq <= Math.min(totalSquares, endSquare); sq++) {
        const y = sq * pixelsPerSquare;

        if (sq % step === 0) {
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, y);
          ctx.lineTo(RULER_SIZE - 10, y);
          ctx.stroke();
          if (sq > 0) {
            ctx.save();
            ctx.translate(11, y);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(String(sq), 0, 0);
            ctx.restore();
          }
        } else if (step <= 5 && sq % (step / 5 || 1) === 0) {
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, y);
          ctx.lineTo(RULER_SIZE - 4, y);
          ctx.stroke();
        }
      }
    } else if (rulerUnit === 'mm') {
      // Draw millimeter markers
      const startMm = Math.floor(-panOffset.y / pixelsPerMm);
      const endMm = Math.ceil((ruler.height - panOffset.y) / pixelsPerMm);
      const totalMm = (pattern.canvas.height / meshCount) * 25.4;

      let step = 10;
      if (pixelsPerMm > 3) step = 5;
      if (pixelsPerMm > 6) step = 1;

      for (let mm = Math.max(0, startMm); mm <= Math.min(totalMm, endMm); mm++) {
        const y = mm * pixelsPerMm;

        if (mm % 10 === 0) {
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, y);
          ctx.lineTo(RULER_SIZE - 10, y);
          ctx.stroke();
          if (mm > 0) {
            ctx.save();
            ctx.translate(11, y);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(String(mm / 10), 0, 0);
            ctx.restore();
          }
        } else if (mm % 5 === 0 && step <= 5) {
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, y);
          ctx.lineTo(RULER_SIZE - 6, y);
          ctx.stroke();
        } else if (step === 1) {
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, y);
          ctx.lineTo(RULER_SIZE - 3, y);
          ctx.stroke();
        }
      }
      // Draw "cm" unit label at the start of the ruler
      ctx.fillStyle = '#999';
      ctx.font = '9px sans-serif';
      ctx.save();
      ctx.translate(11, 3);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('cm', 0, 0);
      ctx.restore();
      ctx.fillStyle = '#333';
      ctx.font = '10px sans-serif';
    } else {
      // Draw inch markers (default)
      const startInch = Math.floor(-panOffset.y / pixelsPerInch);
      const endInch = Math.ceil((ruler.height - panOffset.y) / pixelsPerInch);
      const totalInches = pattern.canvas.height / meshCount;

      for (let inch = Math.max(0, startInch); inch <= Math.min(totalInches, endInch); inch++) {
        const y = inch * pixelsPerInch;

        ctx.beginPath();
        ctx.moveTo(RULER_SIZE, y);
        ctx.lineTo(RULER_SIZE - 10, y);
        ctx.stroke();

        if (inch > 0) {
          ctx.save();
          ctx.translate(11, y);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(String(inch), 0, 0);
          ctx.restore();
        }

        if (inch < totalInches) {
          const halfY = y + pixelsPerInch / 2;
          ctx.beginPath();
          ctx.moveTo(RULER_SIZE, halfY);
          ctx.lineTo(RULER_SIZE - 6, halfY);
          ctx.stroke();
        }

        if (pixelsPerInch > 40 && inch < totalInches) {
          for (let q = 1; q < 4; q++) {
            if (q === 2) continue;
            const qY = y + (pixelsPerInch * q) / 4;
            ctx.beginPath();
            ctx.moveTo(RULER_SIZE, qY);
            ctx.lineTo(RULER_SIZE - 4, qY);
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }, [pattern, zoom, panOffset, rulerUnit]);

  // Draw vertical ruler (right)
  const drawRightRuler = useCallback(() => {
    const ruler = rightRulerRef.current;
    const ctx = ruler?.getContext('2d');
    if (!ruler || !ctx || !pattern) return;

    const meshCount = pattern.canvas.meshCount;
    const cellSize = CELL_SIZE * zoom;
    const pixelsPerInch = meshCount * cellSize;
    const pixelsPerMm = pixelsPerInch / 25.4;
    const pixelsPerSquare = cellSize;

    // Clear ruler
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, ruler.width, ruler.height);

    // Draw border
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, ruler.width, ruler.height);

    ctx.save();
    ctx.translate(0, panOffset.y);

    ctx.fillStyle = '#222';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    if (rulerUnit === 'squares') {
      // Draw square count markers
      const startSquare = Math.floor(-panOffset.y / pixelsPerSquare);
      const endSquare = Math.ceil((ruler.height - panOffset.y) / pixelsPerSquare);
      const totalSquares = pattern.canvas.height;

      let step = 1;
      if (pixelsPerSquare < 8) step = 20;
      else if (pixelsPerSquare < 15) step = 10;
      else if (pixelsPerSquare < 25) step = 5;

      for (let sq = Math.max(0, startSquare); sq <= Math.min(totalSquares, endSquare); sq++) {
        const y = sq * pixelsPerSquare;

        if (sq % step === 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(10, y);
          ctx.stroke();
          if (sq > 0) {
            ctx.save();
            ctx.translate(13, y);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(String(sq), 0, 0);
            ctx.restore();
          }
        } else if (step <= 5 && sq % (step / 5 || 1) === 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(4, y);
          ctx.stroke();
        }
      }
    } else if (rulerUnit === 'mm') {
      // Draw millimeter markers
      const startMm = Math.floor(-panOffset.y / pixelsPerMm);
      const endMm = Math.ceil((ruler.height - panOffset.y) / pixelsPerMm);
      const totalMm = (pattern.canvas.height / meshCount) * 25.4;

      let step = 10;
      if (pixelsPerMm > 3) step = 5;
      if (pixelsPerMm > 6) step = 1;

      for (let mm = Math.max(0, startMm); mm <= Math.min(totalMm, endMm); mm++) {
        const y = mm * pixelsPerMm;

        if (mm % 10 === 0) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(10, y);
          ctx.stroke();
          if (mm > 0) {
            ctx.save();
            ctx.translate(13, y);
            ctx.rotate(Math.PI / 2);
            ctx.fillText(String(mm / 10), 0, 0);
            ctx.restore();
          }
        } else if (mm % 5 === 0 && step <= 5) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(6, y);
          ctx.stroke();
        } else if (step === 1) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(3, y);
          ctx.stroke();
        }
      }
      // Draw "cm" unit label at the start of the ruler
      ctx.fillStyle = '#999';
      ctx.font = '9px sans-serif';
      ctx.save();
      ctx.translate(13, 3);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('cm', 0, 0);
      ctx.restore();
      ctx.fillStyle = '#333';
      ctx.font = '10px sans-serif';
    } else {
      // Draw inch markers (default)
      const startInch = Math.floor(-panOffset.y / pixelsPerInch);
      const endInch = Math.ceil((ruler.height - panOffset.y) / pixelsPerInch);
      const totalInches = pattern.canvas.height / meshCount;

      for (let inch = Math.max(0, startInch); inch <= Math.min(totalInches, endInch); inch++) {
        const y = inch * pixelsPerInch;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(10, y);
        ctx.stroke();

        if (inch > 0) {
          ctx.save();
          ctx.translate(13, y);
          ctx.rotate(Math.PI / 2);
          ctx.fillText(String(inch), 0, 0);
          ctx.restore();
        }

        if (inch < totalInches) {
          const halfY = y + pixelsPerInch / 2;
          ctx.beginPath();
          ctx.moveTo(0, halfY);
          ctx.lineTo(6, halfY);
          ctx.stroke();
        }

        if (pixelsPerInch > 40 && inch < totalInches) {
          for (let q = 1; q < 4; q++) {
            if (q === 2) continue;
            const qY = y + (pixelsPerInch * q) / 4;
            ctx.beginPath();
            ctx.moveTo(0, qY);
            ctx.lineTo(4, qY);
            ctx.stroke();
          }
        }
      }
    }

    ctx.restore();
  }, [pattern, zoom, panOffset, rulerUnit]);

  // Resize canvas and rulers to fill container
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const topRuler = topRulerRef.current;
      const leftRuler = leftRulerRef.current;
      const rightRuler = rightRulerRef.current;
      if (!canvas || !container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Main canvas (accounting for rulers)
      canvas.width = containerWidth - RULER_SIZE * 2;
      canvas.height = containerHeight - RULER_SIZE;

      // Rulers
      if (topRuler) {
        topRuler.width = containerWidth - RULER_SIZE * 2;
        topRuler.height = RULER_SIZE;
      }
      if (leftRuler) {
        leftRuler.width = RULER_SIZE;
        leftRuler.height = containerHeight - RULER_SIZE;
      }
      if (rightRuler) {
        rightRuler.width = RULER_SIZE;
        rightRuler.height = containerHeight - RULER_SIZE;
      }

      draw();
      drawTopRuler();
      drawLeftRuler();
      drawRightRuler();
    };

    resizeCanvas();

    // Use ResizeObserver to respond to container size changes (e.g., panel collapse)
    const container = containerRef.current;
    if (container) {
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(container);
      return () => resizeObserver.disconnect();
    }

    // Fallback to window resize for older browsers
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [draw, drawTopRuler, drawLeftRuler, drawRightRuler]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
    drawTopRuler();
    drawLeftRuler();
    drawRightRuler();
  }, [draw, drawTopRuler, drawLeftRuler, drawRightRuler]);

  // Track viewport size for scrollbars
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      setViewportSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate scroll dimensions
  const contentWidth = pattern ? pattern.canvas.width * CELL_SIZE * zoom : 0;
  const contentHeight = pattern ? pattern.canvas.height * CELL_SIZE * zoom : 0;

  // Add padding around content for scrolling beyond edges
  const scrollPadding = 100;
  const totalScrollWidth = contentWidth + scrollPadding * 2;
  const totalScrollHeight = contentHeight + scrollPadding * 2;

  // Calculate scroll position (0 to 1)
  const scrollX = totalScrollWidth > viewportSize.width
    ? Math.max(0, Math.min(1, (scrollPadding - panOffset.x) / (totalScrollWidth - viewportSize.width)))
    : 0;
  const scrollY = totalScrollHeight > viewportSize.height
    ? Math.max(0, Math.min(1, (scrollPadding - panOffset.y) / (totalScrollHeight - viewportSize.height)))
    : 0;

  // Calculate scrollbar thumb sizes
  const thumbWidthPercent = Math.min(1, viewportSize.width / totalScrollWidth);
  const thumbHeightPercent = Math.min(1, viewportSize.height / totalScrollHeight);

  // Show scrollbars only when content exceeds viewport
  const showHorizontalScrollbar = totalScrollWidth > viewportSize.width;
  const showVerticalScrollbar = totalScrollHeight > viewportSize.height;

  // Refs for scrollbar tracks
  const hScrollTrackRef = useRef<HTMLDivElement>(null);
  const vScrollTrackRef = useRef<HTMLDivElement>(null);

  // Scrollbar drag state
  const [scrollbarDrag, setScrollbarDrag] = useState<{
    type: 'horizontal' | 'vertical';
    startMousePos: number;
    startScrollPos: number;
  } | null>(null);

  // Touch state for mobile panning/pinch-zoom
  const [touchState, setTouchState] = useState<{
    isPanning: boolean;
    lastTouchX: number;
    lastTouchY: number;
    initialPinchDistance: number | null;
    initialZoom: number;
  } | null>(null);

  // Handle scrollbar drag
  useEffect(() => {
    if (!scrollbarDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (scrollbarDrag.type === 'horizontal') {
        const track = hScrollTrackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const trackWidth = rect.width;
        const thumbWidth = trackWidth * thumbWidthPercent;
        const scrollableTrack = trackWidth - thumbWidth;
        if (scrollableTrack <= 0) return;

        const deltaX = e.clientX - scrollbarDrag.startMousePos;
        const deltaScroll = deltaX / scrollableTrack;
        const newScrollX = Math.max(0, Math.min(1, scrollbarDrag.startScrollPos + deltaScroll));
        const newPanX = scrollPadding - newScrollX * (totalScrollWidth - viewportSize.width);
        setPanOffset({ x: newPanX, y: panOffset.y });
      } else {
        const track = vScrollTrackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const trackHeight = rect.height;
        const thumbHeight = trackHeight * thumbHeightPercent;
        const scrollableTrack = trackHeight - thumbHeight;
        if (scrollableTrack <= 0) return;

        const deltaY = e.clientY - scrollbarDrag.startMousePos;
        const deltaScroll = deltaY / scrollableTrack;
        const newScrollY = Math.max(0, Math.min(1, scrollbarDrag.startScrollPos + deltaScroll));
        const newPanY = scrollPadding - newScrollY * (totalScrollHeight - viewportSize.height);
        setPanOffset({ x: panOffset.x, y: newPanY });
      }
    };

    const handleMouseUp = () => {
      setScrollbarDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [scrollbarDrag, thumbWidthPercent, thumbHeightPercent, totalScrollWidth, totalScrollHeight, viewportSize, scrollPadding, panOffset, setPanOffset]);

  // Handle horizontal scrollbar mouse down
  const handleHorizontalScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pattern) return;
    e.preventDefault();
    setScrollbarDrag({
      type: 'horizontal',
      startMousePos: e.clientX,
      startScrollPos: scrollX,
    });
  };

  // Handle vertical scrollbar mouse down
  const handleVerticalScrollMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pattern) return;
    e.preventDefault();
    setScrollbarDrag({
      type: 'vertical',
      startMousePos: e.clientY,
      startScrollPos: scrollY,
    });
  };

  // Handle click on scrollbar track (jump to position)
  const handleHorizontalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pattern || scrollbarDrag) return;
    // Only handle clicks on the track, not on the thumb
    if ((e.target as HTMLElement).dataset.scrollThumb) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const thumbWidth = trackWidth * thumbWidthPercent;
    const scrollableTrack = trackWidth - thumbWidth;

    if (scrollableTrack <= 0) return;

    const newScrollX = Math.max(0, Math.min(1, (clickX - thumbWidth / 2) / scrollableTrack));
    const newPanX = scrollPadding - newScrollX * (totalScrollWidth - viewportSize.width);
    setPanOffset({ x: newPanX, y: panOffset.y });
  };

  const handleVerticalTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pattern || scrollbarDrag) return;
    // Only handle clicks on the track, not on the thumb
    if ((e.target as HTMLElement).dataset.scrollThumb) return;

    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const trackHeight = rect.height;
    const thumbHeight = trackHeight * thumbHeightPercent;
    const scrollableTrack = trackHeight - thumbHeight;

    if (scrollableTrack <= 0) return;

    const newScrollY = Math.max(0, Math.min(1, (clickY - thumbHeight / 2) / scrollableTrack));
    const newPanY = scrollPadding - newScrollY * (totalScrollHeight - viewportSize.height);
    setPanOffset({ x: panOffset.x, y: newPanY });
  };

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pattern) return;

    // Skip mouse events if touch is active (prevents synthetic mouse events on iOS)
    if (isTouchActiveRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Pan mode - works in both normal and progress mode
    if (activeTool === 'pan') {
      setIsDrawing(true);
      setLastCell({ x: e.clientX, y: e.clientY });
      return;
    }

    // Progress mode with pencil tool: clicking/dragging toggles stitch completion
    if (isProgressMode && activeTool === 'pencil') {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Check if within canvas bounds
      if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
        // Debounce: prevent double-toggle from touch + synthetic mouse events
        const now = Date.now();
        const last = lastToggleRef.current;
        if (last && last.x === cellX && last.y === cellY && now - last.time < 500) {
          // Same cell toggled within 500ms, skip
          return;
        }
        lastToggleRef.current = { x: cellX, y: cellY, time: now };

        // Determine target state: toggle the first cell, then apply same state to all dragged cells
        const currentState = getStitchCompleted(cellX, cellY);
        const targetState = !currentState;

        // Start drag tracking
        progressDragRef.current = { targetState, lastCellX: cellX, lastCellY: cellY };
        setStitchCompleted(cellX, cellY, targetState);
        setIsDrawing(true);
      }
      return;
    }

    // Progress mode with fill tool: flood fill contiguous same-color stitches as complete
    if (isProgressMode && activeTool === 'fill') {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Check if within canvas bounds
      if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
        // Toggle: if already complete, mark as incomplete; otherwise mark as complete
        const currentState = getStitchCompleted(cellX, cellY);
        fillContiguousCompleted(cellX, cellY, !currentState);
      }
      return;
    }

    // Progress mode with blockfill tool: mark entire 5x5 block as complete
    if (isProgressMode && activeTool === 'blockfill') {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Check if within canvas bounds
      if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
        // Calculate the 5x5 block boundaries
        const blockStartX = Math.floor(cellX / gridDivisions) * gridDivisions;
        const blockStartY = Math.floor(cellY / gridDivisions) * gridDivisions;

        // Toggle: check if the clicked cell is complete, then apply opposite to entire block
        const currentState = getStitchCompleted(cellX, cellY);
        const targetState = !currentState;

        // Start drag tracking for block fill
        blockFillDragRef.current = { targetState, lastBlockX: blockStartX, lastBlockY: blockStartY };
        setAreaCompleted(blockStartX, blockStartY, gridDivisions, gridDivisions, targetState);
        setIsDrawing(true);
      }
      return;
    }

    if (activeTool === 'select') {
      // Check if clicking on overlay resize handle (for selected overlay)
      const overlayHandle = getOverlayResizeHandle(x, y);
      if (overlayHandle && selectedOverlay) {
        setOverlayDragState({
          isDragging: false,
          isResizing: true,
          resizeHandle: overlayHandle,
          startX: x,
          startY: y,
          startOverlayX: selectedOverlay.x,
          startOverlayY: selectedOverlay.y,
          startOverlayWidth: selectedOverlay.width,
          startOverlayHeight: selectedOverlay.height,
        });
        setIsDrawing(true);
        return;
      }

      // Check if clicking inside selected overlay (for drag)
      if (selectedOverlay && isPointInSelectedOverlay(x, y)) {
        setOverlayDragState({
          isDragging: true,
          isResizing: false,
          resizeHandle: null,
          startX: x,
          startY: y,
          startOverlayX: selectedOverlay.x,
          startOverlayY: selectedOverlay.y,
          startOverlayWidth: selectedOverlay.width,
          startOverlayHeight: selectedOverlay.height,
        });
        setIsDrawing(true);
        return;
      }

      // Check if clicking on any overlay (to select it)
      const clickedOverlayId = getOverlayAtPoint(x, y);
      if (clickedOverlayId) {
        selectOverlay(clickedOverlayId);
        return;
      }

      // If overlay is selected and we click elsewhere, deselect it
      if (selectedOverlayId) {
        deselectOverlay();
      }

      // Check if clicking on the rotation handle
      if (selection && isOnRotationHandle(x, y)) {
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startRotation(cell);
          setIsDrawing(true);
        }
        return;
      }

      // Check if clicking on a resize handle
      const handle = getResizeHandleAt(x, y);
      if (handle && selection) {
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startResize(handle, cell);
          setIsDrawing(true);
        }
        return;
      }

      // Check if clicking inside selection bounds (for drag)
      if (selection && isPointInSelectionBounds(x, y)) {
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startDrag(cell);
          setIsDrawing(true);
        }
        return;
      }

      // Check if clicking inside multi-layer selection bounds (for multi-layer drag)
      if (selectedLayerIds.length > 0 && isPointInMultiLayerBounds(x, y)) {
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startMultiLayerDrag(cell);
          setIsDrawing(true);
        }
        return;
      }

      // If there's a floating selection and we clicked outside, commit it
      if (selection?.floatingStitches) {
        commitFloatingSelection();
        return;
      }

      // Check if clicking on a layer's stitches (to select that layer)
      const cell = canvasToCell(x, y);
      if (cell) {
        // Search layers from top to bottom, skipping locked and hidden layers
        for (let i = pattern.layers.length - 1; i >= 0; i--) {
          const layer = pattern.layers[i];
          if (!layer.visible || layer.locked) continue;

          const stitch = layer.stitches.find(s => s.x === cell.x && s.y === cell.y);
          if (stitch) {
            selectLayerForTransform(layer.id);
            return;
          }
        }
      }

      // Clicked on empty space - clear selection
      clearSelection();
      return;
    }

    if (activeTool === 'areaselect') {
      // If there's a floating selection, check if clicking inside to drag or outside to commit
      if (selection?.floatingStitches) {
        if (isPointInSelectionBounds(x, y)) {
          // Clicking inside floating selection - start dragging it
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startDrag(cell);
            setIsDrawing(true);
          }
          return;
        } else {
          // Clicking outside - commit the floating selection
          commitFloatingSelection();
          return;
        }
      }

      // Check if clicking inside an existing area selection bounds (for drag)
      if (selection && selection.selectionType === 'area' && isPointInSelectionBounds(x, y)) {
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startDrag(cell);
          setIsDrawing(true);
        }
        return;
      }

      // Start new area selection
      const cell = canvasToCellUnbounded(x, y);
      if (cell) {
        startAreaSelection(cell);
        setIsDrawing(true);
      }
      return;
    }

    // For drawing tools, require a selected color
    if (!selectedColorId) return;

    const cell = canvasToCell(x, y);
    if (!cell) return;

    if (activeTool === 'pencil') {
      // Begin stroke batching so undo reverts the entire stroke
      beginStroke();
      // For circles, determine position from click location within cell
      const cellSize = CELL_SIZE * zoom;
      const circlePosition = activeStitchType === 'circle'
        ? getCirclePositionFromClick(x - panOffset.x, y - panOffset.y, cell.x, cell.y, cellSize)
        : undefined;
      setStitch(cell.x, cell.y, selectedColorId, activeStitchType, circlePosition);
      setIsDrawing(true);
      setLastCell(cell);
    } else if (activeTool === 'eraser') {
      // Begin stroke batching so undo reverts the entire stroke
      beginStroke();
      // Use precise eraser that removes specific stitches at the click point
      const cellSize = CELL_SIZE * zoom;
      removeStitchAtPoint(x - panOffset.x, y - panOffset.y, cellSize);
      setIsDrawing(true);
      setLastCell(cell);
    } else if (activeTool === 'fill') {
      fillArea(cell.x, cell.y, selectedColorId);
    } else if (activeTool === 'colorswap') {
      // Find the stitch at clicked position on active layer
      const activeLayer = pattern.layers.find(l => l.id === activeLayerId);
      if (!activeLayer) return;

      const clickedStitch = activeLayer.stitches.find(
        s => s.x === cell.x && s.y === cell.y
      );

      if (clickedStitch && clickedStitch.colorId !== selectedColorId) {
        swapColorOnLayer(clickedStitch.colorId, selectedColorId);
      }
    } else if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse') {
      // Start shape drawing
      setShapeStart(cell);
      setShapeEnd(cell);
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (!pattern) return;

    // Handle progress mode dragging
    if (isProgressMode && isDrawing && progressDragRef.current) {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Only update if we've moved to a new cell
      if (cellX !== progressDragRef.current.lastCellX || cellY !== progressDragRef.current.lastCellY) {
        // Use Bresenham's line algorithm to fill all cells between last and current
        const x0 = progressDragRef.current.lastCellX;
        const y0 = progressDragRef.current.lastCellY;
        const x1 = cellX;
        const y1 = cellY;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let cx = x0;
        let cy = y0;

        while (true) {
          // Set this cell (skip the starting cell since it's already set)
          if (cx !== x0 || cy !== y0) {
            if (cx >= 0 && cx < pattern.canvas.width && cy >= 0 && cy < pattern.canvas.height) {
              setStitchCompleted(cx, cy, progressDragRef.current.targetState);
            }
          }

          if (cx === x1 && cy === y1) break;

          const e2 = 2 * err;
          if (e2 > -dy) {
            err -= dy;
            cx += sx;
          }
          if (e2 < dx) {
            err += dx;
            cy += sy;
          }
        }

        progressDragRef.current.lastCellX = cellX;
        progressDragRef.current.lastCellY = cellY;
      }
      return;
    }

    // Handle blockfill dragging - mark entire 5x5 blocks as we drag across them
    if (isProgressMode && isDrawing && blockFillDragRef.current) {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Calculate current block
      const blockStartX = Math.floor(cellX / gridDivisions) * gridDivisions;
      const blockStartY = Math.floor(cellY / gridDivisions) * gridDivisions;

      // Only update if we've moved to a new block
      if (blockStartX !== blockFillDragRef.current.lastBlockX || blockStartY !== blockFillDragRef.current.lastBlockY) {
        // Check if within canvas bounds
        if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
          setAreaCompleted(blockStartX, blockStartY, gridDivisions, gridDivisions, blockFillDragRef.current.targetState);
        }
        blockFillDragRef.current.lastBlockX = blockStartX;
        blockFillDragRef.current.lastBlockY = blockStartY;
      }
      return;
    }

    // Handle overlay dragging/resizing
    if (activeTool === 'select' && isDrawing && overlayDragState && selectedOverlayId && selectedOverlay) {
      const cellSize = CELL_SIZE * zoom;
      const deltaX = (x - overlayDragState.startX) / cellSize;
      const deltaY = (y - overlayDragState.startY) / cellSize;

      if (overlayDragState.isDragging) {
        updateOverlayPosition(
          selectedOverlayId,
          Math.round(overlayDragState.startOverlayX + deltaX),
          Math.round(overlayDragState.startOverlayY + deltaY)
        );
      } else if (overlayDragState.isResizing && overlayDragState.resizeHandle) {
        const handle = overlayDragState.resizeHandle;
        let newX = overlayDragState.startOverlayX;
        let newY = overlayDragState.startOverlayY;
        let newWidth = overlayDragState.startOverlayWidth;
        let newHeight = overlayDragState.startOverlayHeight;

        // Calculate aspect ratio from natural dimensions
        const aspectRatio = selectedOverlay.naturalWidth / selectedOverlay.naturalHeight;
        const maintainAspect = !e.shiftKey; // Hold Shift to free resize

        if (handle.includes('n')) {
          newY = overlayDragState.startOverlayY + deltaY;
          newHeight = overlayDragState.startOverlayHeight - deltaY;
        }
        if (handle.includes('s')) {
          newHeight = overlayDragState.startOverlayHeight + deltaY;
        }
        if (handle.includes('w')) {
          newX = overlayDragState.startOverlayX + deltaX;
          newWidth = overlayDragState.startOverlayWidth - deltaX;
        }
        if (handle.includes('e')) {
          newWidth = overlayDragState.startOverlayWidth + deltaX;
        }

        // Maintain aspect ratio unless Shift is pressed
        if (maintainAspect && newWidth >= 1 && newHeight >= 1) {
          if (handle === 'n' || handle === 's') {
            // Vertical only - adjust width to match
            const adjustedWidth = newHeight * aspectRatio;
            const widthDiff = adjustedWidth - overlayDragState.startOverlayWidth;
            newWidth = adjustedWidth;
            newX = overlayDragState.startOverlayX - widthDiff / 2; // Center horizontally
          } else if (handle === 'e' || handle === 'w') {
            // Horizontal only - adjust height to match
            const adjustedHeight = newWidth / aspectRatio;
            const heightDiff = adjustedHeight - overlayDragState.startOverlayHeight;
            newHeight = adjustedHeight;
            newY = overlayDragState.startOverlayY - heightDiff / 2; // Center vertically
          } else {
            // Corner handle - use the larger delta to determine size
            const widthFromHeight = newHeight * aspectRatio;
            const heightFromWidth = newWidth / aspectRatio;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              // Width is primary
              newHeight = heightFromWidth;
              if (handle.includes('n')) {
                newY = overlayDragState.startOverlayY + overlayDragState.startOverlayHeight - newHeight;
              }
            } else {
              // Height is primary
              newWidth = widthFromHeight;
              if (handle.includes('w')) {
                newX = overlayDragState.startOverlayX + overlayDragState.startOverlayWidth - newWidth;
              }
            }
          }
        }

        // Ensure minimum size
        if (newWidth >= 1 && newHeight >= 1) {
          updateOverlayPosition(selectedOverlayId, Math.round(newX), Math.round(newY));
          updateOverlaySize(selectedOverlayId, Math.round(newWidth), Math.round(newHeight));
        }
      }
      return;
    }

    // Handle select tool dragging/resizing/rotating
    if (activeTool === 'select' && isDrawing && selection) {
      const cell = canvasToCellUnbounded(x, y);
      if (cell) {
        if (selection.isRotating) {
          updateRotation(cell);
        } else if (selection.isResizing) {
          updateResize(cell, e.shiftKey);
        } else if (selection.isDragging) {
          updateDrag(cell);
        }
      }
      return;
    }

    // Handle multi-layer drag
    if (activeTool === 'select' && isDrawing && multiLayerDragState?.isDragging) {
      const cell = canvasToCellUnbounded(x, y);
      if (cell) {
        updateMultiLayerDrag(cell);
      }
      return;
    }

    // Handle areaselect tool dragging/area selection
    if (activeTool === 'areaselect' && isDrawing && selection) {
      const cell = canvasToCellUnbounded(x, y);
      if (cell) {
        if (selection.isSelectingArea) {
          updateAreaSelection(cell);
        } else if (selection.isDragging) {
          updateDrag(cell);
        }
      }
      return;
    }

    if (!isDrawing) return;

    if (activeTool === 'pan' && lastCell) {
      const dx = e.clientX - lastCell.x;
      const dy = e.clientY - lastCell.y;
      setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      setLastCell({ x: e.clientX, y: e.clientY });
      return;
    }

    const cell = canvasToCell(x, y);
    if (!cell) return;

    // Shape tools - update preview on every cell change (don't check lastCell)
    if ((activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse') && shapeStart) {
      setShapeEnd(cell);
      return;
    }

    // For pencil/eraser, skip if same cell AND same stitch type
    // This allows stacking different cross/border types in the same cell while preventing duplicates
    if (lastCell && cell.x === lastCell.x && cell.y === lastCell.y && lastCell.type === activeStitchType) return;

    if (activeTool === 'pencil' && selectedColorId) {
      // For circles, determine position from click location within cell
      const cellSize = CELL_SIZE * zoom;
      const circlePosition = activeStitchType === 'circle'
        ? getCirclePositionFromClick(x - panOffset.x, y - panOffset.y, cell.x, cell.y, cellSize)
        : undefined;
      setStitch(cell.x, cell.y, selectedColorId, activeStitchType, circlePosition);
      setLastCell({ ...cell, type: activeStitchType });
    } else if (activeTool === 'eraser') {
      // Use precise eraser
      const cellSize = CELL_SIZE * zoom;
      removeStitchAtPoint(x - panOffset.x, y - panOffset.y, cellSize);
      setLastCell(cell);
    }
  };

  const handleMouseUp = () => {
    // Clear progress drag state
    if (progressDragRef.current) {
      progressDragRef.current = null;
    }

    // Clear block fill drag state
    if (blockFillDragRef.current) {
      blockFillDragRef.current = null;
    }

    // Clear overlay drag state
    if (overlayDragState) {
      setOverlayDragState(null);
    }

    // End stroke batching for pencil/eraser tools
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      endStroke();
    }

    // Handle select tool drag/resize/rotate end
    if (activeTool === 'select' && selection) {
      if (selection.isRotating) {
        endRotation();
      } else if (selection.isResizing) {
        endResize();
      } else if (selection.isDragging) {
        endDrag();
      }
    }

    // Handle multi-layer drag end
    if (activeTool === 'select' && multiLayerDragState?.isDragging) {
      endMultiLayerDrag();
    }

    // Handle areaselect tool area selection end
    if (activeTool === 'areaselect' && selection) {
      if (selection.isSelectingArea) {
        // In progress mode, mark the entire selected area as complete instead of keeping selection
        if (isProgressMode && selection.bounds) {
          const { x, y, width, height } = selection.bounds;
          setAreaCompleted(x, y, width, height, true);
          clearSelection();
        } else {
          endAreaSelection();
        }
      } else if (selection.isDragging) {
        endDrag();
      }
    }

    // Handle shape tool finalization
    if (shapeStart && shapeEnd && selectedColorId) {
      if (activeTool === 'line') {
        drawLine(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId);
      } else if (activeTool === 'rectangle') {
        drawRectangle(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId, true);
      } else if (activeTool === 'ellipse') {
        drawEllipse(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId, true);
      }
    }

    // Clear shape drawing state
    setShapeStart(null);
    setShapeEnd(null);
    setIsDrawing(false);
    setLastCell(null);
  };

  const handleMouseLeave = () => {
    // Clear overlay drag state
    if (overlayDragState) {
      setOverlayDragState(null);
    }

    // End stroke batching for pencil/eraser tools
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      endStroke();
    }

    // Cancel any ongoing drag/resize/rotate
    if (activeTool === 'select' && selection) {
      if (selection.isRotating) {
        endRotation();
      } else if (selection.isResizing) {
        endResize();
      } else if (selection.isDragging) {
        endDrag();
      }
    }

    // Cancel shape drawing
    setShapeStart(null);
    setShapeEnd(null);
    setIsDrawing(false);
    setLastCell(null);
  };

  // Custom pencil cursor (black and white, based on pencil.svg)
  const pencilCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/%3E%3Cpath d='m15 5 4 4'/%3E%3C/svg%3E") 2 22, crosshair`;

  // Custom eraser cursor (black and white)
  const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20 20H9L3.5 14.5c-.7-.7-.7-1.8 0-2.5L13 2.5c.7-.7 1.8-.7 2.5 0l6 6c.7.7.7 1.8 0 2.5L12 20' fill='white' stroke='black' stroke-width='1.5'/%3E%3Cpath d='M9 20L3.5 14.5c-.7-.7-.7-1.8 0-2.5L7 8.5l7 7L9 20z' fill='%23ccc' stroke='black' stroke-width='1.5'/%3E%3Cpath d='M7 8.5L14 15.5' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") 4 20, crosshair`;

  // Custom fill/paint bucket cursor (black and white, based on FillIcon)
  const fillCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 22 22' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.996,6C8.097,4.101 6.468,2.472 4.996,1' fill='none' stroke='black' stroke-width='1.5'/%3E%3Cpath d='M17.988,11L1.037,11' fill='none' stroke='black' stroke-width='1.5'/%3E%3Cpath d='M1.193,13.443C2.023,14.418 8.537,19.127 8.537,19.127L17.001,12.696L18.868,9.875L1.359,9.875C1.359,9.875 0.363,12.468 1.193,13.443Z' fill='white'/%3E%3Cpath d='M20.141,17.38C19.558,16.901 19.154,16.238 18.996,15.5C18.841,16.239 18.436,16.903 17.851,17.38C17.276,17.84 16.996,18.4 16.996,18.975C16.996,18.983 16.996,18.992 16.996,19C16.996,20.097 17.899,21 18.996,21C20.093,21 20.996,20.097 20.996,19C20.996,18.992 20.996,18.983 20.996,18.975C20.996,18.395 20.711,17.845 20.141,17.38' fill='%23ccc' stroke='%23999' stroke-width='1.5'/%3E%3Cpath d='M7.496,3.5L9.644,1.352C10.111,0.885 10.881,0.885 11.348,1.352L18.644,8.648C19.111,9.115 19.111,9.885 18.644,10.352L11.052,17.944C9.65,19.346 7.342,19.346 5.94,17.944L2.052,14.056C0.65,12.654 0.65,10.346 2.052,8.944L4.666,6.33' fill='none' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") 19 21, crosshair`;

  // Custom move/select cursor (black and white pointer arrow)
  const moveCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M4 4l7 18 2.5-7.5L21 12 4 4z' fill='white' stroke='black' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 4 4, default`;

  // Custom rotation cursor (refresh-cw icon)
  const rotateCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'/%3E%3Cpath d='M21 3v5h-5'/%3E%3Cpath d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'/%3E%3Cpath d='M8 16H3v5'/%3E%3C/svg%3E") 12 12, pointer`;

  // Get cursor based on current state
  const getCursor = useCallback((): string => {
    if (activeTool === 'pencil') return pencilCursor;
    if (activeTool === 'eraser') return eraserCursor;
    if (activeTool === 'fill') return fillCursor;
    if (activeTool === 'pan') return 'grab';
    if (isProgressMode) return 'pointer';
    if (activeTool === 'select') {
      const cursors: Record<ResizeHandle, string> = {
        nw: 'nw-resize',
        n: 'n-resize',
        ne: 'ne-resize',
        e: 'e-resize',
        se: 'se-resize',
        s: 's-resize',
        sw: 'sw-resize',
        w: 'w-resize',
      };

      // Check overlay handles first (for selected overlay)
      if (mousePos && selectedOverlay) {
        const overlayHandle = getOverlayResizeHandle(mousePos.x, mousePos.y);
        if (overlayHandle) {
          return cursors[overlayHandle];
        }
        if (isPointInSelectedOverlay(mousePos.x, mousePos.y)) {
          return 'move';
        }
      }

      // Check selection handles
      if (mousePos && selection) {
        // Check rotation handle first
        if (isOnRotationHandle(mousePos.x, mousePos.y)) {
          return rotateCursor;
        }
        const handle = getResizeHandleAt(mousePos.x, mousePos.y);
        if (handle) {
          return cursors[handle];
        }
        if (isPointInSelectionBounds(mousePos.x, mousePos.y)) {
          return 'move';
        }
      }

      // Check if hovering over any overlay (to show pointer for selection)
      if (mousePos && getOverlayAtPoint(mousePos.x, mousePos.y)) {
        return moveCursor;
      }

      return moveCursor;
    }
    if (activeTool === 'areaselect') {
      // Check selection bounds for move cursor
      if (mousePos && selection && selection.selectionType === 'area' && isPointInSelectionBounds(mousePos.x, mousePos.y)) {
        return 'move';
      }
      return 'crosshair';
    }
    return 'crosshair';
  }, [activeTool, mousePos, selection, selectedOverlay, getResizeHandleAt, isPointInSelectionBounds, isOnRotationHandle, getOverlayResizeHandle, isPointInSelectedOverlay, getOverlayAtPoint, isProgressMode]);

  // Handle wheel for zoom - zoom towards center of viewable area
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate new zoom level
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));

    if (newZoom === zoom) return;

    // Get the center of the visible canvas area
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Calculate the point in pattern space that's currently at the center
    const patternCenterX = (centerX - panOffset.x) / (CELL_SIZE * zoom);
    const patternCenterY = (centerY - panOffset.y) / (CELL_SIZE * zoom);

    // Calculate new pan offset to keep that pattern point at the center
    const newPanX = centerX - patternCenterX * CELL_SIZE * newZoom;
    const newPanY = centerY - patternCenterY * CELL_SIZE * newZoom;

    // Apply both zoom and pan offset together
    setPanOffset({ x: newPanX, y: newPanY });
    setZoom(newZoom);
  };

  // Touch event handlers for mobile panning and pinch-zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!pattern) return;

    // Mark touch as active to block synthetic mouse events
    isTouchActiveRef.current = true;
    // Clear the flag after a delay to allow for any lingering synthetic events
    setTimeout(() => { isTouchActiveRef.current = false; }, 500);

    // Two-finger touch: prepare for pinch-zoom or two-finger pan
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      setTouchState({
        isPanning: true,
        lastTouchX: centerX,
        lastTouchY: centerY,
        initialPinchDistance: distance,
        initialZoom: zoom,
      });
      return;
    }

    // Single finger touch
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Pan mode - works in both normal and progress mode
      if (activeTool === 'pan') {
        setTouchState({
          isPanning: true,
          lastTouchX: touch.clientX,
          lastTouchY: touch.clientY,
          initialPinchDistance: null,
          initialZoom: zoom,
        });
        return;
      }

      // In progress mode with pencil tool, toggle stitch completion and enable drag
      if (isProgressMode && activeTool === 'pencil') {
        e.preventDefault(); // Prevent synthetic mouse event from firing
        const cellSize = CELL_SIZE * zoom;
        const cellX = Math.floor((x - panOffset.x) / cellSize);
        const cellY = Math.floor((y - panOffset.y) / cellSize);

        if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
          // Debounce: prevent double-toggle from touch + synthetic mouse events
          const now = Date.now();
          const last = lastToggleRef.current;
          if (last && last.x === cellX && last.y === cellY && now - last.time < 500) {
            // Same cell toggled within 500ms, skip
            return;
          }
          lastToggleRef.current = { x: cellX, y: cellY, time: now };

          // Determine target state: toggle the first cell, then apply same state to all dragged cells
          const currentState = getStitchCompleted(cellX, cellY);
          const targetState = !currentState;

          // Start drag tracking
          progressDragRef.current = { targetState, lastCellX: cellX, lastCellY: cellY };
          setStitchCompleted(cellX, cellY, targetState);
          setIsDrawing(true);
        }
        return;
      }

      // Progress mode with fill tool: flood fill contiguous same-color stitches as complete
      if (isProgressMode && activeTool === 'fill') {
        e.preventDefault();
        const cellSize = CELL_SIZE * zoom;
        const cellX = Math.floor((x - panOffset.x) / cellSize);
        const cellY = Math.floor((y - panOffset.y) / cellSize);

        if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
          const currentState = getStitchCompleted(cellX, cellY);
          fillContiguousCompleted(cellX, cellY, !currentState);
        }
        return;
      }

      // Progress mode with blockfill tool: mark entire 5x5 block as complete
      if (isProgressMode && activeTool === 'blockfill') {
        e.preventDefault();
        const cellSize = CELL_SIZE * zoom;
        const cellX = Math.floor((x - panOffset.x) / cellSize);
        const cellY = Math.floor((y - panOffset.y) / cellSize);

        if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
          // Calculate the 5x5 block boundaries
          const blockStartX = Math.floor(cellX / gridDivisions) * gridDivisions;
          const blockStartY = Math.floor(cellY / gridDivisions) * gridDivisions;

          // Toggle: check if the clicked cell is complete, then apply opposite to entire block
          const currentState = getStitchCompleted(cellX, cellY);
          const targetState = !currentState;

          // Start drag tracking for block fill
          blockFillDragRef.current = { targetState, lastBlockX: blockStartX, lastBlockY: blockStartY };
          setAreaCompleted(blockStartX, blockStartY, gridDivisions, gridDivisions, targetState);
          setIsDrawing(true);
        }
        return;
      }

      // Select tool: handle resize handles, dragging, and selection
      if (activeTool === 'select') {
        // Check if touching overlay resize handle
        const overlayHandle = getOverlayResizeHandle(x, y);
        if (overlayHandle && selectedOverlay) {
          e.preventDefault();
          setOverlayDragState({
            isDragging: false,
            isResizing: true,
            resizeHandle: overlayHandle,
            startX: x,
            startY: y,
            startOverlayX: selectedOverlay.x,
            startOverlayY: selectedOverlay.y,
            startOverlayWidth: selectedOverlay.width,
            startOverlayHeight: selectedOverlay.height,
          });
          setIsDrawing(true);
          return;
        }

        // Check if touching inside selected overlay (for drag)
        if (selectedOverlay && isPointInSelectedOverlay(x, y)) {
          e.preventDefault();
          setOverlayDragState({
            isDragging: true,
            isResizing: false,
            resizeHandle: null,
            startX: x,
            startY: y,
            startOverlayX: selectedOverlay.x,
            startOverlayY: selectedOverlay.y,
            startOverlayWidth: selectedOverlay.width,
            startOverlayHeight: selectedOverlay.height,
          });
          setIsDrawing(true);
          return;
        }

        // Check if touching any overlay (to select it)
        const clickedOverlayId = getOverlayAtPoint(x, y);
        if (clickedOverlayId) {
          selectOverlay(clickedOverlayId);
          return;
        }

        // If overlay is selected and we touch elsewhere, deselect it
        if (selectedOverlayId) {
          deselectOverlay();
        }

        // Check if touching the rotation handle
        if (selection && isOnRotationHandle(x, y)) {
          e.preventDefault();
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startRotation(cell);
            setIsDrawing(true);
          }
          return;
        }

        // Check if touching a layer resize handle
        const handle = getResizeHandleAt(x, y);
        if (handle && selection) {
          e.preventDefault();
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startResize(handle, cell);
            setIsDrawing(true);
          }
          return;
        }

        // Check if touching inside selection bounds (for drag)
        if (selection && isPointInSelectionBounds(x, y)) {
          e.preventDefault();
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startDrag(cell);
            setIsDrawing(true);
          }
          return;
        }

        // Check if touching inside multi-layer selection bounds (for multi-layer drag)
        if (selectedLayerIds.length > 0 && isPointInMultiLayerBounds(x, y)) {
          e.preventDefault();
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startMultiLayerDrag(cell);
            setIsDrawing(true);
          }
          return;
        }

        // If there's a floating selection and we touched outside, commit it
        if (selection?.floatingStitches) {
          commitFloatingSelection();
          return;
        }

        // Check if touching a layer's stitches (to select that layer)
        const cell = canvasToCell(x, y);
        if (cell) {
          for (let i = pattern.layers.length - 1; i >= 0; i--) {
            const layer = pattern.layers[i];
            if (!layer.visible || layer.locked) continue;

            const stitch = layer.stitches.find(s => s.x === cell.x && s.y === cell.y);
            if (stitch) {
              selectLayerForTransform(layer.id);
              return;
            }
          }
        }

        // Touched on empty space - clear selection
        clearSelection();
        return;
      }

      // Area select tool: handle floating selection, dragging, and new selection
      if (activeTool === 'areaselect') {
        // If there's a floating selection, check if touching inside to drag or outside to commit
        if (selection?.floatingStitches) {
          if (isPointInSelectionBounds(x, y)) {
            // Touching inside floating selection - start dragging it
            e.preventDefault();
            const cell = canvasToCellUnbounded(x, y);
            if (cell) {
              startDrag(cell);
              setIsDrawing(true);
            }
            return;
          } else {
            // Touching outside - commit the floating selection
            commitFloatingSelection();
            return;
          }
        }

        // Check if touching inside an existing area selection bounds (for drag)
        if (selection && selection.selectionType === 'area' && isPointInSelectionBounds(x, y)) {
          e.preventDefault();
          const cell = canvasToCellUnbounded(x, y);
          if (cell) {
            startDrag(cell);
            setIsDrawing(true);
          }
          return;
        }

        // Start new area selection
        e.preventDefault();
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          startAreaSelection(cell);
          setIsDrawing(true);
        }
        return;
      }

      // Drawing tools - handle pencil, eraser, fill, and shape tools
      if (selectedColorId || activeTool === 'eraser') {
        const cell = canvasToCell(x, y);
        if (cell) {
          if (activeTool === 'pencil' && selectedColorId) {
            // Begin stroke batching so undo reverts the entire stroke
            beginStroke();
            // For circles, determine position from click location within cell
            const cellSize = CELL_SIZE * zoom;
            const circlePosition = activeStitchType === 'circle'
              ? getCirclePositionFromClick(x - panOffset.x, y - panOffset.y, cell.x, cell.y, cellSize)
              : undefined;
            setStitch(cell.x, cell.y, selectedColorId, activeStitchType, circlePosition);
            setIsDrawing(true);
            setLastCell(cell);
            return;
          } else if (activeTool === 'eraser') {
            // Begin stroke batching so undo reverts the entire stroke
            beginStroke();
            // Use precise eraser
            const cellSize = CELL_SIZE * zoom;
            removeStitchAtPoint(x - panOffset.x, y - panOffset.y, cellSize);
            setIsDrawing(true);
            setLastCell(cell);
            return;
          } else if (activeTool === 'fill' && selectedColorId) {
            fillArea(cell.x, cell.y, selectedColorId);
            return;
          } else if ((activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse') && selectedColorId) {
            // Start shape drawing
            setShapeStart(cell);
            setShapeEnd(cell);
            setIsDrawing(true);
            return;
          }
        }
      }

      // Default: start single-finger pan (for navigating when no drawing tool action)
      setTouchState({
        isPanning: true,
        lastTouchX: touch.clientX,
        lastTouchY: touch.clientY,
        initialPinchDistance: null,
        initialZoom: zoom,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!pattern) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Two-finger: pinch-zoom and pan
    if (e.touches.length === 2 && touchState && touchState.initialPinchDistance !== null) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      // Calculate zoom change
      const scale = distance / touchState.initialPinchDistance;
      const newZoom = Math.max(0.1, Math.min(5, touchState.initialZoom * scale));

      // Pan with the center of the two fingers
      const dx = centerX - touchState.lastTouchX;
      const dy = centerY - touchState.lastTouchY;

      // Apply zoom change centered on pinch point
      if (newZoom !== zoom) {
        const pinchX = centerX - rect.left;
        const pinchY = centerY - rect.top;

        // Calculate the point in pattern space at the pinch center
        const patternX = (pinchX - panOffset.x) / (CELL_SIZE * zoom);
        const patternY = (pinchY - panOffset.y) / (CELL_SIZE * zoom);

        // Calculate new pan offset to keep that pattern point at the pinch center
        const newPanX = pinchX - patternX * CELL_SIZE * newZoom + dx;
        const newPanY = pinchY - patternY * CELL_SIZE * newZoom + dy;

        setPanOffset({ x: newPanX, y: newPanY });
        setZoom(newZoom);
      } else {
        // Just pan
        setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });
      }

      setTouchState({
        isPanning: touchState.isPanning,
        lastTouchX: centerX,
        lastTouchY: centerY,
        initialPinchDistance: touchState.initialPinchDistance,
        initialZoom: touchState.initialZoom,
      });
      return;
    }

    // Single finger operations
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Handle progress mode dragging
      if (isProgressMode && isDrawing && progressDragRef.current) {
        e.preventDefault();
        const cellSize = CELL_SIZE * zoom;
        const cellX = Math.floor((x - panOffset.x) / cellSize);
        const cellY = Math.floor((y - panOffset.y) / cellSize);

        // Only update if we've moved to a new cell
        if (cellX !== progressDragRef.current.lastCellX || cellY !== progressDragRef.current.lastCellY) {
          // Use Bresenham's line algorithm to fill all cells between last and current
          const x0 = progressDragRef.current.lastCellX;
          const y0 = progressDragRef.current.lastCellY;
          const x1 = cellX;
          const y1 = cellY;

          const dx = Math.abs(x1 - x0);
          const dy = Math.abs(y1 - y0);
          const sx = x0 < x1 ? 1 : -1;
          const sy = y0 < y1 ? 1 : -1;
          let err = dx - dy;
          let cx = x0;
          let cy = y0;

          while (true) {
            // Set this cell (skip the starting cell since it's already set)
            if (cx !== x0 || cy !== y0) {
              if (cx >= 0 && cx < pattern.canvas.width && cy >= 0 && cy < pattern.canvas.height) {
                setStitchCompleted(cx, cy, progressDragRef.current.targetState);
              }
            }

            if (cx === x1 && cy === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) {
              err -= dy;
              cx += sx;
            }
            if (e2 < dx) {
              err += dx;
              cy += sy;
            }
          }

          progressDragRef.current.lastCellX = cellX;
          progressDragRef.current.lastCellY = cellY;
        }
        return;
      }

      // Handle blockfill dragging - mark entire 5x5 blocks as we drag across them
      if (isProgressMode && isDrawing && blockFillDragRef.current) {
        e.preventDefault();
        const cellSize = CELL_SIZE * zoom;
        const cellX = Math.floor((x - panOffset.x) / cellSize);
        const cellY = Math.floor((y - panOffset.y) / cellSize);

        // Calculate current block
        const blockStartX = Math.floor(cellX / gridDivisions) * gridDivisions;
        const blockStartY = Math.floor(cellY / gridDivisions) * gridDivisions;

        // Only update if we've moved to a new block
        if (blockStartX !== blockFillDragRef.current.lastBlockX || blockStartY !== blockFillDragRef.current.lastBlockY) {
          // Check if within canvas bounds
          if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
            setAreaCompleted(blockStartX, blockStartY, gridDivisions, gridDivisions, blockFillDragRef.current.targetState);
          }
          blockFillDragRef.current.lastBlockX = blockStartX;
          blockFillDragRef.current.lastBlockY = blockStartY;
        }
        return;
      }

      // Handle overlay dragging/resizing
      if (activeTool === 'select' && isDrawing && overlayDragState && selectedOverlayId && selectedOverlay) {
        e.preventDefault();
        const cellSize = CELL_SIZE * zoom;
        const deltaX = (x - overlayDragState.startX) / cellSize;
        const deltaY = (y - overlayDragState.startY) / cellSize;

        if (overlayDragState.isDragging) {
          updateOverlayPosition(
            selectedOverlayId,
            Math.round(overlayDragState.startOverlayX + deltaX),
            Math.round(overlayDragState.startOverlayY + deltaY)
          );
        } else if (overlayDragState.isResizing && overlayDragState.resizeHandle) {
          const handle = overlayDragState.resizeHandle;
          let newX = overlayDragState.startOverlayX;
          let newY = overlayDragState.startOverlayY;
          let newWidth = overlayDragState.startOverlayWidth;
          let newHeight = overlayDragState.startOverlayHeight;

          const aspectRatio = selectedOverlay.naturalWidth / selectedOverlay.naturalHeight;

          if (handle.includes('n')) {
            newY = overlayDragState.startOverlayY + deltaY;
            newHeight = overlayDragState.startOverlayHeight - deltaY;
          }
          if (handle.includes('s')) {
            newHeight = overlayDragState.startOverlayHeight + deltaY;
          }
          if (handle.includes('w')) {
            newX = overlayDragState.startOverlayX + deltaX;
            newWidth = overlayDragState.startOverlayWidth - deltaX;
          }
          if (handle.includes('e')) {
            newWidth = overlayDragState.startOverlayWidth + deltaX;
          }

          // Maintain aspect ratio for corner handles
          if (newWidth >= 1 && newHeight >= 1) {
            if (handle === 'n' || handle === 's') {
              const adjustedWidth = newHeight * aspectRatio;
              const widthDiff = adjustedWidth - overlayDragState.startOverlayWidth;
              newWidth = adjustedWidth;
              newX = overlayDragState.startOverlayX - widthDiff / 2;
            } else if (handle === 'e' || handle === 'w') {
              const adjustedHeight = newWidth / aspectRatio;
              const heightDiff = adjustedHeight - overlayDragState.startOverlayHeight;
              newHeight = adjustedHeight;
              newY = overlayDragState.startOverlayY - heightDiff / 2;
            } else {
              const widthFromHeight = newHeight * aspectRatio;
              const heightFromWidth = newWidth / aspectRatio;

              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                newHeight = heightFromWidth;
                if (handle.includes('n')) {
                  newY = overlayDragState.startOverlayY + overlayDragState.startOverlayHeight - newHeight;
                }
              } else {
                newWidth = widthFromHeight;
                if (handle.includes('w')) {
                  newX = overlayDragState.startOverlayX + overlayDragState.startOverlayWidth - newWidth;
                }
              }
            }

            updateOverlayPosition(selectedOverlayId, Math.round(newX), Math.round(newY));
            updateOverlaySize(selectedOverlayId, Math.round(newWidth), Math.round(newHeight));
          }
        }
        return;
      }

      // Handle layer selection dragging/resizing/rotating
      if (activeTool === 'select' && isDrawing && selection) {
        e.preventDefault();
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          if (selection.isRotating) {
            updateRotation(cell);
          } else if (selection.isResizing) {
            updateResize(cell, false); // No shift key on touch
          } else if (selection.isDragging) {
            updateDrag(cell);
          }
        }
        return;
      }

      // Handle multi-layer drag
      if (activeTool === 'select' && isDrawing && multiLayerDragState?.isDragging) {
        e.preventDefault();
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          updateMultiLayerDrag(cell);
        }
        return;
      }

      // Handle areaselect tool dragging/area selection
      if (activeTool === 'areaselect' && isDrawing && selection) {
        e.preventDefault();
        const cell = canvasToCellUnbounded(x, y);
        if (cell) {
          if (selection.isSelectingArea) {
            updateAreaSelection(cell);
          } else if (selection.isDragging) {
            updateDrag(cell);
          }
        }
        return;
      }

      // Handle drawing tools during touch drag
      if (isDrawing) {
        const cell = canvasToCell(x, y);

        // Shape tools - update preview
        if ((activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'ellipse') && shapeStart && cell) {
          e.preventDefault();
          setShapeEnd(cell);
          return;
        }

        // Pencil and eraser - continuous drawing
        // Allow same cell if different stitch type (for stacking cross/border types)
        if (cell && (!lastCell || cell.x !== lastCell.x || cell.y !== lastCell.y || lastCell.type !== activeStitchType)) {
          if (activeTool === 'pencil' && selectedColorId) {
            e.preventDefault();
            // For circles, determine position from click location within cell
            const cellSize = CELL_SIZE * zoom;
            const circlePosition = activeStitchType === 'circle'
              ? getCirclePositionFromClick(x - panOffset.x, y - panOffset.y, cell.x, cell.y, cellSize)
              : undefined;
            setStitch(cell.x, cell.y, selectedColorId, activeStitchType, circlePosition);
            setLastCell({ ...cell, type: activeStitchType });
            return;
          } else if (activeTool === 'eraser') {
            e.preventDefault();
            // Use precise eraser
            const cellSize = CELL_SIZE * zoom;
            removeStitchAtPoint(x - panOffset.x, y - panOffset.y, cellSize);
            setLastCell(cell);
            return;
          }
        }
      }

      // Single finger pan (when not doing drawing or select operations)
      if (touchState && touchState.isPanning) {
        const dx = touch.clientX - touchState.lastTouchX;
        const dy = touch.clientY - touchState.lastTouchY;

        setPanOffset({ x: panOffset.x + dx, y: panOffset.y + dy });

        setTouchState({
          isPanning: touchState.isPanning,
          lastTouchX: touch.clientX,
          lastTouchY: touch.clientY,
          initialPinchDistance: touchState.initialPinchDistance,
          initialZoom: touchState.initialZoom,
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    // Clear progress drag state
    if (progressDragRef.current) {
      progressDragRef.current = null;
    }

    // Clear block fill drag state
    if (blockFillDragRef.current) {
      blockFillDragRef.current = null;
    }

    // End overlay drag state
    if (overlayDragState) {
      setOverlayDragState(null);
    }

    // End stroke batching for pencil/eraser tools
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      endStroke();
    }

    // End layer selection drag/resize/rotate
    if (activeTool === 'select' && selection) {
      if (selection.isRotating) {
        endRotation();
      } else if (selection.isResizing) {
        endResize();
      } else if (selection.isDragging) {
        endDrag();
      }
    }

    // End multi-layer drag
    if (activeTool === 'select' && multiLayerDragState?.isDragging) {
      endMultiLayerDrag();
    }

    // End areaselect tool area selection or drag
    if (activeTool === 'areaselect' && selection) {
      if (selection.isSelectingArea) {
        // In progress mode, mark the entire selected area as complete instead of keeping selection
        if (isProgressMode && selection.bounds) {
          const { x, y, width, height } = selection.bounds;
          setAreaCompleted(x, y, width, height, true);
          clearSelection();
        } else {
          endAreaSelection();
        }
      } else if (selection.isDragging) {
        endDrag();
      }
    }

    // Finalize shape drawing
    if (shapeStart && shapeEnd && selectedColorId) {
      if (activeTool === 'line') {
        drawLine(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId);
      } else if (activeTool === 'rectangle') {
        drawRectangle(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId, true);
      } else if (activeTool === 'ellipse') {
        drawEllipse(shapeStart.x, shapeStart.y, shapeEnd.x, shapeEnd.y, selectedColorId, true);
      }
    }

    // Clear shape state
    setShapeStart(null);
    setShapeEnd(null);
    setIsDrawing(false);
    setLastCell(null);

    // If no more touches, end touch state
    if (e.touches.length === 0) {
      setTouchState(null);
      return;
    }

    // If switching from two fingers to one, reset touch state for single-finger pan
    if (e.touches.length === 1 && touchState) {
      const touch = e.touches[0];
      setTouchState({
        isPanning: true,
        lastTouchX: touch.clientX,
        lastTouchY: touch.clientY,
        initialPinchDistance: null,
        initialZoom: zoom,
      });
    }
  };

  if (!pattern) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-500">
        <div className="text-center">
          <p className="text-lg">No pattern loaded</p>
          <p className="text-sm mt-2">Create a new pattern to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden bg-gray-200 flex flex-col"
    >
      {/* Top row: corner + top ruler + corner + scrollbar corner */}
      <div className="flex" style={{ height: RULER_SIZE }}>
        {/* Top-left corner */}
        <div
          className="bg-gray-100 border-r border-b border-gray-300"
          style={{ width: RULER_SIZE, height: RULER_SIZE }}
        />
        {/* Top ruler */}
        <canvas
          ref={topRulerRef}
          className="flex-1 border-b border-gray-300"
          style={{ height: RULER_SIZE }}
        />
        {/* Top-right corner */}
        <div
          className="bg-gray-100 border-l border-b border-gray-300"
          style={{ width: RULER_SIZE, height: RULER_SIZE }}
        />
        {/* Scrollbar corner spacer */}
        {showVerticalScrollbar && (
          <div
            className="bg-gray-100 border-b border-gray-300"
            style={{ width: SCROLLBAR_SIZE, height: RULER_SIZE }}
          />
        )}
      </div>

      {/* Main row: left ruler + canvas + right ruler + vertical scrollbar */}
      <div className="flex flex-1 relative" data-canvas-viewport>
        {/* Left ruler */}
        <canvas
          ref={leftRulerRef}
          className="border-r border-gray-300"
          style={{ width: RULER_SIZE }}
        />
        {/* Main canvas container */}
        <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="absolute inset-0 touch-none"
            style={{ cursor: getCursor() }}
          />
        </div>
        {/* Right ruler */}
        <canvas
          ref={rightRulerRef}
          className="border-l border-gray-300"
          style={{ width: RULER_SIZE }}
        />
        {/* Vertical scrollbar */}
        {showVerticalScrollbar && (
          <div
            ref={vScrollTrackRef}
            className="bg-gray-100 border-l border-gray-300 cursor-pointer"
            style={{ width: SCROLLBAR_SIZE }}
            onClick={handleVerticalTrackClick}
          >
            {/* Scrollbar track */}
            <div className="relative w-full h-full">
              {/* Scrollbar thumb */}
              <div
                data-scroll-thumb="true"
                className="absolute left-1 right-1 bg-gray-400 hover:bg-gray-500 rounded-full transition-colors cursor-grab active:cursor-grabbing"
                style={{
                  top: `${scrollY * (100 - thumbHeightPercent * 100)}%`,
                  height: `${thumbHeightPercent * 100}%`,
                  minHeight: 20,
                }}
                onMouseDown={handleVerticalScrollMouseDown}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: horizontal scrollbar */}
      {showHorizontalScrollbar && (
        <div className="flex" style={{ height: SCROLLBAR_SIZE }}>
          {/* Left spacer for ruler */}
          <div
            className="bg-gray-100 border-r border-t border-gray-300"
            style={{ width: RULER_SIZE, height: SCROLLBAR_SIZE }}
          />
          {/* Horizontal scrollbar */}
          <div
            ref={hScrollTrackRef}
            className="flex-1 bg-gray-100 border-t border-gray-300 cursor-pointer"
            onClick={handleHorizontalTrackClick}
          >
            {/* Scrollbar track */}
            <div className="relative w-full h-full">
              {/* Scrollbar thumb */}
              <div
                data-scroll-thumb="true"
                className="absolute top-1 bottom-1 bg-gray-400 hover:bg-gray-500 rounded-full transition-colors cursor-grab active:cursor-grabbing"
                style={{
                  left: `${scrollX * (100 - thumbWidthPercent * 100)}%`,
                  width: `${thumbWidthPercent * 100}%`,
                  minWidth: 20,
                }}
                onMouseDown={handleHorizontalScrollMouseDown}
              />
            </div>
          </div>
          {/* Right spacer for ruler */}
          <div
            className="bg-gray-100 border-l border-t border-gray-300"
            style={{ width: RULER_SIZE, height: SCROLLBAR_SIZE }}
          />
          {/* Corner spacer */}
          {showVerticalScrollbar && (
            <div
              className="bg-gray-100 border-t border-gray-300"
              style={{ width: SCROLLBAR_SIZE, height: SCROLLBAR_SIZE }}
            />
          )}
        </div>
      )}
    </div>
  );
}
