import { create } from 'zustand';
import {
  autoAssignSymbols as doAutoAssignSymbols,
  SymbolAssignmentMode,
  getNextAvailableSymbol,
  assignMissingSymbols,
} from '../utils/symbolAssignment';
import { renderTextToStitches } from '../utils/textToStitches';

// Generate a unique file ID for session history tracking
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Types matching the Rust NDP format
export interface Color {
  id: string;
  name: string;
  rgb: [number, number, number];
  threadBrand?: string;
  threadCode?: string;
  symbol?: string;
}

// Stitch type - square is the default, circle can be placed at 9 positions
// Half-square triangles: half-tl (top-left), half-tr (top-right), half-bl (bottom-left), half-br (bottom-right)
// Half-square rectangles: half-top, half-bottom, half-left, half-right
// Quarter-square: quarter-tl, quarter-tr, quarter-bl, quarter-br
// Border: border-top, border-bottom, border-left, border-right
// Cross lines: cross-tlbr (top-left to bottom-right), cross-trbl (top-right to bottom-left)
// Full circle: circle-full (fills entire cell like square but with circle shape)
export type StitchType = 'square' | 'circle' | 'circle-full' | 'half-tl' | 'half-tr' | 'half-bl' | 'half-br' | 'half-top' | 'half-bottom' | 'half-left' | 'half-right' | 'quarter-tl' | 'quarter-tr' | 'quarter-bl' | 'quarter-br' | 'border-top' | 'border-bottom' | 'border-left' | 'border-right' | 'cross-tlbr' | 'cross-trbl';

// Helper to check if a stitch type is a partial-square (half, quarter, or full circle - NOT borders or crosses)
// These types overwrite each other - only one per cell
export function isHalfSquareType(type: StitchType | undefined): boolean {
  return type === 'half-tl' || type === 'half-tr' || type === 'half-bl' || type === 'half-br' ||
         type === 'half-top' || type === 'half-bottom' || type === 'half-left' || type === 'half-right' ||
         type === 'quarter-tl' || type === 'quarter-tr' || type === 'quarter-bl' || type === 'quarter-br' ||
         type === 'circle-full';
}

// Helper to check if a stitch type is a border (borders can stack - multiple per cell)
export function isBorderType(type: StitchType | undefined): boolean {
  return type === 'border-top' || type === 'border-bottom' || type === 'border-left' || type === 'border-right';
}

// Helper to check if a stitch type is a cross line (cross lines can stack - both per cell)
export function isCrossType(type: StitchType | undefined): boolean {
  return type === 'cross-tlbr' || type === 'cross-trbl';
}

// Circle position - 9 positions on a 3x3 grid within each cell
export type CirclePosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// All 9 circle positions for shape tools
export const ALL_CIRCLE_POSITIONS: CirclePosition[] = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

// Helper to determine circle position from click location within a cell
export function getCirclePositionFromClick(
  clickX: number,
  clickY: number,
  cellX: number,
  cellY: number,
  cellSize: number
): CirclePosition {
  // Calculate relative position within the cell (0-1)
  const relX = (clickX - cellX * cellSize) / cellSize;
  const relY = (clickY - cellY * cellSize) / cellSize;

  // Divide cell into 3x3 grid (each zone is ~33% of cell)
  const getZone = (rel: number): 'start' | 'middle' | 'end' => {
    if (rel < 0.33) return 'start';
    if (rel > 0.67) return 'end';
    return 'middle';
  };

  const xZone = getZone(relX);
  const yZone = getZone(relY);

  // Map zones to positions
  if (yZone === 'start') {
    if (xZone === 'start') return 'top-left';
    if (xZone === 'middle') return 'top-center';
    return 'top-right';
  } else if (yZone === 'middle') {
    if (xZone === 'start') return 'middle-left';
    if (xZone === 'middle') return 'center';
    return 'middle-right';
  } else {
    if (xZone === 'start') return 'bottom-left';
    if (xZone === 'middle') return 'bottom-center';
    return 'bottom-right';
  }
}

export interface Stitch {
  x: number;
  y: number;
  colorId: string;
  completed: boolean;
  type?: StitchType;  // Optional for backward compatibility, defaults to 'square'
  position?: CirclePosition;  // For circles only - where to place it (defaults to 'center')
}

// Text orientation options
export type TextOrientation = 'horizontal' | 'vertical-up' | 'vertical-down' | 'stacked';

// Text alignment options (for multiline text)
export type TextAlignment = 'left' | 'center' | 'right';

// Metadata stored with text layers for re-rendering on resize
export interface TextLayerMetadata {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  colorId: string;
  boldness: number;
  orientation?: TextOrientation; // Default: 'horizontal'
  alignment?: TextAlignment;     // Default: 'left'
}

export type LayerMetadata = TextLayerMetadata; // Extensible for other layer types

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  stitches: Stitch[];
  metadata?: LayerMetadata; // Optional metadata for special layer types
}

export interface CanvasConfig {
  width: number;      // in stitches
  height: number;     // in stitches
  meshCount: number;  // holes per inch
}

export interface Pattern {
  fileId: string; // Unique identifier for session history tracking (persists across renames/moves)
  name: string;
  canvas: CanvasConfig;
  colorPalette: Color[];
  layers: Layer[];
}

export type Tool = 'pencil' | 'eraser' | 'fill' | 'pan' | 'select' | 'areaselect' | 'text' | 'line' | 'rectangle' | 'ellipse' | 'colorswap' | 'blockfill';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export type AnchorPosition =
  | 'top-left' | 'top' | 'top-right'
  | 'left' | 'center' | 'right'
  | 'bottom-left' | 'bottom' | 'bottom-right';

export type RulerUnit = 'inches' | 'mm' | 'squares';

export interface SelectionState {
  layerId: string;
  bounds: { x: number; y: number; width: number; height: number };
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: ResizeHandle | null;
  dragStart: { x: number; y: number } | null;
  originalBounds: { x: number; y: number; width: number; height: number } | null;
  originalStitches: Stitch[] | null;
  // Floating stitches are new content not yet added to any layer (e.g., text being placed)
  floatingStitches: Stitch[] | null;
  // Area selection fields
  selectionType: 'layer' | 'area';
  selectedStitches?: Stitch[];  // Stitches within area selection
  isSelectingArea?: boolean;    // True while dragging to create area selection
  selectionStart?: { x: number; y: number };  // Start point of rectangle drag
  // When true, floating stitches will be committed to a new layer instead of active layer
  commitToNewLayer?: boolean;
  // Rotation fields
  isRotating?: boolean;
  rotationAngle?: number;  // Current rotation angle in degrees
  rotationStartAngle?: number;  // Mouse angle when rotation drag started
  originalRotationAngle?: number;  // Rotation angle before current drag
}

export interface OverlayImage {
  id: string;
  name: string;
  dataUrl: string;
  opacity: number; // 0-100
  visible: boolean;
  locked: boolean;
  // Position and size in grid cells
  x: number;
  y: number;
  width: number;
  height: number;
  // Original image dimensions for aspect ratio
  naturalWidth: number;
  naturalHeight: number;
}

interface PatternState {
  // Pattern data
  pattern: Pattern | null;
  currentFilePath: string | null;
  hasUnsavedChanges: boolean;

  // History for undo/redo
  history: Pattern[];
  future: Pattern[];
  maxHistorySize: number;
  isInStroke: boolean; // Track if we're in the middle of a drawing stroke

  // Editor state
  selectedColorId: string | null;
  activeTool: Tool;
  activeStitchType: StitchType;
  activeCirclePosition: CirclePosition;
  zoom: number;
  panOffset: { x: number; y: number };
  showGrid: boolean;
  gridDivisions: number;
  rulerUnit: RulerUnit;

  // Layer state
  activeLayerId: string | null;
  selection: SelectionState | null;
  selectedLayerIds: string[]; // For multi-layer selection
  multiLayerDragState: {
    isDragging: boolean;
    dragStart: { x: number; y: number } | null;
    originalPositions: Map<string, { x: number; y: number }[]> | null; // layerId -> stitch positions
  } | null;

  // Overlay images for tracing
  overlayImages: OverlayImage[];
  selectedOverlayId: string | null;

  // Progress tracking mode
  isProgressMode: boolean;
  progressShadingColor: [number, number, number]; // RGB for completed stitch overlay
  progressShadingOpacity: number; // 0-100

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setMaxHistorySize: (size: number) => void;

  // Stroke batching (for undo to undo entire strokes, not individual stitches)
  beginStroke: () => void;
  endStroke: () => void;

  // Pattern actions
  closePattern: () => void;
  createNewPattern: (name: string, width: number, height: number, meshCount: number) => void;
  importPattern: (name: string, width: number, height: number, meshCount: number, colors: Color[], stitches: Stitch[]) => void;
  loadPattern: (pattern: Pattern, filePath: string) => void;
  setStitch: (x: number, y: number, colorId: string, type?: StitchType, position?: CirclePosition) => void;
  removeStitch: (x: number, y: number) => void;
  removeStitchAtPoint: (canvasX: number, canvasY: number, cellSize: number) => void;
  fillArea: (x: number, y: number, colorId: string) => void;
  drawLine: (x1: number, y1: number, x2: number, y2: number, colorId: string) => void;
  drawRectangle: (x1: number, y1: number, x2: number, y2: number, colorId: string, filled: boolean) => void;
  drawEllipse: (x1: number, y1: number, x2: number, y2: number, colorId: string, filled: boolean) => void;
  addColor: (color: Color) => void;
  removeColor: (colorId: string) => void;
  selectColor: (colorId: string | null) => void;
  setTool: (tool: Tool) => void;
  setActiveStitchType: (type: StitchType) => void;
  setActiveCirclePosition: (position: CirclePosition) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  fitToScreen: () => void;
  toggleGrid: () => void;
  setGridDivisions: (divisions: number) => void;
  setRulerUnit: (unit: RulerUnit) => void;
  setCurrentFilePath: (path: string | null) => void;
  markSaved: () => void;
  regenerateFileId: () => string; // Generate new fileId (for Save As)

  // Layer management actions
  setActiveLayer: (layerId: string) => void;
  addLayer: (name?: string) => void;
  removeLayer: (layerId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  reorderLayer: (layerId: string, direction: 'up' | 'down') => void;
  mergeLayers: (sourceLayerId: string, targetLayerId: string) => void;
  mergeAllLayers: () => void;
  duplicateLayer: (layerId: string) => void;

  // Import as layer
  importAsLayer: (name: string, colors: Color[], stitches: Stitch[], metadata?: LayerMetadata) => void;

  // Merge into active layer (adds colors to palette, overwrites stitches at same positions)
  mergeIntoActiveLayer: (colors: Color[], stitches: Stitch[]) => void;

  // Update existing text layer with new content
  updateLayerWithText: (layerId: string, stitches: Stitch[], metadata: TextLayerMetadata) => void;

  // Symbol assignment actions
  updateColorSymbol: (colorId: string, symbol: string) => void;
  autoAssignSymbols: (mode?: 'usage' | 'lightness' | 'sequential') => void;
  clearAllSymbols: () => void;

  // Selection/Transform actions
  selectLayerForTransform: (layerId: string) => void;
  clearSelection: () => void;
  startDrag: (point: { x: number; y: number }) => void;
  updateDrag: (point: { x: number; y: number }) => void;
  endDrag: () => void;
  startResize: (handle: ResizeHandle, point: { x: number; y: number }) => void;
  updateResize: (point: { x: number; y: number }, shiftKey?: boolean) => void;
  endResize: () => void;
  startRotation: (point: { x: number; y: number }) => void;
  updateRotation: (point: { x: number; y: number }) => void;
  endRotation: () => void;
  getLayerBounds: (layerId: string) => { x: number; y: number; width: number; height: number } | null;

  // Floating selection actions (for placing new content like text)
  createFloatingSelection: (stitches: Stitch[], width: number, height: number, position: { x: number; y: number }) => void;
  commitFloatingSelection: () => void;
  cancelFloatingSelection: () => void;

  // Area selection actions
  startAreaSelection: (point: { x: number; y: number }) => void;
  updateAreaSelection: (point: { x: number; y: number }) => void;
  endAreaSelection: () => void;
  duplicateSelection: () => void;
  moveSelection: () => void;
  deleteSelection: () => void;
  selectionToNewLayer: () => void;
  duplicateSelectionToNewLayer: () => void;
  flipSelectionHorizontal: () => void;
  flipSelectionVertical: () => void;
  rotateSelectionLeft: () => void;
  rotateSelectionRight: () => void;

  // Layer transform actions (for whole layer when select tool is active)
  duplicateLayerToNewLayer: () => void;
  flipLayerHorizontal: () => void;
  flipLayerVertical: () => void;
  rotateLayerLeft: () => void;
  rotateLayerRight: () => void;

  // Multi-layer selection actions
  toggleLayerInSelection: (layerId: string) => void;
  addLayersToSelection: (layerIds: string[]) => void;
  clearLayerSelection: () => void;
  selectAllLayers: () => void;
  moveSelectedLayers: (deltaX: number, deltaY: number) => void;
  startMultiLayerDrag: (point: { x: number; y: number }) => void;
  updateMultiLayerDrag: (point: { x: number; y: number }) => void;
  endMultiLayerDrag: () => void;
  getMultiLayerBounds: () => { x: number; y: number; width: number; height: number } | null;

  // Overlay image actions
  addOverlayImage: (dataUrl: string, naturalWidth: number, naturalHeight: number, name?: string) => void;
  setOverlayImages: (overlays: OverlayImage[]) => void;
  updateOverlayOpacity: (id: string, opacity: number) => void;
  toggleOverlayVisibility: (id: string) => void;
  toggleOverlayLock: (id: string) => void;
  removeOverlayImage: (id: string) => void;
  selectOverlay: (id: string) => void;
  deselectOverlay: () => void;
  updateOverlayPosition: (id: string, x: number, y: number) => void;
  updateOverlaySize: (id: string, width: number, height: number) => void;
  reorderOverlay: (id: string, direction: 'up' | 'down') => void;

  // Progress tracking actions
  toggleProgressMode: () => void;
  setProgressMode: (enabled: boolean) => void;
  toggleStitchCompleted: (x: number, y: number) => void;
  setStitchCompleted: (x: number, y: number, completed: boolean) => void;
  setAreaCompleted: (x: number, y: number, width: number, height: number, completed: boolean) => void;
  fillContiguousCompleted: (x: number, y: number, completed: boolean) => void;
  getStitchCompleted: (x: number, y: number) => boolean;
  setProgressShadingColor: (color: [number, number, number]) => void;
  setProgressShadingOpacity: (opacity: number) => void;

  // Color swap action
  swapColorOnLayer: (fromColorId: string, toColorId: string) => void;

  // Canvas resize action
  resizeCanvas: (newWidth: number, newHeight: number, newMeshCount: number, anchor: AnchorPosition) => void;
}

// Default colors for new patterns (DMC 310 Black)
const defaultColors: Color[] = [
  { id: 'color-black', name: 'Black', rgb: [0, 0, 0], threadBrand: 'DMC', threadCode: '310', symbol: 'U' },
];

// Helper function to calculate layer bounding box
function calculateLayerBounds(stitches: Stitch[]): { x: number; y: number; width: number; height: number } | null {
  if (stitches.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stitch of stitches) {
    minX = Math.min(minX, stitch.x);
    minY = Math.min(minY, stitch.y);
    maxX = Math.max(maxX, stitch.x);
    maxY = Math.max(maxY, stitch.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// Helper function to resample stitches when resizing
// Uses reverse mapping to ensure no gaps when scaling up
function resampleStitches(
  stitches: Stitch[],
  originalBounds: { x: number; y: number; width: number; height: number },
  newBounds: { x: number; y: number; width: number; height: number }
): Stitch[] {
  if (stitches.length === 0 || originalBounds.width === 0 || originalBounds.height === 0) {
    return stitches;
  }

  // Create a lookup map of original stitches by position (relative to bounds)
  const originalMap = new Map<string, Stitch>();
  for (const stitch of stitches) {
    const relX = stitch.x - originalBounds.x;
    const relY = stitch.y - originalBounds.y;
    originalMap.set(`${relX},${relY}`, stitch);
  }

  const result: Stitch[] = [];

  // For each pixel in the new bounds, find the corresponding source pixel
  // This reverse mapping ensures no gaps when scaling up
  for (let newRelY = 0; newRelY < newBounds.height; newRelY++) {
    for (let newRelX = 0; newRelX < newBounds.width; newRelX++) {
      // Map back to original coordinates (use floor for nearest-neighbor sampling)
      const srcRelX = Math.floor((newRelX * originalBounds.width) / newBounds.width);
      const srcRelY = Math.floor((newRelY * originalBounds.height) / newBounds.height);

      const srcKey = `${srcRelX},${srcRelY}`;
      const srcStitch = originalMap.get(srcKey);

      if (srcStitch) {
        result.push({
          x: newBounds.x + newRelX,
          y: newBounds.y + newRelY,
          colorId: srcStitch.colorId,
          completed: srcStitch.completed,
        });
      }
    }
  }

  return result;
}

// Helper function to rotate stitches around a center point
// Uses inverse mapping to prevent gaps in contiguous colored areas
function rotateStitches(
  stitches: Stitch[],
  center: { x: number; y: number },
  angleDegrees: number
): Stitch[] {
  if (stitches.length === 0 || angleDegrees === 0) {
    return stitches;
  }

  // Create a lookup map of original stitches by position
  const originalMap = new Map<string, Stitch>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const stitch of stitches) {
    originalMap.set(`${stitch.x},${stitch.y}`, stitch);
    minX = Math.min(minX, stitch.x);
    minY = Math.min(minY, stitch.y);
    maxX = Math.max(maxX, stitch.x);
    maxY = Math.max(maxY, stitch.y);
  }

  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  // For inverse mapping, we need the inverse rotation (negative angle)
  const invCos = Math.cos(-angleRad);
  const invSin = Math.sin(-angleRad);

  // Calculate the bounding box of the rotated result
  // by rotating all four corners of the original bounding box
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ];

  let rotMinX = Infinity, rotMinY = Infinity, rotMaxX = -Infinity, rotMaxY = -Infinity;
  for (const corner of corners) {
    const dx = corner.x - center.x;
    const dy = corner.y - center.y;
    const rotX = dx * cos - dy * sin + center.x;
    const rotY = dx * sin + dy * cos + center.y;
    rotMinX = Math.min(rotMinX, rotX);
    rotMinY = Math.min(rotMinY, rotY);
    rotMaxX = Math.max(rotMaxX, rotX);
    rotMaxY = Math.max(rotMaxY, rotY);
  }

  // Expand bounds slightly to ensure we don't miss edge pixels
  rotMinX = Math.floor(rotMinX) - 1;
  rotMinY = Math.floor(rotMinY) - 1;
  rotMaxX = Math.ceil(rotMaxX) + 1;
  rotMaxY = Math.ceil(rotMaxY) + 1;

  // Use inverse mapping: for each cell in the output, find the source cell
  const result: Stitch[] = [];

  for (let y = rotMinY; y <= rotMaxY; y++) {
    for (let x = rotMinX; x <= rotMaxX; x++) {
      // Inverse rotate this output position back to find source position
      const dx = x - center.x;
      const dy = y - center.y;
      const srcX = dx * invCos - dy * invSin + center.x;
      const srcY = dx * invSin + dy * invCos + center.y;

      // Round to find the source cell
      const srcCellX = Math.round(srcX);
      const srcCellY = Math.round(srcY);

      // Check if there's a stitch at that source position
      const srcStitch = originalMap.get(`${srcCellX},${srcCellY}`);
      if (srcStitch) {
        result.push({
          ...srcStitch,
          x,
          y,
        });
      }
    }
  }

  return result;
}

// Deep clone a pattern for history
function clonePattern(pattern: Pattern): Pattern {
  return {
    fileId: pattern.fileId,
    name: pattern.name,
    canvas: { ...pattern.canvas },
    colorPalette: pattern.colorPalette.map(c => ({ ...c })),
    layers: pattern.layers.map(l => ({
      ...l,
      stitches: l.stitches.map(s => ({ ...s })),
      metadata: l.metadata ? { ...l.metadata } : undefined,
    })),
  };
}

// Helper to get anchor offset value for a given axis
// Returns: -1 (start), 0 (center), 1 (end)
function getAnchorValue(anchor: AnchorPosition, axis: 'x' | 'y'): number {
  const xValues: Record<AnchorPosition, number> = {
    'top-left': -1, 'top': 0, 'top-right': 1,
    'left': -1, 'center': 0, 'right': 1,
    'bottom-left': -1, 'bottom': 0, 'bottom-right': 1,
  };
  const yValues: Record<AnchorPosition, number> = {
    'top-left': -1, 'top': -1, 'top-right': -1,
    'left': 0, 'center': 0, 'right': 0,
    'bottom-left': 1, 'bottom': 1, 'bottom-right': 1,
  };
  return axis === 'x' ? xValues[anchor] : yValues[anchor];
}

// Calculate coordinate offset based on anchor position
function calculateAnchorOffset(oldSize: number, newSize: number, anchorValue: number): number {
  const diff = newSize - oldSize;
  if (anchorValue === -1) return 0;           // Anchor at start, extend/clip at end
  if (anchorValue === 1) return diff;         // Anchor at end, extend/clip at start
  return Math.floor(diff / 2);                // Center anchor, extend/clip equally
}

// Transform stitches for canvas resize based on anchor position
function transformStitchesForCanvasResize(
  stitches: Stitch[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  anchor: AnchorPosition
): Stitch[] {
  const offsetX = calculateAnchorOffset(oldWidth, newWidth, getAnchorValue(anchor, 'x'));
  const offsetY = calculateAnchorOffset(oldHeight, newHeight, getAnchorValue(anchor, 'y'));

  return stitches
    .map(s => ({
      ...s,
      x: s.x + offsetX,
      y: s.y + offsetY,
    }))
    .filter(s =>
      s.x >= 0 && s.x < newWidth &&
      s.y >= 0 && s.y < newHeight
    );
}

// Detect how many stitches will be clipped during canvas resize
export function detectClippedContent(
  layers: Layer[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  anchor: AnchorPosition
): { stitchesClipped: number; layersAffected: string[] } {
  const offsetX = calculateAnchorOffset(oldWidth, newWidth, getAnchorValue(anchor, 'x'));
  const offsetY = calculateAnchorOffset(oldHeight, newHeight, getAnchorValue(anchor, 'y'));

  let totalClipped = 0;
  const affectedLayers: string[] = [];

  for (const layer of layers) {
    let layerClipped = 0;
    for (const stitch of layer.stitches) {
      const newX = stitch.x + offsetX;
      const newY = stitch.y + offsetY;
      if (newX < 0 || newX >= newWidth || newY < 0 || newY >= newHeight) {
        layerClipped++;
      }
    }
    if (layerClipped > 0) {
      totalClipped += layerClipped;
      affectedLayers.push(layer.name);
    }
  }

  return { stitchesClipped: totalClipped, layersAffected: affectedLayers };
}

export const usePatternStore = create<PatternState>((set, get) => {
  // Helper to push current pattern to history before making changes
  const pushToHistory = () => {
    const { pattern, history, maxHistorySize } = get();
    if (!pattern) return;

    const cloned = clonePattern(pattern);
    const newHistory = [...history, cloned].slice(-maxHistorySize);

    set({
      history: newHistory,
      future: [], // Clear redo stack on new action
    });
  };

  return {
  // Initial state
  pattern: null,
  currentFilePath: null,
  hasUnsavedChanges: false,
  history: [],
  future: [],
  maxHistorySize: 50,
  isInStroke: false,
  selectedColorId: null,
  activeTool: 'pan',
  activeStitchType: 'square' as StitchType,
  activeCirclePosition: 'center' as CirclePosition,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  showGrid: true,
  gridDivisions: 5,
  rulerUnit: 'inches' as RulerUnit,
  activeLayerId: null,
  selection: null,
  selectedLayerIds: [],
  multiLayerDragState: null,
  overlayImages: [],
  selectedOverlayId: null,
  isProgressMode: false,
  progressShadingColor: [128, 128, 128] as [number, number, number], // Default grey
  progressShadingOpacity: 70, // 70% opacity

  // Undo/Redo actions
  undo: () => {
    const { pattern, history, future } = get();
    if (history.length === 0 || !pattern) return;

    const newHistory = [...history];
    const previousPattern = newHistory.pop()!;
    const newFuture = [clonePattern(pattern), ...future];

    set({
      pattern: previousPattern,
      history: newHistory,
      future: newFuture,
      hasUnsavedChanges: true,
      selection: null, // Clear selection on undo
      selectedLayerIds: [], // Clear multi-selection on undo
      multiLayerDragState: null,
    });
  },

  redo: () => {
    const { pattern, history, future } = get();
    if (future.length === 0 || !pattern) return;

    const newFuture = [...future];
    const nextPattern = newFuture.shift()!;
    const newHistory = [...history, clonePattern(pattern)];

    set({
      pattern: nextPattern,
      history: newHistory,
      future: newFuture,
      hasUnsavedChanges: true,
      selection: null, // Clear selection on redo
      selectedLayerIds: [], // Clear multi-selection on redo
      multiLayerDragState: null,
    });
  },

  canUndo: () => get().history.length > 0,

  canRedo: () => get().future.length > 0,

  setMaxHistorySize: (size) => {
    const { history } = get();
    set({
      maxHistorySize: size,
      history: history.slice(-size),
    });
  },

  // Stroke batching - call beginStroke before a series of setStitch calls,
  // and endStroke after, so undo reverts the entire stroke
  beginStroke: () => {
    const { pattern, isInStroke } = get();
    if (!pattern || isInStroke) return;

    // Push current state to history before starting the stroke
    const { history, maxHistorySize } = get();
    const cloned = clonePattern(pattern);
    const newHistory = [...history, cloned].slice(-maxHistorySize);

    set({
      isInStroke: true,
      history: newHistory,
      future: [], // Clear future on new action
    });
  },

  endStroke: () => {
    set({ isInStroke: false });
  },

  // Actions
  closePattern: () => {
    set({
      pattern: null,
      currentFilePath: null,
      hasUnsavedChanges: false,
      history: [],
      future: [],
      selectedColorId: null,
      activeLayerId: null,
      activeTool: 'pan',
      selection: null,
      selectedLayerIds: [],
      multiLayerDragState: null,
      overlayImages: [],
      selectedOverlayId: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      isProgressMode: false,
    });
  },

  createNewPattern: (name, width, height, meshCount) => {
    const layerId = 'layer-1';
    set({
      pattern: {
        fileId: generateFileId(),
        name,
        canvas: { width, height, meshCount },
        colorPalette: [...defaultColors],
        layers: [{
          id: layerId,
          name: 'Base Layer',
          visible: true,
          locked: false,
          stitches: [],
        }],
      },
      selectedColorId: 'color-black', // Default to black
      activeLayerId: layerId,
      selection: null,
      selectedLayerIds: [],
      multiLayerDragState: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      currentFilePath: null,
      hasUnsavedChanges: false,
      history: [], // Clear history for new pattern
      future: [],
      overlayImages: [], // Clear overlays for new pattern
      selectedOverlayId: null,
    });
  },

  importPattern: (name, width, height, meshCount, colors, stitches) => {
    const layerId = 'layer-1';
    // Auto-assign symbols to colors that don't have them
    const colorsWithSymbols = assignMissingSymbols(colors);
    set({
      pattern: {
        fileId: generateFileId(),
        name,
        canvas: { width, height, meshCount },
        colorPalette: colorsWithSymbols,
        layers: [{
          id: layerId,
          name: name, // Use image/pattern name for the layer
          visible: true,
          locked: false,
          stitches,
        }],
      },
      selectedColorId: colorsWithSymbols.find(c => c.name === 'Black')?.id ?? (colorsWithSymbols.length > 0 ? colorsWithSymbols[0].id : null),
      activeLayerId: layerId,
      activeTool: 'pan',
      selection: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      currentFilePath: null,
      hasUnsavedChanges: true,
      history: [], // Clear history for imported pattern
      future: [],
      overlayImages: [], // Clear overlays for imported pattern
      selectedOverlayId: null,
    });
  },

  loadPattern: (pattern, filePath) => {
    const firstLayerId = pattern.layers.length > 0 ? pattern.layers[0].id : null;
    // Auto-assign symbols to colors that don't have them
    const colorsWithSymbols = assignMissingSymbols(pattern.colorPalette);
    const patternWithSymbols = {
      ...pattern,
      // Generate fileId if not present (backwards compatibility)
      fileId: pattern.fileId || generateFileId(),
      colorPalette: colorsWithSymbols,
    };
    set({
      pattern: patternWithSymbols,
      selectedColorId: colorsWithSymbols.find(c => c.name === 'Black')?.id ?? (colorsWithSymbols.length > 0 ? colorsWithSymbols[0].id : null),
      activeLayerId: firstLayerId,
      activeTool: 'pan',
      selection: null,
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      currentFilePath: filePath,
      hasUnsavedChanges: false,
      history: [], // Clear history for loaded pattern
      future: [],
      overlayImages: [], // Clear overlays for loaded pattern
      selectedOverlayId: null,
    });
  },

  setStitch: (x, y, colorId, type?, position?) => {
    const { pattern, activeLayerId, activeStitchType, activeCirclePosition } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    // Check bounds
    if (x < 0 || x >= pattern.canvas.width || y < 0 || y >= pattern.canvas.height) return;

    // Determine effective type and position
    const effectiveType = type ?? activeStitchType;
    const effectivePosition = position ?? (effectiveType === 'circle' ? activeCirclePosition : undefined);
    const isNewHalfSquare = isHalfSquareType(effectiveType);

    // Find existing stitch at position with same type and position
    // Stitch uniqueness is by (x, y, type, position)
    // Exception: half-square types overwrite each other (only one half-square per cell)
    const existingIndex = activeLayer.stitches.findIndex(s =>
      s.x === x &&
      s.y === y &&
      (s.type || 'square') === effectiveType &&
      (effectiveType === 'circle' ? (s.position || 'center') === effectivePosition : true)
    );

    // Check if stitch already exists with same color - no need to change anything
    if (existingIndex >= 0 && activeLayer.stitches[existingIndex].colorId === colorId) return;

    // Only push to history if not in a stroke (stroke batching handles history)
    const { isInStroke } = get();
    if (!isInStroke) {
      pushToHistory();
    }

    let updatedStitches = [...activeLayer.stitches];

    // If placing a half-square, remove any existing half-square at this position
    // (different half-square type overwrites previous one)
    if (isNewHalfSquare) {
      updatedStitches = updatedStitches.filter(s =>
        !(s.x === x && s.y === y && isHalfSquareType(s.type))
      );
    }

    const newStitch: Stitch = {
      x,
      y,
      colorId,
      completed: false,
      type: effectiveType === 'square' ? undefined : effectiveType, // Don't store 'square' for backward compatibility
      position: effectiveType === 'circle' ? effectivePosition : undefined,
    };

    // Find existing after potential half-square removal
    const updatedExistingIndex = updatedStitches.findIndex(s =>
      s.x === x &&
      s.y === y &&
      (s.type || 'square') === effectiveType &&
      (effectiveType === 'circle' ? (s.position || 'center') === effectivePosition : true)
    );

    if (updatedExistingIndex >= 0) {
      // Update existing stitch
      updatedStitches[updatedExistingIndex] = newStitch;
    } else {
      // Add new stitch
      updatedStitches.push(newStitch);
    }

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: updatedStitches,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  removeStitch: (x, y) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    // Check if stitch exists at position
    const existingIndex = activeLayer.stitches.findIndex(s => s.x === x && s.y === y);
    if (existingIndex === -1) return; // No stitch to remove

    // Only push to history if not in a stroke (stroke batching handles history)
    const { isInStroke } = get();
    if (!isInStroke) {
      pushToHistory();
    }

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: activeLayer.stitches.filter(s => !(s.x === x && s.y === y)),
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  removeStitchAtPoint: (canvasX, canvasY, cellSize) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    // Helper to get circle center position
    const getCircleCenter = (stitch: Stitch): { centerX: number; centerY: number } => {
      const baseX = stitch.x * cellSize;
      const baseY = stitch.y * cellSize;
      const half = cellSize / 2;
      const pos = stitch.position || 'center';

      switch (pos) {
        case 'top-left': return { centerX: baseX, centerY: baseY };
        case 'top-center': return { centerX: baseX + half, centerY: baseY };
        case 'top-right': return { centerX: baseX + cellSize, centerY: baseY };
        case 'middle-left': return { centerX: baseX, centerY: baseY + half };
        case 'center': return { centerX: baseX + half, centerY: baseY + half };
        case 'middle-right': return { centerX: baseX + cellSize, centerY: baseY + half };
        case 'bottom-left': return { centerX: baseX, centerY: baseY + cellSize };
        case 'bottom-center': return { centerX: baseX + half, centerY: baseY + cellSize };
        case 'bottom-right': return { centerX: baseX + cellSize, centerY: baseY + cellSize };
        default: return { centerX: baseX + half, centerY: baseY + half };
      }
    };

    // Check if point is over a stitch
    const isPointOverStitch = (stitch: Stitch): boolean => {
      const stitchType = stitch.type || 'square';

      if (stitchType === 'square') {
        // Square: check if point is within cell bounds
        const cellLeft = stitch.x * cellSize;
        const cellTop = stitch.y * cellSize;
        return (
          canvasX >= cellLeft &&
          canvasX < cellLeft + cellSize &&
          canvasY >= cellTop &&
          canvasY < cellTop + cellSize
        );
      } else if (stitchType === 'circle') {
        // Circle: check if point is within circle radius (0.28 = 25% larger than half cell)
        const { centerX, centerY } = getCircleCenter(stitch);
        const radius = cellSize * 0.28;
        const dx = canvasX - centerX;
        const dy = canvasY - centerY;
        return (dx * dx + dy * dy) <= (radius * radius);
      }

      return false;
    };

    // Find all stitches at this point
    const stitchesToRemove = activeLayer.stitches.filter(isPointOverStitch);
    if (stitchesToRemove.length === 0) return;

    // Only push to history if not in a stroke (stroke batching handles history)
    const { isInStroke } = get();
    if (!isInStroke) {
      pushToHistory();
    }

    // Remove the stitches
    const updatedStitches = activeLayer.stitches.filter(s => !isPointOverStitch(s));

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: updatedStitches,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  fillArea: (startX, startY, colorId) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    const { width, height } = pattern.canvas;

    // Create a map of existing stitches
    const stitchMap = new Map<string, Stitch>();
    activeLayer.stitches.forEach(s => {
      stitchMap.set(`${s.x},${s.y}`, s);
    });

    // Get the color at start position (or null if empty)
    const startKey = `${startX},${startY}`;
    const startStitch = stitchMap.get(startKey);
    const targetColorId = startStitch?.colorId ?? null;

    // Don't fill if clicking on same color
    if (targetColorId === colorId) return;

    pushToHistory();

    // Flood fill using BFS
    const visited = new Set<string>();
    const queue: [number, number][] = [[startX, startY]];
    const newStitches: Stitch[] = [];

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const stitch = stitchMap.get(key);
      const currentColorId = stitch?.colorId ?? null;

      if (currentColorId !== targetColorId) continue;

      visited.add(key);
      newStitches.push({ x, y, colorId, completed: false });

      // Add neighbors
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Merge new stitches with existing
    const updatedStitches = activeLayer.stitches.filter(s => !visited.has(`${s.x},${s.y}`));
    updatedStitches.push(...newStitches);

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: updatedStitches,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  drawLine: (x1, y1, x2, y2, colorId) => {
    const { pattern, activeLayerId, activeStitchType } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    pushToHistory();

    // Bresenham's line algorithm
    const newStitches: Stitch[] = [];
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    while (true) {
      if (x >= 0 && x < pattern.canvas.width && y >= 0 && y < pattern.canvas.height) {
        // For circles, add all 9 positions per cell
        if (activeStitchType === 'circle') {
          for (const position of ALL_CIRCLE_POSITIONS) {
            newStitches.push({
              x,
              y,
              colorId,
              completed: false,
              type: 'circle',
              position,
            });
          }
        } else {
          newStitches.push({
            x,
            y,
            colorId,
            completed: false,
            type: activeStitchType === 'square' ? undefined : activeStitchType,
          });
        }
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    // Merge new stitches with existing
    // For stackable types (borders, crosses, circles), use composite key with type/position
    // For non-stackable types, just use position
    const stitchMap = new Map<string, Stitch>();
    const getKey = (s: Stitch) => {
      const type = s.type || 'square';
      if (type === 'circle') {
        return `${s.x},${s.y},circle,${s.position || 'center'}`;
      }
      if (isBorderType(type) || isCrossType(type)) {
        return `${s.x},${s.y},${type}`;
      }
      return `${s.x},${s.y}`;
    };
    activeLayer.stitches.forEach(s => stitchMap.set(getKey(s), s));
    newStitches.forEach(s => stitchMap.set(getKey(s), s));

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: Array.from(stitchMap.values()),
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  drawRectangle: (x1, y1, x2, y2, colorId, filled) => {
    const { pattern, activeLayerId, activeStitchType } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    pushToHistory();

    const minX = Math.max(0, Math.min(x1, x2));
    const maxX = Math.min(pattern.canvas.width - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(pattern.canvas.height - 1, Math.max(y1, y2));

    const newStitches: Stitch[] = [];
    const stitchType = activeStitchType === 'square' ? undefined : activeStitchType;

    // Helper to add stitch(es) at a position - for circles, add all 9 positions
    const addStitchAt = (x: number, y: number) => {
      if (activeStitchType === 'circle') {
        for (const position of ALL_CIRCLE_POSITIONS) {
          newStitches.push({ x, y, colorId, completed: false, type: 'circle', position });
        }
      } else {
        newStitches.push({ x, y, colorId, completed: false, type: stitchType });
      }
    };

    if (filled) {
      // Fill entire rectangle
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          addStitchAt(x, y);
        }
      }
    } else {
      // Draw outline only
      for (let x = minX; x <= maxX; x++) {
        addStitchAt(x, minY);
        addStitchAt(x, maxY);
      }
      for (let y = minY + 1; y < maxY; y++) {
        addStitchAt(minX, y);
        addStitchAt(maxX, y);
      }
    }

    // Merge new stitches with existing
    // For stackable types (borders, crosses, circles), use composite key with type/position
    const stitchMap = new Map<string, Stitch>();
    const getKey = (s: Stitch) => {
      const type = s.type || 'square';
      if (type === 'circle') {
        return `${s.x},${s.y},circle,${s.position || 'center'}`;
      }
      if (isBorderType(type) || isCrossType(type)) {
        return `${s.x},${s.y},${type}`;
      }
      return `${s.x},${s.y}`;
    };
    activeLayer.stitches.forEach(s => stitchMap.set(getKey(s), s));
    newStitches.forEach(s => stitchMap.set(getKey(s), s));

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: Array.from(stitchMap.values()),
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  drawEllipse: (x1, y1, x2, y2, colorId, filled) => {
    const { pattern, activeLayerId, activeStitchType } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    pushToHistory();

    // Calculate center and radii
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;

    const newStitches: Stitch[] = [];
    const stitchType = activeStitchType === 'square' ? undefined : activeStitchType;

    // Helper to add stitch(es) at a position - for circles, add all 9 positions
    const addStitchAt = (x: number, y: number) => {
      if (activeStitchType === 'circle') {
        for (const position of ALL_CIRCLE_POSITIONS) {
          newStitches.push({ x, y, colorId, completed: false, type: 'circle', position });
        }
      } else {
        newStitches.push({ x, y, colorId, completed: false, type: stitchType });
      }
    };

    if (filled) {
      // Filled ellipse - check each point in bounding box
      const minX = Math.max(0, Math.floor(cx - rx));
      const maxX = Math.min(pattern.canvas.width - 1, Math.ceil(cx + rx));
      const minY = Math.max(0, Math.floor(cy - ry));
      const maxY = Math.min(pattern.canvas.height - 1, Math.ceil(cy + ry));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          // Check if point is inside ellipse using ellipse equation
          const dx = (x + 0.5 - cx) / (rx || 0.5);
          const dy = (y + 0.5 - cy) / (ry || 0.5);
          if (dx * dx + dy * dy <= 1) {
            addStitchAt(x, y);
          }
        }
      }
    } else {
      // Outline ellipse - use midpoint ellipse algorithm
      if (rx < 0.5 || ry < 0.5) {
        // Too small, just draw a point
        const px = Math.round(cx);
        const py = Math.round(cy);
        if (px >= 0 && px < pattern.canvas.width && py >= 0 && py < pattern.canvas.height) {
          addStitchAt(px, py);
        }
      } else {
        // Midpoint ellipse algorithm for outline
        const plotPoint = (x: number, y: number) => {
          const px = Math.round(cx + x);
          const py = Math.round(cy + y);
          if (px >= 0 && px < pattern.canvas.width && py >= 0 && py < pattern.canvas.height) {
            addStitchAt(px, py);
          }
        };

        const plotSymmetricPoints = (x: number, y: number) => {
          plotPoint(x, y);
          plotPoint(-x, y);
          plotPoint(x, -y);
          plotPoint(-x, -y);
        };

        let x = 0;
        let y = ry;
        const rx2 = rx * rx;
        const ry2 = ry * ry;
        let p1 = ry2 - rx2 * ry + 0.25 * rx2;

        // Region 1
        while (ry2 * x < rx2 * y) {
          plotSymmetricPoints(x, y);
          x++;
          if (p1 < 0) {
            p1 += 2 * ry2 * x + ry2;
          } else {
            y--;
            p1 += 2 * ry2 * x - 2 * rx2 * y + ry2;
          }
        }

        // Region 2
        let p2 = ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2;
        while (y >= 0) {
          plotSymmetricPoints(x, y);
          y--;
          if (p2 > 0) {
            p2 += rx2 - 2 * rx2 * y;
          } else {
            x++;
            p2 += 2 * ry2 * x - 2 * rx2 * y + rx2;
          }
        }
      }
    }

    // Remove duplicates and merge with existing
    // For stackable types (borders, crosses, circles), use composite key with type/position
    const stitchMap = new Map<string, Stitch>();
    const getKey = (s: Stitch) => {
      const type = s.type || 'square';
      if (type === 'circle') {
        return `${s.x},${s.y},circle,${s.position || 'center'}`;
      }
      if (isBorderType(type) || isCrossType(type)) {
        return `${s.x},${s.y},${type}`;
      }
      return `${s.x},${s.y}`;
    };
    activeLayer.stitches.forEach(s => stitchMap.set(getKey(s), s));
    newStitches.forEach(s => stitchMap.set(getKey(s), s));

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: Array.from(stitchMap.values()),
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  addColor: (color) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    // Auto-assign a symbol if not already set
    const colorWithSymbol = color.symbol
      ? color
      : { ...color, symbol: getNextAvailableSymbol(pattern.colorPalette) };

    set({
      pattern: {
        ...pattern,
        colorPalette: [...pattern.colorPalette, colorWithSymbol],
      },
      hasUnsavedChanges: true,
    });
  },

  removeColor: (colorId) => {
    const { pattern, selectedColorId } = get();
    if (!pattern) return;

    pushToHistory();

    set({
      pattern: {
        ...pattern,
        colorPalette: pattern.colorPalette.filter(c => c.id !== colorId),
      },
      selectedColorId: selectedColorId === colorId ? null : selectedColorId,
      hasUnsavedChanges: true,
    });
  },

  selectColor: (colorId) => {
    set({ selectedColorId: colorId });
  },

  setTool: (tool) => {
    set({ activeTool: tool });
  },

  setActiveStitchType: (type) => {
    set({ activeStitchType: type });
  },

  setActiveCirclePosition: (position) => {
    set({ activeCirclePosition: position });
  },

  setZoom: (zoom) => {
    // Allow zoom from 5% to 500% to handle large patterns
    set({ zoom: Math.max(0.05, Math.min(5, zoom)) });
  },

  setPanOffset: (offset) => {
    set({ panOffset: offset });
  },

  fitToScreen: () => {
    const state = get();
    if (!state.pattern) return;

    const CELL_SIZE = 20;
    const RULER_SIZE = 24;

    // Try to find the canvas viewport element
    const canvasViewport = document.querySelector('[data-canvas-viewport]') as HTMLElement;

    let viewportWidth: number;
    let viewportHeight: number;

    if (canvasViewport) {
      const rect = canvasViewport.getBoundingClientRect();
      viewportWidth = rect.width - RULER_SIZE * 2;
      viewportHeight = rect.height;
    } else {
      // Fallback: estimate viewport size
      viewportWidth = window.innerWidth - 300 - RULER_SIZE * 2;
      viewportHeight = window.innerHeight - 100 - RULER_SIZE;
    }

    // Pattern size in pixels at zoom 1.0
    const patternWidth = state.pattern.canvas.width * CELL_SIZE;
    const patternHeight = state.pattern.canvas.height * CELL_SIZE;

    // Calculate fit zoom
    const zoomX = viewportWidth / patternWidth;
    const zoomY = viewportHeight / patternHeight;
    const fitZoom = Math.min(zoomX, zoomY);

    // Apply zoom (clamped) and reset pan
    set({
      zoom: Math.max(0.05, Math.min(5, fitZoom)),
      panOffset: { x: 0, y: 0 }
    });
  },

  toggleGrid: () => {
    set(state => ({ showGrid: !state.showGrid }));
  },

  setGridDivisions: (divisions) => {
    set({ gridDivisions: divisions });
  },

  setRulerUnit: (unit) => {
    set({ rulerUnit: unit });
  },

  setCurrentFilePath: (path) => {
    set({ currentFilePath: path });
  },

  markSaved: () => {
    set({ hasUnsavedChanges: false });
  },

  regenerateFileId: () => {
    const { pattern } = get();
    if (!pattern) return '';
    const newFileId = generateFileId();
    set({
      pattern: { ...pattern, fileId: newFileId },
    });
    return newFileId;
  },

  // Layer management actions
  setActiveLayer: (layerId) => {
    const { pattern } = get();
    if (!pattern) return;
    const layer = pattern.layers.find(l => l.id === layerId);
    if (layer) {
      set({ activeLayerId: layerId });
    }
  },

  addLayer: (name) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const newLayerId = `layer-${Date.now()}`;
    const layerNumber = pattern.layers.length + 1;
    const newLayer: Layer = {
      id: newLayerId,
      name: name || `Layer ${layerNumber}`,
      visible: true,
      locked: false,
      stitches: [],
    };

    set({
      pattern: {
        ...pattern,
        layers: [...pattern.layers, newLayer],
      },
      activeLayerId: newLayerId,
      hasUnsavedChanges: true,
    });
  },

  removeLayer: (layerId) => {
    const { pattern, activeLayerId, selection } = get();
    if (!pattern || pattern.layers.length <= 1) return; // Keep at least one layer

    const layerIndex = pattern.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    pushToHistory();

    const updatedLayers = pattern.layers.filter(l => l.id !== layerId);

    // If we're deleting the active layer, switch to another
    let newActiveLayerId = activeLayerId;
    if (activeLayerId === layerId) {
      newActiveLayerId = updatedLayers[Math.max(0, layerIndex - 1)]?.id || null;
    }

    // Clear selection if it was on the deleted layer
    const newSelection = selection?.layerId === layerId ? null : selection;

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      activeLayerId: newActiveLayerId,
      selection: newSelection,
      hasUnsavedChanges: true,
    });
  },

  renameLayer: (layerId, name) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const updatedLayers = pattern.layers.map(l =>
      l.id === layerId ? { ...l, name } : l
    );

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  toggleLayerVisibility: (layerId) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const updatedLayers = pattern.layers.map(l =>
      l.id === layerId ? { ...l, visible: !l.visible } : l
    );

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  toggleLayerLock: (layerId) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const updatedLayers = pattern.layers.map(l =>
      l.id === layerId ? { ...l, locked: !l.locked } : l
    );

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  reorderLayer: (layerId, direction) => {
    const { pattern } = get();
    if (!pattern) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const newIndex = direction === 'up' ? layerIndex + 1 : layerIndex - 1;
    if (newIndex < 0 || newIndex >= pattern.layers.length) return;

    pushToHistory();

    const updatedLayers = [...pattern.layers];
    [updatedLayers[layerIndex], updatedLayers[newIndex]] =
      [updatedLayers[newIndex], updatedLayers[layerIndex]];

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  mergeLayers: (sourceLayerId, targetLayerId) => {
    const { pattern, activeLayerId, selection } = get();
    if (!pattern) return;

    const sourceIndex = pattern.layers.findIndex(l => l.id === sourceLayerId);
    const targetIndex = pattern.layers.findIndex(l => l.id === targetLayerId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    pushToHistory();

    const sourceLayer = pattern.layers[sourceIndex];
    const targetLayer = pattern.layers[targetIndex];

    // Merge stitches (source overwrites target at same positions)
    const targetStitchMap = new Map<string, Stitch>();
    targetLayer.stitches.forEach(s => targetStitchMap.set(`${s.x},${s.y}`, s));
    sourceLayer.stitches.forEach(s => targetStitchMap.set(`${s.x},${s.y}`, s));

    const mergedStitches = Array.from(targetStitchMap.values());

    const updatedLayers = pattern.layers
      .filter(l => l.id !== sourceLayerId)
      .map(l => l.id === targetLayerId ? { ...l, stitches: mergedStitches, metadata: undefined } : l);

    // Update active layer if source was active
    let newActiveLayerId = activeLayerId;
    if (activeLayerId === sourceLayerId) {
      newActiveLayerId = targetLayerId;
    }

    // Clear selection if it was on the source layer
    const newSelection = selection?.layerId === sourceLayerId ? null : selection;

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      activeLayerId: newActiveLayerId,
      selection: newSelection,
      hasUnsavedChanges: true,
    });
  },

  mergeAllLayers: () => {
    const { pattern, selection } = get();
    if (!pattern || pattern.layers.length <= 1) return;

    pushToHistory();

    // Merge all stitches into one, with later layers (higher index) taking precedence
    const stitchMap = new Map<string, Stitch>();
    for (const layer of pattern.layers) {
      for (const stitch of layer.stitches) {
        stitchMap.set(`${stitch.x},${stitch.y}`, stitch);
      }
    }

    const mergedStitches = Array.from(stitchMap.values());

    // Keep the first layer as the merged result
    const firstLayer = pattern.layers[0];
    const mergedLayer: Layer = {
      id: firstLayer.id,
      name: 'Merged',
      visible: true,
      locked: false,
      stitches: mergedStitches,
      metadata: undefined, // Clear metadata since this is now a combined layer
    };

    // Clear selection if it was on a layer that no longer exists
    const newSelection = selection?.layerId === firstLayer.id ? selection : null;

    set({
      pattern: {
        ...pattern,
        layers: [mergedLayer],
      },
      activeLayerId: firstLayer.id,
      selection: newSelection,
      hasUnsavedChanges: true,
    });
  },

  duplicateLayer: (layerId) => {
    const { pattern } = get();
    if (!pattern) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    pushToHistory();

    const originalLayer = pattern.layers[layerIndex];
    const newLayerId = `layer-${Date.now()}`;
    const duplicatedLayer: Layer = {
      id: newLayerId,
      name: `${originalLayer.name} copy`,
      visible: true,
      locked: false,
      stitches: originalLayer.stitches.map(s => ({ ...s })),
    };

    const updatedLayers = [...pattern.layers];
    updatedLayers.splice(layerIndex + 1, 0, duplicatedLayer);

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      activeLayerId: newLayerId,
      hasUnsavedChanges: true,
    });
  },

  // Import as layer
  importAsLayer: (name, colors, stitches, metadata) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    // Build a map from threadCode to existing color ID for deduplication
    const existingCodeToId = new Map<string, string>();
    // Also build a map from RGB values to existing color ID for colors without threadCode
    const existingRgbToId = new Map<string, string>();
    for (const c of pattern.colorPalette) {
      if (c.threadCode) {
        existingCodeToId.set(c.threadCode, c.id);
      }
      // Always track RGB for fallback matching
      const rgbKey = `${c.rgb[0]},${c.rgb[1]},${c.rgb[2]}`;
      existingRgbToId.set(rgbKey, c.id);
    }

    // Build color ID remapping: new color ID -> existing color ID (if duplicate)
    const colorIdRemap = new Map<string, string>();
    const newColors: Color[] = [];

    for (const c of colors) {
      if (c.threadCode && existingCodeToId.has(c.threadCode)) {
        // This color already exists in palette by threadCode - remap to existing ID
        colorIdRemap.set(c.id, existingCodeToId.get(c.threadCode)!);
      } else {
        // Check for RGB match as fallback (for colors without threadCode)
        const rgbKey = `${c.rgb[0]},${c.rgb[1]},${c.rgb[2]}`;
        if (existingRgbToId.has(rgbKey)) {
          // This color already exists in palette by RGB - remap to existing ID
          colorIdRemap.set(c.id, existingRgbToId.get(rgbKey)!);
        } else {
          // New color - add to palette
          newColors.push(c);
          // Track this new color's threadCode and RGB
          if (c.threadCode) {
            existingCodeToId.set(c.threadCode, c.id);
          }
          existingRgbToId.set(rgbKey, c.id);
        }
      }
    }

    // Remap stitch color IDs to use existing palette colors where applicable
    const remappedStitches = stitches.map(s => {
      const remappedId = colorIdRemap.get(s.colorId);
      if (remappedId) {
        return { ...s, colorId: remappedId };
      }
      return s;
    });

    // Auto-assign symbols to all colors (existing + new) that don't have them
    const allColors = [...pattern.colorPalette, ...newColors];
    const colorsWithSymbols = assignMissingSymbols(allColors);

    const newLayerId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newLayerId,
      name,
      visible: true,
      locked: false,
      stitches: remappedStitches,
      metadata,
    };

    console.log('importAsLayer:', {
      inputColors: colors.length,
      newColors: newColors.length,
      remappedColors: colorIdRemap.size,
      inputStitches: stitches.length,
      remappedStitches: remappedStitches.length,
    });

    set({
      pattern: {
        ...pattern,
        colorPalette: colorsWithSymbols,
        layers: [...pattern.layers, newLayer],
      },
      activeLayerId: newLayerId,
      hasUnsavedChanges: true,
    });
  },

  // Merge into active layer - adds colors to palette, overwrites stitches at same positions
  mergeIntoActiveLayer: (colors, stitches) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || !activeLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    pushToHistory();

    // Build a map from threadCode to existing color ID for deduplication
    const existingCodeToId = new Map<string, string>();
    // Also build a map from RGB values to existing color ID for colors without threadCode
    const existingRgbToId = new Map<string, string>();
    for (const c of pattern.colorPalette) {
      if (c.threadCode) {
        existingCodeToId.set(c.threadCode, c.id);
      }
      const rgbKey = `${c.rgb[0]},${c.rgb[1]},${c.rgb[2]}`;
      existingRgbToId.set(rgbKey, c.id);
    }

    // Build color ID remapping: new color ID -> existing color ID (if duplicate)
    const colorIdRemap = new Map<string, string>();
    const newColors: Color[] = [];

    for (const c of colors) {
      if (c.threadCode && existingCodeToId.has(c.threadCode)) {
        colorIdRemap.set(c.id, existingCodeToId.get(c.threadCode)!);
      } else {
        const rgbKey = `${c.rgb[0]},${c.rgb[1]},${c.rgb[2]}`;
        if (existingRgbToId.has(rgbKey)) {
          colorIdRemap.set(c.id, existingRgbToId.get(rgbKey)!);
        } else {
          newColors.push(c);
          if (c.threadCode) {
            existingCodeToId.set(c.threadCode, c.id);
          }
          existingRgbToId.set(rgbKey, c.id);
        }
      }
    }

    // Remap stitch color IDs to use existing palette colors where applicable
    const remappedStitches = stitches.map(s => {
      const remappedId = colorIdRemap.get(s.colorId);
      return remappedId ? { ...s, colorId: remappedId } : s;
    });

    // Create a map of existing stitches by position for quick lookup
    const existingStitchMap = new Map<string, number>();
    activeLayer.stitches.forEach((s, index) => {
      existingStitchMap.set(`${s.x},${s.y}`, index);
    });

    // Merge stitches: new stitches overwrite existing ones at same position
    const mergedStitches = [...activeLayer.stitches];
    for (const newStitch of remappedStitches) {
      const key = `${newStitch.x},${newStitch.y}`;
      const existingIndex = existingStitchMap.get(key);
      if (existingIndex !== undefined) {
        // Overwrite existing stitch
        mergedStitches[existingIndex] = newStitch;
      } else {
        // Add new stitch
        mergedStitches.push(newStitch);
        existingStitchMap.set(key, mergedStitches.length - 1);
      }
    }

    // Update palette with new colors
    const colorsWithSymbols = assignMissingSymbols([...pattern.colorPalette, ...newColors]);

    // Update the layer
    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: mergedStitches,
    };

    console.log('mergeIntoActiveLayer:', {
      inputColors: colors.length,
      newColors: newColors.length,
      remappedColors: colorIdRemap.size,
      inputStitches: stitches.length,
      existingStitches: activeLayer.stitches.length,
      mergedStitches: mergedStitches.length,
    });

    set({
      pattern: {
        ...pattern,
        colorPalette: colorsWithSymbols,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  // Update existing text layer with new content
  updateLayerWithText: (layerId, stitches, metadata) => {
    const { pattern } = get();
    if (!pattern) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    pushToHistory();

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...pattern.layers[layerIndex],
      stitches,
      metadata,
    };

    // Recalculate selection bounds if this layer is selected
    const { selection } = get();
    let newSelection = selection;
    if (selection?.layerId === layerId) {
      const bounds = calculateLayerBounds(stitches);
      if (bounds) {
        newSelection = {
          ...selection,
          bounds,
        };
      }
    }

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      selection: newSelection,
      hasUnsavedChanges: true,
    });
  },

  // Symbol assignment actions
  updateColorSymbol: (colorId, symbol) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const updatedPalette = pattern.colorPalette.map(c =>
      c.id === colorId ? { ...c, symbol } : c
    );

    set({
      pattern: {
        ...pattern,
        colorPalette: updatedPalette,
      },
      hasUnsavedChanges: true,
    });
  },

  autoAssignSymbols: (mode: SymbolAssignmentMode = 'usage') => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    // Get all stitches from all layers
    const allStitches = pattern.layers.flatMap(l => l.stitches);

    // Auto-assign symbols
    const updatedPalette = doAutoAssignSymbols(pattern.colorPalette, allStitches, mode);

    set({
      pattern: {
        ...pattern,
        colorPalette: updatedPalette,
      },
      hasUnsavedChanges: true,
    });
  },

  clearAllSymbols: () => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const updatedPalette = pattern.colorPalette.map(c => {
      const { symbol, ...rest } = c;
      return rest as Color;
    });

    set({
      pattern: {
        ...pattern,
        colorPalette: updatedPalette,
      },
      hasUnsavedChanges: true,
    });
  },

  // Selection/Transform actions
  selectLayerForTransform: (layerId) => {
    const { pattern } = get();
    if (!pattern) return;

    const layer = pattern.layers.find(l => l.id === layerId);
    if (!layer || layer.stitches.length === 0) {
      set({ selection: null });
      return;
    }

    const bounds = calculateLayerBounds(layer.stitches);
    if (!bounds) {
      set({ selection: null });
      return;
    }

    // Also set this layer as the active layer for drawing
    set({
      activeLayerId: layerId,
      selection: {
        layerId,
        bounds,
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        dragStart: null,
        originalBounds: null,
        originalStitches: null,
        floatingStitches: null,
        selectionType: 'layer',
      },
    });
  },

  clearSelection: () => {
    set({ selection: null });
  },

  startDrag: (point) => {
    const { pattern, selection } = get();
    if (!pattern || !selection) return;

    // For floating selections, use the floating stitches
    if (selection.floatingStitches) {
      set({
        selection: {
          ...selection,
          isDragging: true,
          dragStart: point,
          originalBounds: { ...selection.bounds },
          originalStitches: selection.floatingStitches.map(s => ({ ...s })),
        },
      });
      return;
    }

    // For area selections, convert to floating selection for dragging
    if (selection.selectionType === 'area' && selection.selectedStitches?.length) {
      pushToHistory();

      // Remove selected stitches from their layers
      const toRemove = new Set(selection.selectedStitches.map(s => `${s.x},${s.y}`));
      const updatedLayers = pattern.layers.map(layer => ({
        ...layer,
        stitches: layer.stitches.filter(s => !toRemove.has(`${s.x},${s.y}`)),
      }));

      set({
        pattern: {
          ...pattern,
          layers: updatedLayers,
        },
        selection: {
          ...selection,
          isDragging: true,
          dragStart: point,
          originalBounds: { ...selection.bounds },
          originalStitches: selection.selectedStitches.map(s => ({ ...s })),
          floatingStitches: selection.selectedStitches.map(s => ({ ...s })),
        },
        hasUnsavedChanges: true,
      });
      return;
    }

    // For layer selections, use the layer's stitches
    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer) return;

    pushToHistory();

    set({
      selection: {
        ...selection,
        isDragging: true,
        dragStart: point,
        originalBounds: { ...selection.bounds },
        originalStitches: layer.stitches.map(s => ({ ...s })),
      },
    });
  },

  updateDrag: (point) => {
    const { pattern, selection } = get();
    if (!pattern || !selection || !selection.isDragging || !selection.dragStart || !selection.originalBounds) return;

    const deltaX = point.x - selection.dragStart.x;
    const deltaY = point.y - selection.dragStart.y;

    set({
      selection: {
        ...selection,
        bounds: {
          ...selection.bounds,
          x: selection.originalBounds.x + deltaX,
          y: selection.originalBounds.y + deltaY,
        },
      },
    });
  },

  endDrag: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || !selection.isDragging || !selection.originalBounds || !selection.originalStitches) return;

    const deltaX = selection.bounds.x - selection.originalBounds.x;
    const deltaY = selection.bounds.y - selection.originalBounds.y;

    // Move all stitches
    const movedStitches = selection.originalStitches.map(s => ({
      ...s,
      x: s.x + deltaX,
      y: s.y + deltaY,
    }));

    // For floating selections, just update the floating stitches without modifying layers
    if (selection.floatingStitches) {
      set({
        selection: {
          ...selection,
          isDragging: false,
          dragStart: null,
          originalBounds: null,
          originalStitches: null,
          floatingStitches: movedStitches,
        },
      });
      return;
    }

    const layerIndex = pattern.layers.findIndex(l => l.id === selection.layerId);
    if (layerIndex === -1) return;

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...pattern.layers[layerIndex],
      stitches: movedStitches,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      selection: {
        ...selection,
        isDragging: false,
        dragStart: null,
        originalBounds: null,
        originalStitches: null,
      },
      hasUnsavedChanges: true,
    });
  },

  startResize: (handle, point) => {
    const { pattern, selection } = get();
    if (!pattern || !selection) return;

    // For floating selections, use the floating stitches
    if (selection.floatingStitches) {
      set({
        selection: {
          ...selection,
          isResizing: true,
          resizeHandle: handle,
          dragStart: point,
          originalBounds: { ...selection.bounds },
          originalStitches: selection.floatingStitches.map(s => ({ ...s })),
        },
      });
      return;
    }

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer) return;

    pushToHistory();

    set({
      selection: {
        ...selection,
        isResizing: true,
        resizeHandle: handle,
        dragStart: point,
        originalBounds: { ...selection.bounds },
        originalStitches: layer.stitches.map(s => ({ ...s })),
      },
    });
  },

  updateResize: (point, shiftKey = false) => {
    const { selection } = get();
    if (!selection || !selection.isResizing || !selection.dragStart || !selection.originalBounds || !selection.resizeHandle) return;

    const deltaX = point.x - selection.dragStart.x;
    const deltaY = point.y - selection.dragStart.y;

    let newBounds = { ...selection.originalBounds };
    const handle = selection.resizeHandle;
    const originalAspectRatio = selection.originalBounds.width / selection.originalBounds.height;
    const maintainAspect = !shiftKey;

    // Update bounds based on which handle is being dragged
    if (handle.includes('n')) {
      newBounds.y = selection.originalBounds.y + deltaY;
      newBounds.height = selection.originalBounds.height - deltaY;
    }
    if (handle.includes('s')) {
      newBounds.height = selection.originalBounds.height + deltaY;
    }
    if (handle.includes('w')) {
      newBounds.x = selection.originalBounds.x + deltaX;
      newBounds.width = selection.originalBounds.width - deltaX;
    }
    if (handle.includes('e')) {
      newBounds.width = selection.originalBounds.width + deltaX;
    }

    // Ensure minimum size first
    newBounds.width = Math.max(1, newBounds.width);
    newBounds.height = Math.max(1, newBounds.height);

    // Maintain aspect ratio unless Shift is pressed
    if (maintainAspect) {
      if (handle === 'n' || handle === 's') {
        // Vertical only - adjust width to match, keeping centered
        const adjustedWidth = Math.round(newBounds.height * originalAspectRatio);
        const widthDiff = adjustedWidth - selection.originalBounds.width;
        newBounds.width = Math.max(1, adjustedWidth);
        newBounds.x = selection.originalBounds.x - Math.round(widthDiff / 2);
      } else if (handle === 'e' || handle === 'w') {
        // Horizontal only - adjust height to match, keeping centered
        const adjustedHeight = Math.round(newBounds.width / originalAspectRatio);
        const heightDiff = adjustedHeight - selection.originalBounds.height;
        newBounds.height = Math.max(1, adjustedHeight);
        newBounds.y = selection.originalBounds.y - Math.round(heightDiff / 2);
      } else {
        // Corner handle - use the larger delta to determine size
        const widthFromHeight = Math.round(newBounds.height * originalAspectRatio);
        const heightFromWidth = Math.round(newBounds.width / originalAspectRatio);

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Width is primary
          newBounds.height = Math.max(1, heightFromWidth);
          if (handle.includes('n')) {
            newBounds.y = selection.originalBounds.y + selection.originalBounds.height - newBounds.height;
          }
        } else {
          // Height is primary
          newBounds.width = Math.max(1, widthFromHeight);
          if (handle.includes('w')) {
            newBounds.x = selection.originalBounds.x + selection.originalBounds.width - newBounds.width;
          }
        }
      }
    }

    set({
      selection: {
        ...selection,
        bounds: newBounds,
      },
    });
  },

  endResize: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || !selection.isResizing || !selection.originalBounds || !selection.originalStitches) return;

    // Get layer to check for text metadata
    const layer = pattern.layers.find(l => l.id === selection.layerId);
    const textMetadata = layer?.metadata?.type === 'text' ? layer.metadata : null;

    let finalStitches: Stitch[];
    let updatedMetadata = layer?.metadata;

    // For text layers, re-render at the new size for best quality
    if (textMetadata && selection.bounds.height !== selection.originalBounds.height) {
      const newTargetHeight = selection.bounds.height;

      // Re-render text at new size
      const rendered = renderTextToStitches({
        text: textMetadata.text,
        fontFamily: textMetadata.fontFamily,
        fontWeight: textMetadata.fontWeight,
        italic: textMetadata.italic,
        targetHeight: newTargetHeight,
        colorId: textMetadata.colorId,
        boldness: textMetadata.boldness,
      });

      // Position the new stitches at the selection bounds position
      finalStitches = rendered.stitches.map(s => ({
        ...s,
        x: s.x + selection.bounds.x,
        y: s.y + selection.bounds.y,
      }));

      // Update metadata with new dimensions would happen automatically
      // since the metadata stores parameters, not cached results
    } else {
      // For non-text layers or when only moving (not resizing), use resample
      finalStitches = resampleStitches(
        selection.originalStitches,
        selection.originalBounds,
        selection.bounds
      );
    }

    // Recalculate bounds after transform
    const newBounds = calculateLayerBounds(finalStitches);

    // For floating selections, just update the floating stitches without modifying layers
    if (selection.floatingStitches) {
      set({
        selection: newBounds ? {
          ...selection,
          bounds: newBounds,
          isResizing: false,
          resizeHandle: null,
          dragStart: null,
          originalBounds: null,
          originalStitches: null,
          floatingStitches: finalStitches,
        } : null,
      });
      return;
    }

    const layerIndex = pattern.layers.findIndex(l => l.id === selection.layerId);
    if (layerIndex === -1) return;

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...pattern.layers[layerIndex],
      stitches: finalStitches,
      metadata: updatedMetadata,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      selection: newBounds ? {
        ...selection,
        bounds: newBounds,
        isResizing: false,
        resizeHandle: null,
        dragStart: null,
        originalBounds: null,
        originalStitches: null,
      } : null,
      hasUnsavedChanges: true,
    });
  },

  startRotation: (point) => {
    const { pattern, selection } = get();
    if (!pattern || !selection) return;

    // Get the stitches to rotate
    let stitchesToRotate: Stitch[];
    if (selection.floatingStitches) {
      stitchesToRotate = selection.floatingStitches;
    } else if (selection.selectionType === 'area' && selection.selectedStitches) {
      stitchesToRotate = selection.selectedStitches;
    } else {
      const layer = pattern.layers.find(l => l.id === selection.layerId);
      if (!layer) return;
      stitchesToRotate = layer.stitches;
    }

    // Calculate center of the selection bounds
    const centerX = selection.bounds.x + selection.bounds.width / 2;
    const centerY = selection.bounds.y + selection.bounds.height / 2;

    // Calculate the starting angle from center to mouse position
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    set({
      selection: {
        ...selection,
        isRotating: true,
        rotationAngle: selection.rotationAngle || 0,
        rotationStartAngle: startAngle,
        originalRotationAngle: selection.rotationAngle || 0,
        originalBounds: { ...selection.bounds },
        originalStitches: stitchesToRotate.map(s => ({ ...s })),
      },
    });
  },

  updateRotation: (point) => {
    const { selection } = get();
    if (!selection || !selection.isRotating || selection.rotationStartAngle === undefined) return;

    // Calculate center of the selection bounds
    const centerX = selection.bounds.x + selection.bounds.width / 2;
    const centerY = selection.bounds.y + selection.bounds.height / 2;

    // Calculate the current angle from center to mouse position
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Calculate the rotation delta
    const deltaAngle = currentAngle - selection.rotationStartAngle;
    const newAngle = (selection.originalRotationAngle || 0) + deltaAngle;

    set({
      selection: {
        ...selection,
        rotationAngle: newAngle,
      },
    });
  },

  endRotation: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || !selection.isRotating || !selection.originalStitches) return;

    const rotationAngle = selection.rotationAngle || 0;

    // Calculate center of the selection bounds
    const centerX = selection.bounds.x + selection.bounds.width / 2;
    const centerY = selection.bounds.y + selection.bounds.height / 2;

    // Rotate the stitches
    const rotatedStitches = rotateStitches(
      selection.originalStitches,
      { x: centerX, y: centerY },
      rotationAngle
    );

    // Recalculate bounds after rotation
    const newBounds = calculateLayerBounds(rotatedStitches);

    // For floating selections, just update the floating stitches
    if (selection.floatingStitches) {
      set({
        selection: newBounds ? {
          ...selection,
          bounds: newBounds,
          isRotating: false,
          rotationAngle: 0, // Reset angle since it's now applied
          rotationStartAngle: undefined,
          originalRotationAngle: undefined,
          originalBounds: null,
          originalStitches: null,
          floatingStitches: rotatedStitches,
        } : null,
      });
      return;
    }

    // For area selections, update the selected stitches (they become floating)
    if (selection.selectionType === 'area' && selection.selectedStitches) {
      // Remove original stitches from the layer
      const layer = pattern.layers.find(l => l.id === selection.layerId);
      if (!layer) return;

      pushToHistory();

      // Create a set of original stitch positions to remove
      const originalPositions = new Set(
        selection.originalStitches.map(s => `${s.x},${s.y}`)
      );

      const remainingStitches = layer.stitches.filter(
        s => !originalPositions.has(`${s.x},${s.y}`)
      );

      const layerIndex = pattern.layers.findIndex(l => l.id === selection.layerId);
      const updatedLayers = [...pattern.layers];
      updatedLayers[layerIndex] = {
        ...layer,
        stitches: [...remainingStitches, ...rotatedStitches],
      };

      set({
        pattern: {
          ...pattern,
          layers: updatedLayers,
        },
        selection: newBounds ? {
          ...selection,
          bounds: newBounds,
          isRotating: false,
          rotationAngle: 0,
          rotationStartAngle: undefined,
          originalRotationAngle: undefined,
          originalBounds: null,
          originalStitches: null,
          selectedStitches: rotatedStitches,
        } : null,
        hasUnsavedChanges: true,
      });
      return;
    }

    // For layer selections, update the layer stitches
    const layerIndex = pattern.layers.findIndex(l => l.id === selection.layerId);
    if (layerIndex === -1) return;

    pushToHistory();

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...pattern.layers[layerIndex],
      stitches: rotatedStitches,
      // Clear text metadata since rotation breaks re-rendering
      metadata: undefined,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      selection: newBounds ? {
        ...selection,
        bounds: newBounds,
        isRotating: false,
        rotationAngle: 0,
        rotationStartAngle: undefined,
        originalRotationAngle: undefined,
        originalBounds: null,
        originalStitches: null,
      } : null,
      hasUnsavedChanges: true,
    });
  },

  getLayerBounds: (layerId) => {
    const { pattern } = get();
    if (!pattern) return null;

    const layer = pattern.layers.find(l => l.id === layerId);
    if (!layer) return null;

    return calculateLayerBounds(layer.stitches);
  },

  // Floating selection actions
  createFloatingSelection: (stitches, width, height, position) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || stitches.length === 0) return;

    // Offset stitches to the specified position
    const positionedStitches = stitches.map(s => ({
      ...s,
      x: s.x + position.x,
      y: s.y + position.y,
    }));

    set({
      selection: {
        layerId: activeLayerId || pattern.layers[0]?.id || '',
        bounds: {
          x: position.x,
          y: position.y,
          width,
          height,
        },
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        dragStart: null,
        originalBounds: null,
        originalStitches: null,
        floatingStitches: positionedStitches,
        selectionType: 'layer',
      },
      activeTool: 'select', // Switch to select tool for positioning
    });
  },

  commitFloatingSelection: () => {
    const { pattern, selection, activeLayerId } = get();
    if (!pattern || !selection || !selection.floatingStitches) return;

    pushToHistory();

    // If marked for new layer, create a new layer with the floating stitches
    if (selection.commitToNewLayer) {
      const newLayerId = `layer-${Date.now()}`;
      const newLayer: Layer = {
        id: newLayerId,
        name: 'Selection',
        visible: true,
        locked: false,
        stitches: selection.floatingStitches.map(s => ({ ...s })),
      };

      set({
        pattern: {
          ...pattern,
          layers: [...pattern.layers, newLayer],
        },
        activeLayerId: newLayerId,
        selection: null,
        hasUnsavedChanges: true,
      });
      return;
    }

    const targetLayerId = activeLayerId || pattern.layers[0]?.id;
    if (!targetLayerId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === targetLayerId);
    if (layerIndex === -1) return;

    // Add floating stitches to the layer
    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...pattern.layers[layerIndex],
      stitches: [...pattern.layers[layerIndex].stitches, ...selection.floatingStitches],
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      selection: null,
      hasUnsavedChanges: true,
    });
  },

  cancelFloatingSelection: () => {
    const { selection } = get();
    if (!selection || !selection.floatingStitches) return;
    set({ selection: null });
  },

  // Area selection actions
  startAreaSelection: (point) => {
    const { pattern, activeLayerId } = get();
    if (!pattern) return;

    set({
      selection: {
        layerId: activeLayerId || pattern.layers[0]?.id || '',
        bounds: { x: point.x, y: point.y, width: 0, height: 0 },
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        dragStart: null,
        originalBounds: null,
        originalStitches: null,
        floatingStitches: null,
        selectionType: 'area',
        isSelectingArea: true,
        selectionStart: point,
      },
    });
  },

  updateAreaSelection: (point) => {
    const { selection } = get();
    if (!selection || !selection.isSelectingArea || !selection.selectionStart) return;

    const startX = selection.selectionStart.x;
    const startY = selection.selectionStart.y;

    // Calculate bounds from start to current point (handle negative directions)
    const minX = Math.min(startX, point.x);
    const minY = Math.min(startY, point.y);
    const maxX = Math.max(startX, point.x);
    const maxY = Math.max(startY, point.y);

    set({
      selection: {
        ...selection,
        bounds: {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
        },
      },
    });
  },

  endAreaSelection: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || !selection.isSelectingArea) return;

    // Extract stitches within bounds from all visible layers
    const { bounds } = selection;
    const stitchMap = new Map<string, Stitch>();

    // Process layers from bottom to top (higher index = on top, overwrites)
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;

      for (const stitch of layer.stitches) {
        if (
          stitch.x >= bounds.x &&
          stitch.x < bounds.x + bounds.width &&
          stitch.y >= bounds.y &&
          stitch.y < bounds.y + bounds.height
        ) {
          stitchMap.set(`${stitch.x},${stitch.y}`, { ...stitch });
        }
      }
    }

    const selectedStitches = Array.from(stitchMap.values());

    // If no stitches selected, clear selection
    if (selectedStitches.length === 0) {
      set({ selection: null });
      return;
    }

    set({
      selection: {
        ...selection,
        isSelectingArea: false,
        selectedStitches,
      },
    });
  },

  duplicateSelection: () => {
    const { selection } = get();
    if (selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToDuplicate = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToDuplicate?.length) return;

    // Create a copy of the stitches
    const duplicatedStitches = stitchesToDuplicate.map(s => ({ ...s }));

    // Recalculate bounds from the actual stitch positions
    const newBounds = calculateLayerBounds(duplicatedStitches);
    if (!newBounds) return;

    // Create floating selection with a copy of the stitches
    // User can then drag to reposition before committing
    set({
      selection: {
        ...selection,
        bounds: newBounds,
        floatingStitches: duplicatedStitches,
        selectedStitches: undefined,
        isSelectingArea: false,
      },
    });
  },

  moveSelection: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area' || !selection.selectedStitches?.length) return;

    pushToHistory();

    // Create set of positions to remove from layers
    const toRemove = new Set(
      selection.selectedStitches.map(s => `${s.x},${s.y}`)
    );

    // Remove from all layers
    const updatedLayers = pattern.layers.map(layer => ({
      ...layer,
      stitches: layer.stitches.filter(s => !toRemove.has(`${s.x},${s.y}`)),
    }));

    // Create floating selection with the stitches (user can reposition)
    set({
      pattern: { ...pattern, layers: updatedLayers },
      selection: {
        ...selection,
        floatingStitches: selection.selectedStitches.map(s => ({ ...s })),
        selectedStitches: undefined,
        isSelectingArea: false,
      },
      hasUnsavedChanges: true,
    });
  },

  deleteSelection: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // For floating selections, just clear the selection (stitches already removed from layers)
    if (selection.floatingStitches?.length) {
      set({ selection: null });
      return;
    }

    if (!selection.selectedStitches?.length) return;

    pushToHistory();

    // Create set of positions to delete
    const toDelete = new Set(
      selection.selectedStitches.map(s => `${s.x},${s.y}`)
    );

    // Remove from all layers
    const updatedLayers = pattern.layers.map(layer => ({
      ...layer,
      stitches: layer.stitches.filter(s => !toDelete.has(`${s.x},${s.y}`)),
    }));

    set({
      pattern: { ...pattern, layers: updatedLayers },
      selection: null,
      hasUnsavedChanges: true,
    });
  },

  selectionToNewLayer: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // For floating selections, just mark for new layer commit (stitches already removed from layers)
    if (selection.floatingStitches?.length) {
      // Recalculate bounds from the actual stitch positions
      const newBounds = calculateLayerBounds(selection.floatingStitches);
      if (!newBounds) return;

      set({
        selection: {
          ...selection,
          bounds: newBounds,
          commitToNewLayer: true,
        },
      });
      return;
    }

    if (!selection.selectedStitches?.length) return;

    pushToHistory();

    // Create set of positions to remove from layers
    const toRemove = new Set(
      selection.selectedStitches.map(s => `${s.x},${s.y}`)
    );

    // Remove from all layers
    const updatedLayers = pattern.layers.map(layer => ({
      ...layer,
      stitches: layer.stitches.filter(s => !toRemove.has(`${s.x},${s.y}`)),
    }));

    // Create floating selection with the stitches, marked for new layer commit
    set({
      pattern: { ...pattern, layers: updatedLayers },
      selection: {
        ...selection,
        floatingStitches: selection.selectedStitches.map(s => ({ ...s })),
        selectedStitches: undefined,
        isSelectingArea: false,
        commitToNewLayer: true,
      },
      hasUnsavedChanges: true,
    });
  },

  duplicateSelectionToNewLayer: () => {
    const { selection } = get();
    if (selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToDuplicate = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToDuplicate?.length) return;

    // Create a copy of the stitches
    const duplicatedStitches = stitchesToDuplicate.map(s => ({ ...s }));

    // Recalculate bounds from the actual stitch positions
    const newBounds = calculateLayerBounds(duplicatedStitches);
    if (!newBounds) return;

    // Create floating selection with a copy of the stitches, marked for new layer commit
    // Unlike selectionToNewLayer, this does NOT remove the original stitches
    set({
      selection: {
        ...selection,
        bounds: newBounds,
        floatingStitches: duplicatedStitches,
        selectedStitches: undefined,
        isSelectingArea: false,
        commitToNewLayer: true,
      },
    });
  },

  flipSelectionHorizontal: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToFlip = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToFlip?.length) return;

    const isFloating = !!selection.floatingStitches;

    pushToHistory();

    const { bounds } = selection;

    // Flip stitches horizontally within the selection bounds
    const flippedStitches = stitchesToFlip.map(s => ({
      ...s,
      x: bounds.x + bounds.width - 1 - (s.x - bounds.x),
    }));

    if (isFloating) {
      // Just update the floating stitches, no layer changes needed
      set({
        selection: {
          ...selection,
          floatingStitches: flippedStitches,
        },
      });
    } else {
      // Update layers for non-floating selection
      const toUpdate = new Set(stitchesToFlip.map(s => `${s.x},${s.y}`));

      const updatedLayers = pattern.layers.map(layer => {
        const layerStitchMap = new Map<string, Stitch>();

        for (const stitch of layer.stitches) {
          if (!toUpdate.has(`${stitch.x},${stitch.y}`)) {
            layerStitchMap.set(`${stitch.x},${stitch.y}`, stitch);
          }
        }

        for (let i = 0; i < stitchesToFlip.length; i++) {
          const original = stitchesToFlip[i];
          const flipped = flippedStitches[i];
          if (layer.stitches.some(s => s.x === original.x && s.y === original.y && s.colorId === original.colorId)) {
            layerStitchMap.set(`${flipped.x},${flipped.y}`, flipped);
          }
        }

        return {
          ...layer,
          stitches: Array.from(layerStitchMap.values()),
        };
      });

      set({
        pattern: { ...pattern, layers: updatedLayers },
        selection: {
          ...selection,
          selectedStitches: flippedStitches,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  flipSelectionVertical: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToFlip = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToFlip?.length) return;

    const isFloating = !!selection.floatingStitches;

    pushToHistory();

    const { bounds } = selection;

    // Flip stitches vertically within the selection bounds
    const flippedStitches = stitchesToFlip.map(s => ({
      ...s,
      y: bounds.y + bounds.height - 1 - (s.y - bounds.y),
    }));

    if (isFloating) {
      // Just update the floating stitches, no layer changes needed
      set({
        selection: {
          ...selection,
          floatingStitches: flippedStitches,
        },
      });
    } else {
      // Update layers for non-floating selection
      const toUpdate = new Set(stitchesToFlip.map(s => `${s.x},${s.y}`));

      const updatedLayers = pattern.layers.map(layer => {
        const layerStitchMap = new Map<string, Stitch>();

        for (const stitch of layer.stitches) {
          if (!toUpdate.has(`${stitch.x},${stitch.y}`)) {
            layerStitchMap.set(`${stitch.x},${stitch.y}`, stitch);
          }
        }

        for (let i = 0; i < stitchesToFlip.length; i++) {
          const original = stitchesToFlip[i];
          const flipped = flippedStitches[i];
          if (layer.stitches.some(s => s.x === original.x && s.y === original.y && s.colorId === original.colorId)) {
            layerStitchMap.set(`${flipped.x},${flipped.y}`, flipped);
          }
        }

        return {
          ...layer,
          stitches: Array.from(layerStitchMap.values()),
        };
      });

      set({
        pattern: { ...pattern, layers: updatedLayers },
        selection: {
          ...selection,
          selectedStitches: flippedStitches,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  rotateSelectionLeft: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToRotate = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToRotate?.length) return;

    const isFloating = !!selection.floatingStitches;

    pushToHistory();

    const { bounds } = selection;

    // Rotate 90° counter-clockwise: (x, y) -> (y, width - 1 - x)
    // New bounds will have swapped width/height
    const newWidth = bounds.height;
    const newHeight = bounds.width;

    const rotatedStitches = stitchesToRotate.map(s => {
      const relX = s.x - bounds.x;
      const relY = s.y - bounds.y;
      // Rotate CCW: new position is (relY, width - 1 - relX)
      return {
        ...s,
        x: bounds.x + relY,
        y: bounds.y + (bounds.width - 1 - relX),
      };
    });

    if (isFloating) {
      // Just update the floating stitches and bounds, no layer changes needed
      set({
        selection: {
          ...selection,
          bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
          floatingStitches: rotatedStitches,
        },
      });
    } else {
      // Update layers for non-floating selection
      const toUpdate = new Set(stitchesToRotate.map(s => `${s.x},${s.y}`));

      const updatedLayers = pattern.layers.map(layer => {
        const layerStitchMap = new Map<string, Stitch>();

        for (const stitch of layer.stitches) {
          if (!toUpdate.has(`${stitch.x},${stitch.y}`)) {
            layerStitchMap.set(`${stitch.x},${stitch.y}`, stitch);
          }
        }

        for (let i = 0; i < stitchesToRotate.length; i++) {
          const original = stitchesToRotate[i];
          const rotated = rotatedStitches[i];
          if (layer.stitches.some(s => s.x === original.x && s.y === original.y && s.colorId === original.colorId)) {
            layerStitchMap.set(`${rotated.x},${rotated.y}`, rotated);
          }
        }

        return {
          ...layer,
          stitches: Array.from(layerStitchMap.values()),
        };
      });

      set({
        pattern: { ...pattern, layers: updatedLayers },
        selection: {
          ...selection,
          bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
          selectedStitches: rotatedStitches,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  rotateSelectionRight: () => {
    const { pattern, selection } = get();
    if (!pattern || selection?.selectionType !== 'area') return;

    // Work with either selectedStitches or floatingStitches
    const stitchesToRotate = selection.selectedStitches || selection.floatingStitches;
    if (!stitchesToRotate?.length) return;

    const isFloating = !!selection.floatingStitches;

    pushToHistory();

    const { bounds } = selection;

    // Rotate 90° clockwise: (x, y) -> (height - 1 - y, x)
    // New bounds will have swapped width/height
    const newWidth = bounds.height;
    const newHeight = bounds.width;

    const rotatedStitches = stitchesToRotate.map(s => {
      const relX = s.x - bounds.x;
      const relY = s.y - bounds.y;
      // Rotate CW: new position is (height - 1 - relY, relX)
      return {
        ...s,
        x: bounds.x + (bounds.height - 1 - relY),
        y: bounds.y + relX,
      };
    });

    if (isFloating) {
      // Just update the floating stitches and bounds, no layer changes needed
      set({
        selection: {
          ...selection,
          bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
          floatingStitches: rotatedStitches,
        },
      });
    } else {
      // Update layers for non-floating selection
      const toUpdate = new Set(stitchesToRotate.map(s => `${s.x},${s.y}`));

      const updatedLayers = pattern.layers.map(layer => {
        const layerStitchMap = new Map<string, Stitch>();

        for (const stitch of layer.stitches) {
          if (!toUpdate.has(`${stitch.x},${stitch.y}`)) {
            layerStitchMap.set(`${stitch.x},${stitch.y}`, stitch);
          }
        }

        for (let i = 0; i < stitchesToRotate.length; i++) {
          const original = stitchesToRotate[i];
          const rotated = rotatedStitches[i];
          if (layer.stitches.some(s => s.x === original.x && s.y === original.y && s.colorId === original.colorId)) {
            layerStitchMap.set(`${rotated.x},${rotated.y}`, rotated);
          }
        }

        return {
          ...layer,
          stitches: Array.from(layerStitchMap.values()),
        };
      });

      set({
        pattern: { ...pattern, layers: updatedLayers },
        selection: {
          ...selection,
          bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
          selectedStitches: rotatedStitches,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  // Layer transform actions (for whole layer when select tool is active)
  duplicateLayerToNewLayer: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || selection.selectionType !== 'layer') return;

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer || layer.stitches.length === 0) return;

    pushToHistory();

    // Create a new layer with a copy of all stitches from the selected layer
    const newLayerId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newLayerId,
      name: `${layer.name} Copy`,
      visible: true,
      locked: false,
      stitches: layer.stitches.map(s => ({ ...s })),
    };

    set({
      pattern: {
        ...pattern,
        layers: [...pattern.layers, newLayer],
      },
      activeLayerId: newLayerId,
      selection: null,
      hasUnsavedChanges: true,
    });
  },

  flipLayerHorizontal: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || selection.selectionType !== 'layer') return;

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer || layer.stitches.length === 0) return;

    pushToHistory();

    const { bounds } = selection;

    // Flip all stitches in the layer horizontally within bounds
    const flippedStitches = layer.stitches.map(s => ({
      ...s,
      x: bounds.x + bounds.width - 1 - (s.x - bounds.x),
    }));

    const updatedLayers = pattern.layers.map(l =>
      l.id === layer.id ? { ...l, stitches: flippedStitches } : l
    );

    set({
      pattern: { ...pattern, layers: updatedLayers },
      hasUnsavedChanges: true,
    });
  },

  flipLayerVertical: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || selection.selectionType !== 'layer') return;

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer || layer.stitches.length === 0) return;

    pushToHistory();

    const { bounds } = selection;

    // Flip all stitches in the layer vertically within bounds
    const flippedStitches = layer.stitches.map(s => ({
      ...s,
      y: bounds.y + bounds.height - 1 - (s.y - bounds.y),
    }));

    const updatedLayers = pattern.layers.map(l =>
      l.id === layer.id ? { ...l, stitches: flippedStitches } : l
    );

    set({
      pattern: { ...pattern, layers: updatedLayers },
      hasUnsavedChanges: true,
    });
  },

  rotateLayerLeft: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || selection.selectionType !== 'layer') return;

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer || layer.stitches.length === 0) return;

    pushToHistory();

    const { bounds } = selection;

    // Rotate 90° counter-clockwise: (x, y) -> (y, width - 1 - x)
    const newWidth = bounds.height;
    const newHeight = bounds.width;

    const rotatedStitches = layer.stitches.map(s => {
      const relX = s.x - bounds.x;
      const relY = s.y - bounds.y;
      return {
        ...s,
        x: bounds.x + relY,
        y: bounds.y + (bounds.width - 1 - relX),
      };
    });

    const updatedLayers = pattern.layers.map(l =>
      l.id === layer.id ? { ...l, stitches: rotatedStitches } : l
    );

    set({
      pattern: { ...pattern, layers: updatedLayers },
      selection: {
        ...selection,
        bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
      },
      hasUnsavedChanges: true,
    });
  },

  rotateLayerRight: () => {
    const { pattern, selection } = get();
    if (!pattern || !selection || selection.selectionType !== 'layer') return;

    const layer = pattern.layers.find(l => l.id === selection.layerId);
    if (!layer || layer.stitches.length === 0) return;

    pushToHistory();

    const { bounds } = selection;

    // Rotate 90° clockwise: (x, y) -> (height - 1 - y, x)
    const newWidth = bounds.height;
    const newHeight = bounds.width;

    const rotatedStitches = layer.stitches.map(s => {
      const relX = s.x - bounds.x;
      const relY = s.y - bounds.y;
      return {
        ...s,
        x: bounds.x + (bounds.height - 1 - relY),
        y: bounds.y + relX,
      };
    });

    const updatedLayers = pattern.layers.map(l =>
      l.id === layer.id ? { ...l, stitches: rotatedStitches } : l
    );

    set({
      pattern: { ...pattern, layers: updatedLayers },
      selection: {
        ...selection,
        bounds: { x: bounds.x, y: bounds.y, width: newWidth, height: newHeight },
      },
      hasUnsavedChanges: true,
    });
  },

  // Multi-layer selection actions
  toggleLayerInSelection: (layerId) => {
    const { selectedLayerIds, pattern } = get();
    if (!pattern) return;

    const layer = pattern.layers.find(l => l.id === layerId);
    if (!layer) return;

    if (selectedLayerIds.includes(layerId)) {
      // Remove from selection
      set({ selectedLayerIds: selectedLayerIds.filter(id => id !== layerId) });
    } else {
      // Add to selection
      set({ selectedLayerIds: [...selectedLayerIds, layerId] });
    }
  },

  addLayersToSelection: (layerIds) => {
    const { selectedLayerIds, pattern } = get();
    if (!pattern) return;

    // Filter to only valid layer IDs and avoid duplicates
    const validIds = layerIds.filter(id =>
      pattern.layers.some(l => l.id === id) && !selectedLayerIds.includes(id)
    );

    set({ selectedLayerIds: [...selectedLayerIds, ...validIds] });
  },

  clearLayerSelection: () => {
    set({ selectedLayerIds: [], multiLayerDragState: null });
  },

  selectAllLayers: () => {
    const { pattern } = get();
    if (!pattern) return;

    set({ selectedLayerIds: pattern.layers.map(l => l.id) });
  },

  moveSelectedLayers: (deltaX, deltaY) => {
    const { pattern, selectedLayerIds } = get();
    if (!pattern || selectedLayerIds.length === 0) return;
    if (deltaX === 0 && deltaY === 0) return;

    pushToHistory();

    const updatedLayers = pattern.layers.map(layer => {
      if (!selectedLayerIds.includes(layer.id)) return layer;
      if (layer.locked) return layer; // Don't move locked layers

      return {
        ...layer,
        stitches: layer.stitches.map(s => ({
          ...s,
          x: s.x + deltaX,
          y: s.y + deltaY,
        })),
      };
    });

    set({
      pattern: { ...pattern, layers: updatedLayers },
      hasUnsavedChanges: true,
    });
  },

  startMultiLayerDrag: (point) => {
    const { pattern, selectedLayerIds } = get();
    if (!pattern || selectedLayerIds.length === 0) return;

    // Push to history before starting drag
    pushToHistory();

    // Store original stitch positions for all selected layers
    const originalPositions = new Map<string, { x: number; y: number }[]>();
    for (const layerId of selectedLayerIds) {
      const layer = pattern.layers.find(l => l.id === layerId);
      if (layer && !layer.locked) {
        originalPositions.set(layerId, layer.stitches.map(s => ({ x: s.x, y: s.y })));
      }
    }

    set({
      multiLayerDragState: {
        isDragging: true,
        dragStart: point,
        originalPositions,
      },
    });
  },

  updateMultiLayerDrag: (point) => {
    const { pattern, multiLayerDragState, selectedLayerIds } = get();
    if (!pattern || !multiLayerDragState?.isDragging || !multiLayerDragState.dragStart || !multiLayerDragState.originalPositions) return;

    const deltaX = Math.round(point.x - multiLayerDragState.dragStart.x);
    const deltaY = Math.round(point.y - multiLayerDragState.dragStart.y);

    const updatedLayers = pattern.layers.map(layer => {
      if (!selectedLayerIds.includes(layer.id)) return layer;

      const originalPos = multiLayerDragState.originalPositions?.get(layer.id);
      if (!originalPos || layer.locked) return layer;

      return {
        ...layer,
        stitches: layer.stitches.map((s, i) => ({
          ...s,
          x: originalPos[i].x + deltaX,
          y: originalPos[i].y + deltaY,
        })),
      };
    });

    set({
      pattern: { ...pattern, layers: updatedLayers },
    });
  },

  endMultiLayerDrag: () => {
    const { multiLayerDragState } = get();
    if (!multiLayerDragState?.isDragging) return;

    set({
      multiLayerDragState: null,
      hasUnsavedChanges: true,
    });
  },

  getMultiLayerBounds: () => {
    const { pattern, selectedLayerIds } = get();
    if (!pattern || selectedLayerIds.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasStitches = false;

    for (const layerId of selectedLayerIds) {
      const layer = pattern.layers.find(l => l.id === layerId);
      if (!layer || layer.stitches.length === 0) continue;

      for (const stitch of layer.stitches) {
        hasStitches = true;
        minX = Math.min(minX, stitch.x);
        minY = Math.min(minY, stitch.y);
        maxX = Math.max(maxX, stitch.x);
        maxY = Math.max(maxY, stitch.y);
      }
    }

    if (!hasStitches) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  },

  // Overlay image actions
  addOverlayImage: (dataUrl, naturalWidth, naturalHeight, name) => {
    const { pattern, overlayImages } = get();
    if (!pattern) return;

    // Calculate initial size to fit canvas while maintaining aspect ratio
    const canvasWidth = pattern.canvas.width;
    const canvasHeight = pattern.canvas.height;
    const imgAspect = naturalWidth / naturalHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let width, height;
    if (imgAspect > canvasAspect) {
      // Image is wider - fit to width
      width = canvasWidth;
      height = Math.round(canvasWidth / imgAspect);
    } else {
      // Image is taller - fit to height
      height = canvasHeight;
      width = Math.round(canvasHeight * imgAspect);
    }

    // Center the image
    const x = Math.round((canvasWidth - width) / 2);
    const y = Math.round((canvasHeight - height) / 2);

    const newId = `overlay-${Date.now()}`;
    const overlayNumber = overlayImages.length + 1;

    set({
      overlayImages: [
        ...overlayImages,
        {
          id: newId,
          name: name || `Overlay ${overlayNumber}`,
          dataUrl,
          opacity: 50,
          visible: true,
          locked: false,
          x,
          y,
          width,
          height,
          naturalWidth,
          naturalHeight,
        },
      ],
      selectedOverlayId: newId,
      selection: null, // Clear layer selection
    });
  },

  setOverlayImages: (overlays) => {
    set({
      overlayImages: overlays,
      selectedOverlayId: null,
    });
  },

  updateOverlayOpacity: (id, opacity) => {
    const { overlayImages } = get();
    set({
      overlayImages: overlayImages.map(o =>
        o.id === id ? { ...o, opacity: Math.max(0, Math.min(100, opacity)) } : o
      ),
    });
  },

  toggleOverlayVisibility: (id) => {
    const { overlayImages } = get();
    set({
      overlayImages: overlayImages.map(o =>
        o.id === id ? { ...o, visible: !o.visible } : o
      ),
    });
  },

  toggleOverlayLock: (id) => {
    const { overlayImages } = get();
    set({
      overlayImages: overlayImages.map(o =>
        o.id === id ? { ...o, locked: !o.locked } : o
      ),
    });
  },

  removeOverlayImage: (id) => {
    const { overlayImages, selectedOverlayId } = get();
    set({
      overlayImages: overlayImages.filter(o => o.id !== id),
      selectedOverlayId: selectedOverlayId === id ? null : selectedOverlayId,
    });
  },

  selectOverlay: (id) => {
    set({
      selectedOverlayId: id,
      selection: null, // Clear layer selection when selecting overlay
    });
  },

  deselectOverlay: () => {
    set({ selectedOverlayId: null });
  },

  updateOverlayPosition: (id, x, y) => {
    const { overlayImages } = get();
    set({
      overlayImages: overlayImages.map(o =>
        o.id === id ? { ...o, x, y } : o
      ),
    });
  },

  updateOverlaySize: (id, width, height) => {
    const { overlayImages } = get();
    set({
      overlayImages: overlayImages.map(o =>
        o.id === id ? { ...o, width: Math.max(1, width), height: Math.max(1, height) } : o
      ),
    });
  },

  reorderOverlay: (id, direction) => {
    const { overlayImages } = get();
    const index = overlayImages.findIndex(o => o.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= overlayImages.length) return;

    const newOverlays = [...overlayImages];
    [newOverlays[index], newOverlays[newIndex]] = [newOverlays[newIndex], newOverlays[index]];

    set({ overlayImages: newOverlays });
  },

  // Progress tracking actions
  toggleProgressMode: () => {
    const { isProgressMode } = get();
    const enteringProgressMode = !isProgressMode;
    set({
      isProgressMode: enteringProgressMode,
      selection: null, // Clear selection when toggling mode
      selectedOverlayId: null, // Deselect overlay
      // Set pencil tool when entering progress mode so clicks mark stitches
      ...(enteringProgressMode ? { activeTool: 'pencil' as Tool } : {}),
    });
  },

  setProgressMode: (enabled) => {
    set({
      isProgressMode: enabled,
      selection: null,
      selectedOverlayId: null,
      // Set pencil tool when entering progress mode so clicks mark stitches
      ...(enabled ? { activeTool: 'pencil' as Tool } : {}),
    });
  },

  toggleStitchCompleted: (x, y) => {
    const { pattern } = get();
    if (!pattern) return;

    // Find the stitch at this position across all layers (top to bottom)
    for (let i = pattern.layers.length - 1; i >= 0; i--) {
      const layer = pattern.layers[i];
      if (!layer.visible) continue;

      const stitchIndex = layer.stitches.findIndex(s => s.x === x && s.y === y);
      if (stitchIndex !== -1) {
        pushToHistory();

        const updatedStitches = [...layer.stitches];
        updatedStitches[stitchIndex] = {
          ...updatedStitches[stitchIndex],
          completed: !updatedStitches[stitchIndex].completed,
        };

        const updatedLayers = [...pattern.layers];
        updatedLayers[i] = {
          ...layer,
          stitches: updatedStitches,
        };

        set({
          pattern: {
            ...pattern,
            layers: updatedLayers,
          },
          hasUnsavedChanges: true,
        });
        return;
      }
    }
  },

  setStitchCompleted: (x, y, completed) => {
    const { pattern } = get();
    if (!pattern) return;

    // Find the stitch at this position across all layers (top to bottom)
    for (let i = pattern.layers.length - 1; i >= 0; i--) {
      const layer = pattern.layers[i];
      if (!layer.visible) continue;

      const stitchIndex = layer.stitches.findIndex(s => s.x === x && s.y === y);
      if (stitchIndex !== -1) {
        // Only update if the state is different
        if (layer.stitches[stitchIndex].completed === completed) return;

        const updatedStitches = [...layer.stitches];
        updatedStitches[stitchIndex] = {
          ...updatedStitches[stitchIndex],
          completed,
        };

        const updatedLayers = [...pattern.layers];
        updatedLayers[i] = {
          ...layer,
          stitches: updatedStitches,
        };

        set({
          pattern: {
            ...pattern,
            layers: updatedLayers,
          },
          hasUnsavedChanges: true,
        });
        return;
      }
    }
  },

  setAreaCompleted: (x, y, width, height, completed) => {
    const { pattern } = get();
    if (!pattern) return;

    // Update all stitches within the area bounds across all visible layers
    let hasChanges = false;
    const updatedLayers = pattern.layers.map(layer => {
      if (!layer.visible) return layer;

      const updatedStitches = layer.stitches.map(stitch => {
        if (
          stitch.x >= x &&
          stitch.x < x + width &&
          stitch.y >= y &&
          stitch.y < y + height &&
          stitch.completed !== completed
        ) {
          hasChanges = true;
          return { ...stitch, completed };
        }
        return stitch;
      });

      if (updatedStitches !== layer.stitches) {
        return { ...layer, stitches: updatedStitches };
      }
      return layer;
    });

    if (hasChanges) {
      set({
        pattern: {
          ...pattern,
          layers: updatedLayers,
        },
        hasUnsavedChanges: true,
      });
    }
  },

  fillContiguousCompleted: (startX, startY, completed) => {
    const { pattern } = get();
    if (!pattern) return;

    // Build a map of all stitches across visible layers (topmost wins)
    const stitchMap = new Map<string, { stitch: Stitch; layerIndex: number }>();
    for (let i = 0; i < pattern.layers.length; i++) {
      const layer = pattern.layers[i];
      if (!layer.visible) continue;
      for (const stitch of layer.stitches) {
        const key = `${stitch.x},${stitch.y}`;
        stitchMap.set(key, { stitch, layerIndex: i });
      }
    }

    // Find the starting stitch
    const startKey = `${startX},${startY}`;
    const startEntry = stitchMap.get(startKey);
    if (!startEntry) return;

    const targetColorId = startEntry.stitch.colorId;

    // Flood fill using BFS to find all contiguous stitches of the same color
    const visited = new Set<string>();
    const toUpdate: Array<{ x: number; y: number; layerIndex: number }> = [];
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const entry = stitchMap.get(key);
      if (!entry || entry.stitch.colorId !== targetColorId) continue;

      // Only update if the completion state differs
      if (entry.stitch.completed !== completed) {
        toUpdate.push({ x, y, layerIndex: entry.layerIndex });
      }

      // Add 4-connected neighbors
      queue.push({ x: x + 1, y });
      queue.push({ x: x - 1, y });
      queue.push({ x, y: y + 1 });
      queue.push({ x, y: y - 1 });
    }

    if (toUpdate.length === 0) return;

    // Group updates by layer for efficient batch update
    const updatesByLayer = new Map<number, Array<{ x: number; y: number }>>();
    for (const { x, y, layerIndex } of toUpdate) {
      if (!updatesByLayer.has(layerIndex)) {
        updatesByLayer.set(layerIndex, []);
      }
      updatesByLayer.get(layerIndex)!.push({ x, y });
    }

    // Apply updates to layers
    const updatedLayers = pattern.layers.map((layer, layerIndex) => {
      const updates = updatesByLayer.get(layerIndex);
      if (!updates) return layer;

      const updateSet = new Set(updates.map(u => `${u.x},${u.y}`));
      const updatedStitches = layer.stitches.map(stitch => {
        if (updateSet.has(`${stitch.x},${stitch.y}`)) {
          return { ...stitch, completed };
        }
        return stitch;
      });

      return { ...layer, stitches: updatedStitches };
    });

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  getStitchCompleted: (x, y) => {
    const { pattern } = get();
    if (!pattern) return false;

    // Find the stitch at this position across all layers (top to bottom)
    for (let i = pattern.layers.length - 1; i >= 0; i--) {
      const layer = pattern.layers[i];
      if (!layer.visible) continue;

      const stitch = layer.stitches.find(s => s.x === x && s.y === y);
      if (stitch) {
        return stitch.completed || false;
      }
    }
    return false;
  },

  setProgressShadingColor: (color) => {
    set({ progressShadingColor: color });
  },

  setProgressShadingOpacity: (opacity) => {
    set({ progressShadingOpacity: Math.max(0, Math.min(100, opacity)) });
  },

  swapColorOnLayer: (fromColorId, toColorId) => {
    const { pattern, activeLayerId } = get();
    if (!pattern || !activeLayerId) return;
    if (fromColorId === toColorId) return;

    const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
    if (layerIndex === -1) return;

    const activeLayer = pattern.layers[layerIndex];
    if (activeLayer.locked) return;

    // Check if any stitches have the fromColorId
    const hasMatchingStitches = activeLayer.stitches.some(s => s.colorId === fromColorId);
    if (!hasMatchingStitches) return;

    pushToHistory();

    // Update all stitches with the fromColorId to toColorId
    const updatedStitches = activeLayer.stitches.map(s =>
      s.colorId === fromColorId
        ? { ...s, colorId: toColorId }
        : s
    );

    const updatedLayers = [...pattern.layers];
    updatedLayers[layerIndex] = {
      ...activeLayer,
      stitches: updatedStitches,
    };

    set({
      pattern: {
        ...pattern,
        layers: updatedLayers,
      },
      hasUnsavedChanges: true,
    });
  },

  resizeCanvas: (newWidth, newHeight, newMeshCount, anchor) => {
    const { pattern } = get();
    if (!pattern) return;

    pushToHistory();

    const oldWidth = pattern.canvas.width;
    const oldHeight = pattern.canvas.height;

    // Transform all layers
    const transformedLayers = pattern.layers.map(layer => ({
      ...layer,
      stitches: transformStitchesForCanvasResize(
        layer.stitches,
        oldWidth,
        oldHeight,
        newWidth,
        newHeight,
        anchor
      ),
    }));

    set({
      pattern: {
        ...pattern,
        canvas: {
          width: newWidth,
          height: newHeight,
          meshCount: newMeshCount,
        },
        layers: transformedLayers,
      },
      hasUnsavedChanges: true,
      selection: null, // Clear any active selection
    });
  },
};
});
