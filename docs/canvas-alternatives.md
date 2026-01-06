# Canvas Mesh Rendering - Alternative Approaches

## Problem Analysis

**Current result (6.png):** Tiny dots with thin lines - completely wrong
**Desired result (3.png):** Wide ribbon-like threads in basket-weave pattern

### Key observations from reference image (3.png):
1. Threads are **wide ribbons** (~35-40% of cell size)
2. Threads are **continuous** - spanning across the entire canvas
3. **Basket-weave pattern** - horizontal threads go over vertical at some intersections, under at others
4. **Small holes** only at corners where 4 threads meet
5. Stitch color fills the **center opening** of each cell (not covered by threads)
6. Threads have **3D appearance** with highlights on one edge, shadows on the other

---

## Alternative 1: Use Pre-made Texture Image

### Approach
- Create or source a high-quality canvas mesh texture image (PNG)
- Tile it as a repeating pattern
- Overlay stitch colors underneath, texture on top

### Implementation
```typescript
// Load texture image once
const canvasTexture = new Image();
canvasTexture.src = '/textures/canvas-mesh.png';

// Draw as pattern
const pattern = ctx.createPattern(canvasTexture, 'repeat');
ctx.fillStyle = pattern;
ctx.fillRect(0, 0, width, height);
```

### Pros
- Exact visual match possible
- Simple implementation
- Can use photorealistic texture

### Cons
- Fixed resolution - may look blurry when zoomed
- Need to create/source texture asset
- Less flexible for different mesh counts
- File size overhead

---

## Alternative 2: Draw Continuous Ribbon Threads

### Approach
- Draw threads as continuous ribbons spanning the full canvas
- First pass: draw all "under" thread segments
- Second pass: draw all "over" thread segments on top
- Track which direction is on top at each intersection using checkerboard pattern

### Implementation
```typescript
function drawCanvasMesh(ctx, width, height, cellSize) {
  const threadWidth = cellSize * 0.38;

  // For each row of horizontal threads
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isOnTop = (x + y) % 2 === 0;
      if (!isOnTop) {
        // Draw horizontal thread segment (under)
        drawHorizontalRibbon(ctx, x, y, cellSize, threadWidth, false);
      }
    }
  }

  // Draw vertical threads
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const isOnTop = (x + y) % 2 === 1;
      if (!isOnTop) {
        drawVerticalRibbon(ctx, x, y, cellSize, threadWidth, false);
      }
    }
  }

  // Second pass: draw "over" segments
  // ... similar but for isOnTop = true
}
```

### Pros
- Accurate weave representation
- Scalable to any size
- No external assets needed

### Cons
- More complex rendering logic
- Multiple passes over canvas
- Performance may suffer on large canvases

---

## Alternative 3: High-Quality Pre-rendered Tile (Recommended)

### Approach
- Create a single 2x2 cell tile that perfectly represents the weave pattern
- Key insight: each cell has thread segments on all 4 sides that connect with neighbors
- Render tile at high quality, cache it, use as repeating pattern

### Visual breakdown of one cell:
```
┌─────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Top thread (horizontal)
│▓░░░░░░░░░░░░░░░░░░▓│
│▓░                ░▓│
│▓░   STITCH       ░▓│  ← Center: stitch color shows
│▓░   COLOR        ░▓│
│▓░                ░▓│
│▓░░░░░░░░░░░░░░░░░░▓│
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← Bottom thread
└─────────────────────┘
 ↑                   ↑
Left thread      Right thread

▓ = Thread (white/grey with shading)
░ = Hole at corners
  = Open center (stitch color visible)
```

### The weave pattern in 2x2:
```
Cell (0,0): Horizontal on top    Cell (1,0): Vertical on top
Cell (0,1): Vertical on top      Cell (1,1): Horizontal on top
```

### Implementation
```typescript
function generatePerfectTile(cellSize: number): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = cellSize * 2;
  tile.height = cellSize * 2;
  const ctx = tile.getContext('2d')!;

  const threadWidth = cellSize * 0.35;
  const holeSize = cellSize * 0.08;

  // For each cell in 2x2 grid
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      const horzOnTop = (row + col) % 2 === 0;

      // Draw complete cell with threads on all 4 sides
      // Thread on top gets drawn last (over the other)

      if (horzOnTop) {
        drawVerticalThreadPair(ctx, x, y, cellSize, threadWidth); // under
        drawHorizontalThreadPair(ctx, x, y, cellSize, threadWidth); // over
      } else {
        drawHorizontalThreadPair(ctx, x, y, cellSize, threadWidth); // under
        drawVerticalThreadPair(ctx, x, y, cellSize, threadWidth); // over
      }

      // Draw small holes at 4 corners
      drawCornerHoles(ctx, x, y, cellSize, threadWidth, holeSize);
    }
  }

  return tile;
}

function drawHorizontalThreadPair(ctx, x, y, cellSize, threadWidth) {
  // Top ribbon
  ctx.fillStyle = '#F0F0F0';
  ctx.fillRect(x, y, cellSize, threadWidth);
  // Add highlight on top edge
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, cellSize, threadWidth * 0.25);
  // Add shadow on bottom edge
  ctx.fillStyle = '#D0D0D0';
  ctx.fillRect(x, y + threadWidth * 0.75, cellSize, threadWidth * 0.25);

  // Bottom ribbon (same pattern)
  ctx.fillStyle = '#F0F0F0';
  ctx.fillRect(x, y + cellSize - threadWidth, cellSize, threadWidth);
  // ... highlights and shadows
}
```

### Pros
- Best balance of quality and performance
- Accurate weave pattern
- Cached tile = fast rendering
- Scalable with zoom

### Cons
- Need to get the math exactly right
- Tile alignment must be perfect

---

## Recommendation

**Alternative 3 (High-Quality Pre-rendered Tile)** is recommended because:
1. Best performance (single cached tile)
2. Can achieve exact visual match to reference
3. No external dependencies
4. Works at all zoom levels

The key fix needed: threads must be **wide ribbons** covering significant portion of cell edges, not thin lines. The center of each cell is the "hole" where stitch color shows through.
