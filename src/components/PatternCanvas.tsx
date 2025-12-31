import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { usePatternStore, ResizeHandle, Color } from '../stores/patternStore';

const CELL_SIZE = 20; // Base cell size in pixels
const RULER_SIZE = 24; // Width/height of rulers in pixels
const HANDLE_SIZE = 8; // Size of resize handles in pixels

interface PatternCanvasProps {
  showSymbols?: boolean;
  showCenterMarker?: boolean;
}

export function PatternCanvas({ showSymbols = true, showCenterMarker = true }: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);
  const rightRulerRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastCell, setLastCell] = useState<{ x: number; y: number } | null>(null);
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
    removeStitch,
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
    commitFloatingSelection,
    selectOverlay,
    deselectOverlay,
    updateOverlayPosition,
    updateOverlaySize,
    isProgressMode,
    toggleStitchCompleted,
    progressShadingColor: storeShadingColor,
    progressShadingOpacity: storeShadingOpacity,
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

    // Draw all visible layers (bottom to top)
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;

      for (const stitch of layer.stitches) {
        const colorObj = getColorObject(stitch.colorId);
        if (colorObj) {
          const rgb = colorObj.rgb;
          // In progress mode, grey out completed stitches
          const isCompleted = isProgressMode && stitch.completed;

          // Draw the stitch background
          if (isCompleted) {
            // Blend stitch color with shading color based on opacity
            const blendFactor = progressShadingOpacity / 100;
            const blendedR = Math.round(rgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor);
            const blendedG = Math.round(rgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor);
            const blendedB = Math.round(rgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor);
            ctx.fillStyle = `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
          } else {
            ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          }
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
            if (isCompleted) {
              // Calculate blended background color
              const blendFactor = progressShadingOpacity / 100;
              const blendedRgb: [number, number, number] = [
                Math.round(rgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor),
                Math.round(rgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor),
                Math.round(rgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor),
              ];
              // Get contrast color and blend it with shading color too
              const baseContrastColor = getContrastColor(blendedRgb);
              const contrastRgb = baseContrastColor === '#ffffff' ? [255, 255, 255] : [0, 0, 0];
              const shadedSymbolR = Math.round(contrastRgb[0] * (1 - blendFactor) + progressShadingColor[0] * blendFactor);
              const shadedSymbolG = Math.round(contrastRgb[1] * (1 - blendFactor) + progressShadingColor[1] * blendFactor);
              const shadedSymbolB = Math.round(contrastRgb[2] * (1 - blendFactor) + progressShadingColor[2] * blendFactor);
              ctx.fillStyle = `rgb(${shadedSymbolR}, ${shadedSymbolG}, ${shadedSymbolB})`;
            } else {
              ctx.fillStyle = getContrastColor(rgb);
            }
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

      // Draw floating stitches (new content being placed)
      if (selection.floatingStitches) {
        for (const stitch of selection.floatingStitches) {
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
      }

      // Draw selection rectangle (dashed)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(left, top, selWidth, selHeight);
      ctx.setLineDash([]);

      // Draw resize handles
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
          const rx = (Math.abs(shapeEnd.x - shapeStart.x) + 1) * cellSize / 2;
          const ry = (Math.abs(shapeEnd.y - shapeStart.y) + 1) * cellSize / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [pattern, zoom, panOffset, showGrid, gridDivisions, getColor, getColorObject, getContrastColor, showSymbols, showCenterMarker, selection, shapeStart, shapeEnd, selectedColorId, activeTool, overlayImages, overlayImageElements, selectedOverlayId, isProgressMode, progressShadingColor, progressShadingOpacity]);

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
            ctx.fillText(String(mm / 10) + 'cm', x, 12);
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
            ctx.fillText(String(mm / 10) + 'cm', 0, 0);
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
            ctx.fillText(String(mm / 10) + 'cm', 0, 0);
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

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pattern) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Pan mode works in both normal and progress mode
    if (activeTool === 'pan') {
      setIsDrawing(true);
      setLastCell({ x: e.clientX, y: e.clientY });
      return;
    }

    // Progress mode: clicking toggles stitch completion (when not panning)
    if (isProgressMode) {
      const cellSize = CELL_SIZE * zoom;
      const cellX = Math.floor((x - panOffset.x) / cellSize);
      const cellY = Math.floor((y - panOffset.y) / cellSize);

      // Check if within canvas bounds
      if (cellX >= 0 && cellX < pattern.canvas.width && cellY >= 0 && cellY < pattern.canvas.height) {
        toggleStitchCompleted(cellX, cellY);
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

      // Check if clicking on a resize handle
      const handle = getResizeHandleAt(x, y);
      if (handle && selection) {
        const cell = canvasToCell(x, y);
        if (cell) {
          startResize(handle, cell);
          setIsDrawing(true);
        }
        return;
      }

      // Check if clicking inside selection bounds (for drag)
      if (selection && isPointInSelectionBounds(x, y)) {
        const cell = canvasToCell(x, y);
        if (cell) {
          startDrag(cell);
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

    // For drawing tools, require a selected color
    if (!selectedColorId) return;

    const cell = canvasToCell(x, y);
    if (!cell) return;

    if (activeTool === 'pencil') {
      setStitch(cell.x, cell.y, selectedColorId);
      setIsDrawing(true);
      setLastCell(cell);
    } else if (activeTool === 'eraser') {
      removeStitch(cell.x, cell.y);
      setIsDrawing(true);
      setLastCell(cell);
    } else if (activeTool === 'fill') {
      fillArea(cell.x, cell.y, selectedColorId);
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

    // Handle select tool dragging/resizing
    if (activeTool === 'select' && isDrawing && selection) {
      const cell = canvasToCell(x, y);
      if (cell) {
        if (selection.isResizing) {
          updateResize(cell);
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

    // For pencil/eraser, skip if same cell
    if (lastCell && cell.x === lastCell.x && cell.y === lastCell.y) return;

    if (activeTool === 'pencil' && selectedColorId) {
      setStitch(cell.x, cell.y, selectedColorId);
      setLastCell(cell);
    } else if (activeTool === 'eraser') {
      removeStitch(cell.x, cell.y);
      setLastCell(cell);
    }
  };

  const handleMouseUp = () => {
    // Clear overlay drag state
    if (overlayDragState) {
      setOverlayDragState(null);
    }

    // Handle select tool drag/resize end
    if (activeTool === 'select' && selection) {
      if (selection.isResizing) {
        endResize();
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

    // Cancel any ongoing drag/resize
    if (activeTool === 'select' && selection) {
      if (selection.isResizing) {
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

  // Get cursor based on current state
  const getCursor = useCallback((): string => {
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
        return 'pointer';
      }

      return 'crosshair';
    }
    return 'crosshair';
  }, [activeTool, mousePos, selection, selectedOverlay, getResizeHandleAt, isPointInSelectionBounds, getOverlayResizeHandle, isPointInSelectedOverlay, getOverlayAtPoint, isProgressMode]);

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
      {/* Top row: corner + top ruler + corner */}
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
      </div>

      {/* Main row: left ruler + canvas + right ruler */}
      <div className="flex flex-1 relative">
        {/* Left ruler */}
        <canvas
          ref={leftRulerRef}
          className="border-r border-gray-300"
          style={{ width: RULER_SIZE }}
        />
        {/* Main canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className="flex-1"
          style={{ cursor: getCursor() }}
        />
        {/* Right ruler */}
        <canvas
          ref={rightRulerRef}
          className="border-l border-gray-300"
          style={{ width: RULER_SIZE }}
        />
      </div>
    </div>
  );
}
