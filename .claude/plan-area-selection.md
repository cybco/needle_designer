# Plan: Area Selection Tool with Duplicate/Delete/New Layer

## Overview

Add a rectangular area selection tool that allows users to:
- Select a rectangular region of stitches by clicking and dragging
- Once selected, show a context menu with options:
  - **Duplicate** - Copy selected stitches and place as floating selection
  - **Delete** - Remove selected stitches from their layers
  - **New Layer** - Move selected stitches to a new layer
- Menu appears after selection is complete, disappears when new selection starts

## Current State

The existing selection system is **layer-based**:
- Clicking a stitch selects its entire layer
- Selection bounds encompass all stitches in the layer
- Transform operations affect the whole layer

We need to add **area-based selection** that operates on a subset of stitches.

## Implementation Steps

### Step 1: Extend SelectionState

**File: `src/stores/patternStore.ts`**

Extend the SelectionState interface:

```typescript
export interface SelectionState {
  // existing fields...
  selectionType: 'layer' | 'area';           // NEW - distinguish selection types
  selectedStitches?: Stitch[];                // NEW - stitches within area selection
  isSelecting?: boolean;                      // NEW - true while dragging to create selection
  selectionStart?: { x: number; y: number };  // NEW - start point of rectangle drag
}
```

### Step 2: Add Store Actions

**File: `src/stores/patternStore.ts`**

Add new actions to the interface and implementation:

```typescript
// New action signatures
startAreaSelection: (point: { x: number; y: number }) => void;
updateAreaSelection: (point: { x: number; y: number }) => void;
endAreaSelection: () => void;
duplicateSelection: () => void;
deleteSelection: () => void;
selectionToNewLayer: () => void;
```

**Action implementations:**

1. **startAreaSelection** - Begin rectangle drag, store start point, set `isSelecting: true`
2. **updateAreaSelection** - Update selection rectangle bounds during drag
3. **endAreaSelection** - Extract all stitches within bounds from visible layers, set `isSelecting: false`
4. **duplicateSelection** - Copy selected stitches as floating selection at same position
5. **deleteSelection** - Remove selected stitches from their source layers
6. **selectionToNewLayer** - Move selected stitches from current layers to a new layer

### Step 3: Update PatternCanvas Mouse Handling

**File: `src/components/PatternCanvas.tsx`**

Modify mouse event handlers for select tool:

**onMouseDown:**
- If clicking on existing area selection bounds → start drag to move
- If clicking outside or on empty space → clear existing selection, start new area selection
- Set `isSelecting: true` which hides the context menu

**onMouseMove:**
- If `isSelecting` → update selection rectangle bounds
- If dragging existing selection → move selection

**onMouseUp:**
- If `isSelecting` → finalize selection, extract stitches, show context menu
- Set `isSelecting: false`

**Rendering:**
- Draw selection rectangle with dashed border during and after selection
- Show context menu only when selection exists AND `isSelecting === false`

### Step 4: Add Selection Context Menu Component

**File: `src/components/SelectionContextMenu.tsx`** (NEW)

A floating menu that appears near the selection with three buttons:

```tsx
interface SelectionContextMenuProps {
  position: { x: number; y: number };  // Screen position
  onDuplicate: () => void;
  onDelete: () => void;
  onNewLayer: () => void;
}

function SelectionContextMenu({ position, onDuplicate, onDelete, onNewLayer }: SelectionContextMenuProps) {
  return (
    <div
      className="absolute bg-white rounded shadow-lg border border-gray-200 py-1 z-50"
      style={{ left: position.x, top: position.y }}
    >
      <button onClick={onDuplicate} className="...">Duplicate</button>
      <button onClick={onNewLayer} className="...">New Layer</button>
      <button onClick={onDelete} className="...">Delete</button>
    </div>
  );
}
```

**Menu positioning:**
- Appears at bottom-right corner of selection bounds
- Converts canvas coordinates to screen coordinates using zoom and pan offset
- Stays within viewport bounds

### Step 5: Add Keyboard Shortcuts

**File: `src/components/PatternCanvas.tsx`**

- `Delete` or `Backspace` → deleteSelection()
- `Escape` → clearSelection()
- `Ctrl/Cmd + D` → duplicateSelection() (optional)

## Detailed Implementation Notes

### Extracting Stitches from Bounds

```typescript
function extractStitchesInBounds(
  layers: Layer[],
  bounds: { x: number; y: number; width: number; height: number }
): Stitch[] {
  const stitchMap = new Map<string, Stitch>();

  // Process layers from bottom to top (higher index = on top)
  for (const layer of layers) {
    if (!layer.visible) continue;

    for (const stitch of layer.stitches) {
      if (
        stitch.x >= bounds.x &&
        stitch.x < bounds.x + bounds.width &&
        stitch.y >= bounds.y &&
        stitch.y < bounds.y + bounds.height
      ) {
        // Later layers overwrite earlier ones at same position
        stitchMap.set(`${stitch.x},${stitch.y}`, { ...stitch });
      }
    }
  }

  return Array.from(stitchMap.values());
}
```

### Duplicate Selection

```typescript
duplicateSelection: () => {
  const { selection } = get();
  if (selection?.selectionType !== 'area' || !selection.selectedStitches?.length) return;

  // Create floating selection with the same stitches at same position
  // User can then drag to reposition before committing
  set({
    selection: {
      ...selection,
      floatingStitches: selection.selectedStitches.map(s => ({ ...s })),
      isDragging: false,
    },
  });
}
```

### Delete Selection

```typescript
deleteSelection: () => {
  const { pattern, selection } = get();
  if (!pattern || selection?.selectionType !== 'area' || !selection.selectedStitches?.length) return;

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
}
```

### Selection to New Layer

```typescript
selectionToNewLayer: () => {
  const { pattern, selection } = get();
  if (!pattern || selection?.selectionType !== 'area' || !selection.selectedStitches?.length) return;

  pushToHistory();

  // Create set of positions to move
  const toMove = new Set(
    selection.selectedStitches.map(s => `${s.x},${s.y}`)
  );

  // Remove from existing layers
  const updatedLayers = pattern.layers.map(layer => ({
    ...layer,
    stitches: layer.stitches.filter(s => !toMove.has(`${s.x},${s.y}`)),
  }));

  // Create new layer with selected stitches
  const newLayerId = `layer-${Date.now()}`;
  const newLayer: Layer = {
    id: newLayerId,
    name: `Selection`,
    visible: true,
    locked: false,
    stitches: selection.selectedStitches.map(s => ({ ...s })),
  };

  set({
    pattern: {
      ...pattern,
      layers: [...updatedLayers, newLayer],
    },
    activeLayerId: newLayerId,
    selection: null,
    hasUnsavedChanges: true,
  });
}
```

## Visual Design

### Selection Rectangle
- Dashed blue border (2px)
- Light blue semi-transparent fill (10% opacity)
- Same style during drag and after completion

### Context Menu
- Small floating panel with 3 buttons stacked vertically
- Appears at bottom-right of selection (or top-right if near bottom edge)
- White background, subtle shadow
- Disappears immediately when mouse down starts new selection

```
┌─────────────┐
│  Duplicate  │
│  New Layer  │
│   Delete    │
└─────────────┘
```

### Menu Visibility Logic
```
Menu visible when:
  - selection exists
  - selectionType === 'area'
  - isSelecting === false
  - selectedStitches.length > 0

Menu hidden when:
  - No selection
  - isSelecting === true (dragging to create new selection)
  - selectionType === 'layer'
```

## Testing Checklist

- [ ] Draw rectangle to select stitches
- [ ] Selection includes stitches from multiple visible layers
- [ ] Hidden layers excluded from selection
- [ ] Context menu appears after selection completes
- [ ] Context menu disappears when starting new selection
- [ ] Duplicate creates moveable copy
- [ ] Delete removes stitches from all layers
- [ ] New Layer moves stitches to new layer
- [ ] Empty selection (no stitches in bounds) shows no menu
- [ ] Clicking outside clears selection
- [ ] Escape clears selection
- [ ] Delete key deletes selection
- [ ] Undo/redo works for all operations

## Files to Modify

1. **src/stores/patternStore.ts**
   - Extend SelectionState interface
   - Add new action methods (6 total)

2. **src/components/PatternCanvas.tsx**
   - Update mouse handlers for rectangle selection
   - Render selection rectangle during drag
   - Render context menu when selection complete
   - Add keyboard shortcut handlers

3. **src/components/SelectionContextMenu.tsx** (NEW)
   - Context menu component with 3 action buttons
