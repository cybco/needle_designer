# Realistic Canvas Rendering Feature

## Product Requirements Document (PRD)

### Overview
Add an option to render the pattern canvas with a realistic woven mesh appearance that mimics actual needlepoint/cross-stitch canvas material. This provides a more authentic preview of how the finished work will look on real canvas.

### Problem Statement
Currently, the canvas displays patterns on a simple grid which, while functional, doesn't give users a realistic sense of how their work will appear on actual needlepoint canvas. Professional needlepoint software often includes realistic canvas rendering to help designers visualize the final product.

### Goals
1. Provide a realistic woven canvas rendering option
2. Allow users to toggle between "Grid" and "Canvas" display modes
3. Maintain performance for large patterns
4. Support all existing features (designing, coloring, progress tracking, mesh count)

### User Stories
- As a designer, I want to see my pattern on a realistic canvas so I can better visualize the finished piece
- As a user, I want to toggle between grid and canvas views depending on my task (precise editing vs. preview)
- As a user tracking progress, I want to see completed stitches on realistic canvas to see how my work is progressing

### Feature Requirements

#### Display Modes
| Mode | Description | Use Case |
|------|-------------|----------|
| **Grid** | Current simple grid lines | Precise editing, performance |
| **Canvas** | Realistic woven mesh pattern | Preview, visualization |

#### Canvas Rendering
- Woven basket-weave pattern showing horizontal and vertical threads
- Threads should appear to go over/under each other (interlocking)
- Canvas color should be customizable (white, ecru, cream, etc.)
- Stitches render on top of the canvas mesh
- Mesh holes visible where no stitch exists
- Mesh will need to be represetative of the mesh size selected

#### Toggle Control
- Add toggle in Preferences menu: "Canvas Style: Grid / Canvas"
- Add keyboard shortcut (suggested: `Ctrl+Shift+C`)
- Persist preference across sessions
- Option in toolbar or footer for quick access

#### Performance Considerations
- Canvas rendering should not significantly impact pan/zoom performance
- Consider using cached/tiled rendering for large patterns
- May need to simplify mesh at low zoom levels

---

## Technical Implementation Plan

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    PatternCanvas.tsx                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │  Canvas Layer   │    │     Stitch Layer            │ │
│  │  (Background)   │    │     (Foreground)            │ │
│  │                 │    │                             │ │
│  │  - Grid Mode    │    │  - Rendered stitches        │ │
│  │  - Canvas Mode  │    │  - Selection overlays       │ │
│  │    (woven mesh) │    │  - Progress shading         │ │
│  └─────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Phase 1: Core Canvas Rendering

#### 1.1 Create Canvas Mesh Pattern Generator

**File: `src/utils/canvasMeshPattern.ts`**

```typescript
interface MeshPatternOptions {
  cellSize: number;           // Size of each stitch cell in pixels
  threadWidth: number;        // Width of canvas threads (relative to cell)
  canvasColor: string;        // Base canvas color (e.g., '#F5F5DC')
  threadHighlight: string;    // Highlight color for 3D effect
  threadShadow: string;       // Shadow color for 3D effect
  holeColor: string;          // Color of mesh holes
}

// Generate a single tile of the woven pattern
function generateMeshTile(options: MeshPatternOptions): HTMLCanvasElement

// Create a repeatable pattern from the tile
function createMeshPattern(ctx: CanvasRenderingContext2D, options: MeshPatternOptions): CanvasPattern
```

#### 1.2 Mesh Rendering Algorithm

The woven pattern consists of:
1. **Horizontal threads** - Going left to right
2. **Vertical threads** - Going top to bottom
3. **Intersection logic** - Alternating over/under pattern

```
Cell Layout (2x2 cells shown):
┌─────┬─────┐
│  H  │  V  │   H = Horizontal thread on top
├─────┼─────┤   V = Vertical thread on top
│  V  │  H  │   (alternating checkerboard)
└─────┴─────┘
```

**Rendering steps per cell:**
1. Draw mesh hole (dark background)
2. Draw thread going "under" first
3. Draw thread going "over" second
4. Add subtle highlights/shadows for 3D effect

#### 1.3 Update PatternCanvas Component

**Modifications to `src/components/PatternCanvas.tsx`:**

```typescript
// Add new prop/state
interface PatternCanvasProps {
  canvasStyle: 'grid' | 'canvas';  // New prop
  canvasColor?: string;             // Optional canvas color
}

// In render function:
if (canvasStyle === 'canvas') {
  drawWovenMesh(ctx, visibleArea, cellSize, canvasColor);
} else {
  drawGrid(ctx, visibleArea, cellSize);
}

// Stitch rendering updates for canvas mode
function drawStitchOnCanvas(ctx, x, y, color, cellSize) {
  // Draw stitch with slight inset to show canvas edges
  // Add thread texture effect to stitch
}
```

### Phase 2: State & Preferences

#### 2.1 Update Preferences

**File: `src/App.tsx` - Preferences interface:**

```typescript
interface Preferences {
  // ... existing preferences
  canvasStyle: 'grid' | 'canvas';
  canvasColor: string;  // '#FFFFFF', '#F5F5DC', '#FFFDD0', etc.
}

const DEFAULT_PREFERENCES: Preferences = {
  // ... existing
  canvasStyle: 'grid',
  canvasColor: '#F5F5DC',  // Ecru/beige default
};
```

#### 2.2 Update Pattern Store

**File: `src/stores/patternStore.ts`:**

```typescript
// Add to store state
canvasStyle: 'grid' | 'canvas';
canvasColor: string;

// Add actions
setCanvasStyle: (style: 'grid' | 'canvas') => void;
setCanvasColor: (color: string) => void;
```

### Phase 3: UI Controls

#### 3.1 Preferences Menu Update

Add to Preferences dropdown in App.tsx:

```tsx
<div className="px-4 py-3 border-t border-gray-600">
  <label className="block text-sm mb-2">Canvas Style</label>
  <div className="flex gap-2">
    <button
      onClick={() => updatePreferences({ canvasStyle: 'grid' })}
      className={canvasStyle === 'grid' ? 'active' : ''}>
      Grid
    </button>
    <button
      onClick={() => updatePreferences({ canvasStyle: 'canvas' })}
      className={canvasStyle === 'canvas' ? 'active' : ''}>
      Canvas
    </button>
  </div>
</div>

{canvasStyle === 'canvas' && (
  <div className="px-4 py-3 border-t border-gray-600">
    <label className="block text-sm mb-2">Canvas Color</label>
    <select value={canvasColor} onChange={...}>
      <option value="#FFFFFF">White</option>
      <option value="#F5F5DC">Ecru</option>
      <option value="#FFFDD0">Cream</option>
      <option value="#D2B48C">Tan</option>
    </select>
  </div>
)}
```

#### 3.2 Quick Toggle (Optional)

Add a small toggle button in the left panel under show / hide grid:

```tsx
<button
  onClick={toggleCanvasStyle}
  title={`Switch to ${canvasStyle === 'grid' ? 'Canvas' : 'Grid'} view`}>
  {canvasStyle === 'grid' ? '▦' : '▤'}
</button>
```

#### 3.3 Keyboard Shortcut

Add to keyboard handler in App.tsx:

```typescript
if (e.ctrlKey && e.shiftKey && e.key === 'C') {
  toggleCanvasStyle();
}
```

### Phase 4: Performance Optimization

#### 4.1 Cached Tile Rendering

```typescript
// Cache the mesh pattern tile
const meshTileCache = new Map<string, HTMLCanvasElement>();

function getMeshTile(cellSize: number, color: string): HTMLCanvasElement {
  const key = `${cellSize}-${color}`;
  if (!meshTileCache.has(key)) {
    meshTileCache.set(key, generateMeshTile({ cellSize, ... }));
  }
  return meshTileCache.get(key)!;
}
```

#### 4.2 Level-of-Detail (LOD)

```typescript
function getCanvasRenderMode(zoom: number): 'full' | 'simplified' | 'grid' {
  if (zoom < 0.3) return 'grid';        // Too zoomed out, use simple grid
  if (zoom < 0.7) return 'simplified';  // Medium zoom, simplified mesh
  return 'full';                         // Full detail mesh
}
```

#### 4.3 Viewport Culling

Only render mesh tiles that are visible in the current viewport (already implemented for stitches).

### Phase 5: Stitch Rendering on Canvas

#### 5.1 Canvas-Aware Stitch Drawing

When in canvas mode, stitches should:
- Have slight inset from cell edges to show canvas thread edges
- Optionally show thread texture
- Maintain visibility against woven background

```typescript
function drawStitchCanvasMode(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  cellSize: number,
  color: [number, number, number]
) {
  const inset = cellSize * 0.08;  // Small inset to show canvas edges

  ctx.fillStyle = `rgb(${color.join(',')})`;
  ctx.fillRect(
    x * cellSize + inset,
    y * cellSize + inset,
    cellSize - inset * 2,
    cellSize - inset * 2
  );

  // Optional: Add subtle thread texture
  // drawThreadTexture(ctx, x, y, cellSize);
}
```

### Implementation Order

| Step | Task | Estimated Effort |
|------|------|------------------|
| 1 | Create `canvasMeshPattern.ts` utility | Medium |
| 2 | Add preferences state for canvas style | Small |
| 3 | Implement mesh rendering in PatternCanvas | Large |
| 4 | Add UI toggle in Preferences | Small |
| 5 | Update stitch rendering for canvas mode | Medium |
| 6 | Add performance optimizations (caching) | Medium |
| 7 | Add LOD for different zoom levels | Medium |
| 8 | Add footer toggle button | Small |
| 9 | Add keyboard shortcut | Small |
| 10 | Testing & refinement | Medium |

### Files to Modify/Create

| File | Action | Changes |
|------|--------|---------|
| `src/utils/canvasMeshPattern.ts` | **Create** | Mesh pattern generation |
| `src/components/PatternCanvas.tsx` | Modify | Add canvas rendering mode |
| `src/stores/patternStore.ts` | Modify | Add canvasStyle state |
| `src/App.tsx` | Modify | Add preferences, keyboard shortcut |
| `src/index.css` | Modify | Any needed styles |

### Testing Plan

1. **Visual Testing**
   - Verify mesh pattern looks realistic
   - Test at various zoom levels
   - Verify stitches render correctly on mesh
   - Test with different canvas colors

2. **Performance Testing**
   - Test with large patterns (500x500+)
   - Measure frame rate during pan/zoom
   - Verify caching works correctly

3. **Integration Testing**
   - Test toggle between grid/canvas modes
   - Verify preference persistence
   - Test with progress tracking mode
   - Test with overlay images

### Future Enhancements

1. **Thread Direction** - Show diagonal tent stitch direction
2. **Stitch Types** - Different stitch appearances (tent, cross, etc.)
3. **Canvas Textures** - Import custom canvas textures
4. **3D Preview** - WebGL-based 3D canvas preview
5. **Print Mode** - Optimize canvas rendering for PDF export
