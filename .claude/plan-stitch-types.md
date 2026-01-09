# Plan: Multiple Stitch Types Feature

## Overview

Add support for multiple stitch types beyond the current square grid stitches. The first new type will be **circle stitches** that can be placed at grid intersections (corners of squares).

Reference: The feature is inspired by apps like Stitchly (see screenshot) which shows a "Stitch Type" popup with various options.

## Current State

- Only square stitches exist (fill entire grid cell)
- Stitch interface: `{ x, y, colorId, completed }`
- All stitches stored in layers as simple arrays
- Rendering: `ctx.fillRect()` for each stitch

## Proposed Stitch Types

### Phase 1: Core Types
1. **Square (full)** - Current default, fills entire cell
2. **Circle** - Centered on grid cell, larger than the cell (overlaps adjacent cells)

The circle stitch:
- Is centered on a cell coordinate (same as square)
- Has a diameter larger than one cell (approximately 2x cell size)
- Overlaps into adjacent cells visually
- Has a black outline
- Shows color fill with symbol inside

### Future Phases (not in scope)
- Small dot
- Empty circle (outline only)
- Half squares (triangles)
- Quarter squares
- Diagonal stitches

## Technical Design

### 1. Data Model Changes

**TypeScript - `src/stores/patternStore.ts`:**
```typescript
// New stitch type enum
export type StitchType = 'square' | 'circle';

// Circle position - 9 positions on a 3x3 grid within each cell
export type CirclePosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// Updated Stitch interface
export interface Stitch {
  x: number;
  y: number;
  colorId: string;
  completed: boolean;
  type?: StitchType;  // Optional for backward compatibility, defaults to 'square'
  position?: CirclePosition;  // For circles only - where to place it (defaults to 'center')
}

// New state for active stitch type and position
interface PatternState {
  // ... existing state
  activeStitchType: StitchType;
  activeCirclePosition: CirclePosition;
  setActiveStitchType: (type: StitchType) => void;
  setActiveCirclePosition: (position: CirclePosition) => void;
}
```

**Rust - `src-tauri/src/lib.rs`:**
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Stitch {
    pub x: u32,
    pub y: u32,
    pub color_id: String,
    pub completed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stitch_type: Option<String>,  // "square" | "circle"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position: Option<String>,  // 9 positions: "top-left" | "top-center" | "top-right" |
                                   // "middle-left" | "center" | "middle-right" |
                                   // "bottom-left" | "bottom-center" | "bottom-right"
}
```

### 2. Coordinate System

**Square Stitches (current):**
- Position (x, y) represents the grid cell
- Rendered at `(x * cellSize, y * cellSize)` with size `cellSize x cellSize`

**Circle Stitches (new):**
- Position (x, y) represents the grid cell
- Additional `position` field specifies WHERE on the cell (9 positions in a 3x3 grid):
  - `'top-left'` - Top-left corner
  - `'top-center'` - Top edge midpoint
  - `'top-right'` - Top-right corner
  - `'middle-left'` - Left edge midpoint
  - `'center'` - Center of the cell
  - `'middle-right'` - Right edge midpoint
  - `'bottom-left'` - Bottom-left corner
  - `'bottom-center'` - Bottom edge midpoint
  - `'bottom-right'` - Bottom-right corner

**Circle Position Rendering (3x3 grid):**
```
For a cell at grid position (x, y):

  TL----TC----TR     TL = (x * cellSize, y * cellSize)
   |          |      TC = (x * cellSize + cellSize/2, y * cellSize)
  ML----C----MR      TR = (x * cellSize + cellSize, y * cellSize)
   |          |      ML = (x * cellSize, y * cellSize + cellSize/2)
  BL----BC----BR     C  = (x * cellSize + cellSize/2, y * cellSize + cellSize/2)
                     MR = (x * cellSize + cellSize, y * cellSize + cellSize/2)
                     BL = (x * cellSize, y * cellSize + cellSize)
                     BC = (x * cellSize + cellSize/2, y * cellSize + cellSize)
                     BR = (x * cellSize + cellSize, y * cellSize + cellSize)
```

**Example - All 9 circle positions on a cell:**
```
  +-------+-------+
  | o   o   o     |    o = circle positions
  |               |
  | o   o   o     |    9 positions total:
  |               |    corners (4) + edge midpoints (4) + center (1)
  | o   o   o     |
  +-------+-------+
```

### 3. UI Components

**Option A: Toolbar Stitch Type Selector (Recommended)**
- Add a new dropdown/popup in the toolbar next to the color palette
- Shows available stitch types with visual icons
- Active stitch type highlighted
- Clicking a type sets it as active for the pencil tool

**Option B: Separate Tools**
- Add `squarePencil` and `circlePencil` as separate tools
- Requires more toolbar space

**Recommended: Option A** - A stitch type selector that affects how the pencil tool works

### 4. Rendering Changes (`PatternCanvas.tsx`)

```typescript
// Helper function to calculate circle center based on position (9 positions)
function getCircleCenter(
  x: number,
  y: number,
  cellSize: number,
  position: CirclePosition
): { centerX: number; centerY: number } {
  const baseX = x * cellSize;
  const baseY = y * cellSize;
  const half = cellSize / 2;

  switch (position) {
    // Top row
    case 'top-left':
      return { centerX: baseX, centerY: baseY };
    case 'top-center':
      return { centerX: baseX + half, centerY: baseY };
    case 'top-right':
      return { centerX: baseX + cellSize, centerY: baseY };
    // Middle row
    case 'middle-left':
      return { centerX: baseX, centerY: baseY + half };
    case 'center':
      return { centerX: baseX + half, centerY: baseY + half };
    case 'middle-right':
      return { centerX: baseX + cellSize, centerY: baseY + half };
    // Bottom row
    case 'bottom-left':
      return { centerX: baseX, centerY: baseY + cellSize };
    case 'bottom-center':
      return { centerX: baseX + half, centerY: baseY + cellSize };
    case 'bottom-right':
      return { centerX: baseX + cellSize, centerY: baseY + cellSize };
    default:
      return { centerX: baseX + half, centerY: baseY + half };
  }
}

// In the draw() function, update stitch rendering:

for (const stitch of layer.stitches) {
  const stitchType = stitch.type || 'square';

  if (stitchType === 'square') {
    // Existing square rendering
    ctx.fillRect(
      stitch.x * cellSize,
      stitch.y * cellSize,
      cellSize,
      cellSize
    );
  } else if (stitchType === 'circle') {
    // Circle at specified position, larger than cell
    const pos = stitch.position || 'center';
    const { centerX, centerY } = getCircleCenter(stitch.x, stitch.y, cellSize, pos);
    const radius = cellSize * 0.9; // Diameter ~1.8 cells

    // Fill circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
    ctx.fill();

    // Black outline (always)
    ctx.strokeStyle = 'black';
    ctx.lineWidth = Math.max(2, cellSize * 0.08);
    ctx.stroke();
  }
}
```

**Rendering order consideration:**
- Circles overlap adjacent cells, so they should be rendered AFTER squares
- May need two passes: first all squares, then all circles
- Or render by layer with circles on top

### 5. Input Handling Changes

**Click Detection for Circles:**

When placing a circle, we need to determine which position (center or corner) based on where the user clicked within the cell:

```typescript
// Determine circle position based on click location within cell (9 positions)
function getCirclePositionFromClick(
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

// Modify handleCanvasClick or mouse event handlers:
const cell = getCellFromClick(adjustedX, adjustedY);

if (activeStitchType === 'circle') {
  const position = getCirclePositionFromClick(adjustedX, adjustedY, cell.x, cell.y, cellSize);
  setStitch(cell.x, cell.y, selectedColorId, 'circle', position);
} else {
  setStitch(cell.x, cell.y, selectedColorId, 'square');
}
```

**Alternative approach - Use active circle position from toolbar:**
Instead of auto-detecting position from click location, the user could select the position from the toolbar. This gives more precise control.

```typescript
// Simpler approach - use toolbar-selected position
const cell = getCellFromClick(adjustedX, adjustedY);
setStitch(cell.x, cell.y, selectedColorId, activeStitchType, activeCirclePosition);
```

**Recommended:** Use the toolbar selection approach for consistency and predictability.

**Eraser Hit Detection:**
```typescript
// Check if a point hits a stitch (for eraser)
function isPointOverStitch(
  pointX: number,
  pointY: number,
  stitch: Stitch,
  cellSize: number
): boolean {
  const stitchType = stitch.type || 'square';

  if (stitchType === 'square') {
    // Square: check if point is within cell bounds
    const cellLeft = stitch.x * cellSize;
    const cellTop = stitch.y * cellSize;
    return (
      pointX >= cellLeft &&
      pointX < cellLeft + cellSize &&
      pointY >= cellTop &&
      pointY < cellTop + cellSize
    );
  } else if (stitchType === 'circle') {
    // Circle: check if point is within circle radius
    const pos = stitch.position || 'center';
    const { centerX, centerY } = getCircleCenter(stitch.x, stitch.y, cellSize, pos);
    const radius = cellSize * 0.9;
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    return (dx * dx + dy * dy) <= (radius * radius);
  }

  return false;
}

// Eraser: find all stitches at the eraser position
function getStitchesAtPoint(
  pointX: number,
  pointY: number,
  stitches: Stitch[],
  cellSize: number
): Stitch[] {
  return stitches.filter(stitch => isPointOverStitch(pointX, pointY, stitch, cellSize));
}
```

### 6. Store Changes

**Update `setStitch` function:**
```typescript
setStitch: (x: number, y: number, colorId: string, type?: StitchType, position?: CirclePosition) => {
  const { pattern, activeLayerId, activeStitchType, activeCirclePosition } = get();
  // ... existing validation

  const effectiveType = type ?? activeStitchType;
  const effectivePosition = position ?? (effectiveType === 'circle' ? activeCirclePosition : undefined);

  // Same bounds for both types (cell-based)
  if (x < 0 || x >= pattern.canvas.width || y < 0 || y >= pattern.canvas.height) {
    return; // Out of bounds
  }

  const newStitch: Stitch = {
    x,
    y,
    colorId,
    completed: false,
    type: effectiveType,
    position: effectivePosition,
  };

  // ... rest of existing logic
}
```

**Stitch uniqueness:** A stitch is now unique by `(x, y, type, position)`:
- Square at (1,1) and circle-center at (1,1) are different stitches
- Circle-center at (1,1) and circle-top-left at (1,1) are different stitches
- This allows rich layering of different stitch types

### 7. Toolbar UI Design

**Single Icon Button with Popup** (like Stitchly):
- One toolbar button that shows the current stitch type icon (square or circle)
- Clicking opens a popup with all stitch type options
- When circle is selected, shows 3x3 position grid in the popup
- Selected stitch type affects ALL drawing tools (pencil, fill, line, etc.)

```tsx
// State for popup visibility
const [showStitchTypePopup, setShowStitchTypePopup] = useState(false);

{/* Stitch Type Button - shows current selection */}
<div className="relative">
  <button
    onClick={() => setShowStitchTypePopup(!showStitchTypePopup)}
    className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 border border-gray-300"
    title="Stitch Type"
  >
    {activeStitchType === 'square' ? (
      <div className="w-5 h-5 bg-blue-500" />
    ) : (
      <div className="w-5 h-5 rounded-full bg-blue-500" />
    )}
  </button>

  {/* Popup Panel */}
  {showStitchTypePopup && (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50 min-w-[200px]">
      <div className="text-sm font-medium text-gray-700 mb-2">Stitch Type</div>
      <p className="text-xs text-gray-500 mb-3">
        You can add multiple stitch types to a single square.
      </p>

      {/* Stitch Type Options */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveStitchType('square')}
          className={`w-12 h-12 flex items-center justify-center rounded border-2 ${
            activeStitchType === 'square'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          title="Square stitch"
        >
          <div className="w-6 h-6 bg-current" />
        </button>
        <button
          onClick={() => setActiveStitchType('circle')}
          className={`w-12 h-12 flex items-center justify-center rounded border-2 ${
            activeStitchType === 'circle'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          title="Circle stitch"
        >
          <div className="w-6 h-6 rounded-full bg-current" />
        </button>
      </div>

      {/* Circle Position Grid (shown only when circle selected) */}
      {activeStitchType === 'circle' && (
        <>
          <div className="text-sm font-medium text-gray-700 mb-2">Position</div>
          <div className="grid grid-cols-3 gap-1 p-2 bg-gray-50 rounded w-fit">
            {(['top-left', 'top-center', 'top-right',
               'middle-left', 'center', 'middle-right',
               'bottom-left', 'bottom-center', 'bottom-right'] as CirclePosition[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setActiveCirclePosition(pos)}
                className={`w-6 h-6 rounded-full ${
                  activeCirclePosition === pos
                    ? 'bg-blue-500'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                title={pos.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              />
            ))}
          </div>
        </>
      )}

      {/* Done button */}
      <button
        onClick={() => setShowStitchTypePopup(false)}
        className="mt-3 w-full py-1.5 text-blue-500 font-medium hover:bg-blue-50 rounded"
      >
        Done
      </button>
    </div>
  )}
</div>
```

**Key behavior:**
- The toolbar button icon changes to match the selected stitch type
- All drawing tools (pencil, fill, eraser, line, rectangle, ellipse) use the selected stitch type
- For circles, the position determines where on the cell the circle is placed

### 8. Symbol Rendering for Circles

Symbols on circles should be:
- Centered on the circle
- Scaled appropriately to fit within circle bounds
- Consider: smaller font size than squares since circles are smaller

```typescript
if (showSymbols && color?.symbol && cellSize >= 16) {
  const fontSize = stitchType === 'circle'
    ? Math.max(8, cellSize * 0.5)
    : Math.max(10, cellSize * 0.6);

  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = getContrastColor(color.rgb);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (stitchType === 'circle') {
    ctx.fillText(color.symbol, centerX, centerY);
  } else {
    ctx.fillText(color.symbol, x + cellSize/2, y + cellSize/2);
  }
}
```

## Implementation Steps

### Step 1: Update Data Models
- [ ] Add `StitchType` type to `patternStore.ts`
- [ ] Add `CirclePosition` type to `patternStore.ts`
- [ ] Add optional `type` and `position` fields to `Stitch` interface
- [ ] Add `activeStitchType` and `activeCirclePosition` state and setters
- [ ] Update Rust `Stitch` struct with optional stitch_type and position fields

### Step 2: Update Store Logic
- [ ] Modify `setStitch` to accept and store stitch type and position
- [ ] Update stitch uniqueness check to include type and position
- [ ] Ensure backward compatibility (missing type = square)

### Step 3: Update Canvas Rendering
- [ ] Add `getCircleCenter` helper function
- [ ] Add circle rendering branch in draw loop with position support
- [ ] Render circles after squares (due to overlap)
- [ ] Update symbol rendering for circles
- [ ] Handle selection highlighting for circles

### Step 4: Update Input Handling
- [ ] Modify pencil tool to use active stitch type and position
- [ ] Update eraser to remove ALL stitches at cell (regardless of type)
- [ ] Handle drawing mode (continuous drawing) for circles

### Step 5: Add UI Controls
- [ ] Add stitch type selector to toolbar (square/circle buttons)
- [ ] Add circle position selector (shown when circle active)
- [ ] Add keyboard shortcuts (optional)

### Step 6: Testing & Polish
- [ ] Test saving/loading with circle stitches at various positions
- [ ] Test undo/redo with circles
- [ ] Test copy/paste with circles
- [ ] Test zoom levels for circle rendering
- [ ] Test progress mode with circles

## File Changes Summary

| File | Changes |
|------|---------|
| `src/stores/patternStore.ts` | Add StitchType, CirclePosition, update Stitch interface, add activeStitchType & activeCirclePosition |
| `src-tauri/src/lib.rs` | Add stitch_type and position fields to Stitch struct |
| `src/components/PatternCanvas.tsx` | Add circle rendering with position support, update click handling |
| `src/components/Toolbar.tsx` | Add stitch type selector and circle position selector UI |

## Open Questions

1. **Fill tool behavior with circles**: How to define adjacency for circle fill?
   - Proposal: Fill creates circles at every cell in the filled area, all at the same position (e.g., all center)

2. **Shape tools with circles**: Line/rectangle/ellipse create circles at each cell position
   - Proposal: Shape tools create the selected stitch type at each cell along the shape

3. **Circle size**: Fixed ratio to cell size, or user-configurable?
   - Proposal: Fixed at ~90% radius (diameter ~1.8 cells) for now

4. **Circle outline**: Always shown, or only when cell is large enough?
   - Proposal: Always show black outline, thickness scales with zoom (min 2px)

5. **Multiple stitches per cell**: Can a cell have both a square AND a circle?
   - Proposal: Yes, they're different stitch types and can coexist
   - Rendering: Squares first, then circles on top

6. **Eraser behavior**: How does eraser work with overlapping types?
   - Eraser is **precise** - it removes only the specific stitches it passes over
   - When zoomed in, you can erase individual circle positions (e.g., erase center but keep corners)
   - Hit detection for circles uses the circle's center point + radius
   - For squares, hit detection uses the cell bounds
   - This allows fine-grained control when zoomed in
