# Color Swap Tool Implementation Plan

## Overview
Add a new "Color Swap" tool that allows users to click on any stitch on the canvas to replace **all stitches of that clicked color** (on the active layer) with the currently selected palette color. Users can continue swapping multiple colors in sequence without leaving the tool.

## User Flow
1. User selects the Color Swap tool from the toolbar (or presses `C`)
2. User selects a color from the palette (the "target" color they want to change TO)
3. User clicks on any stitch on the canvas
4. All stitches on the active layer that match the clicked stitch's color are changed to the selected palette color
5. **User can then:**
   - Click another stitch with a different color to swap that color too
   - Select a different color from the palette and continue swapping
   - Switch to another tool when done

## Key Behavior
- Tool remains active after each swap (no tool switch required)
- Palette selection can change while tool is active
- Each click on a different colored stitch performs a new swap operation
- Clicking a stitch that already matches the selected color does nothing

## Implementation Steps

### Step 1: Add Tool Type
**File:** [patternStore.ts](../src/stores/patternStore.ts#L68)

Add `'colorswap'` to the `Tool` type union:
```typescript
export type Tool = 'pencil' | 'eraser' | 'fill' | 'pan' | 'select' | 'text' | 'line' | 'rectangle' | 'ellipse' | 'colorswap';
```

### Step 2: Add Store Action
**File:** [patternStore.ts](../src/stores/patternStore.ts)

Add a new `swapColorOnLayer` action to the store interface and implementation:

```typescript
// In interface PatternState (around line 150):
swapColorOnLayer: (fromColorId: string, toColorId: string) => void;

// Implementation:
swapColorOnLayer: (fromColorId, toColorId) => {
  const { pattern, activeLayerId } = get();
  if (!pattern || !activeLayerId) return;
  if (fromColorId === toColorId) return; // No-op if same color

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
```

### Step 3: Add Tool Visibility
**File:** [Toolbar.tsx](../src/components/Toolbar.tsx#L5-L21)

Add `colorswap` to `ToolVisibility` interface and `DEFAULT_VISIBILITY`:

```typescript
export interface ToolVisibility {
  // ... existing tools
  colorswap: boolean;
}

const DEFAULT_VISIBILITY: ToolVisibility = {
  // ... existing tools
  colorswap: true,
};
```

### Step 4: Create ColorSwap Icon
**File:** [Toolbar.tsx](../src/components/Toolbar.tsx)

Add a new icon component (two overlapping color swatches with arrows):

```typescript
export function ColorSwapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Two squares representing colors */}
      <rect x="3" y="3" width="7" height="7" fill="#E57373" stroke="#333" strokeWidth="1.5" />
      <rect x="14" y="14" width="7" height="7" fill="#64B5F6" stroke="#333" strokeWidth="1.5" />
      {/* Swap arrows */}
      <path d="M14 7 L17 7 L17 10" stroke="#333" strokeWidth="1.5" fill="none" />
      <path d="M10 17 L7 17 L7 14" stroke="#333" strokeWidth="1.5" fill="none" />
      <path d="M10 7 L17 14" stroke="#333" strokeWidth="1.5" />
    </svg>
  );
}
```

### Step 5: Add Tool Button to Toolbar
**File:** [Toolbar.tsx](../src/components/Toolbar.tsx)

Add the ColorSwap tool button in the Drawing tools section (after Fill):

```typescript
{toolVisibility.colorswap && (
  <ToolButton
    tool="colorswap"
    icon={<ColorSwapIcon />}
    label="Color Swap (C)"
    activeTool={activeTool}
    onClick={setTool}
  />
)}
```

Update `hasDrawingTools` check to include `colorswap`.

### Step 6: Add Keyboard Shortcut
**File:** [App.tsx](../src/App.tsx)

Add keyboard shortcut `C` for colorswap tool in the keyboard handler:

```typescript
case 'c':
  if (!e.ctrlKey && !e.metaKey) {
    setTool('colorswap');
    e.preventDefault();
  }
  break;
```

### Step 7: Handle Canvas Click for ColorSwap
**File:** [PatternCanvas.tsx](../src/components/PatternCanvas.tsx#L1444-L1466)

Add colorswap handling in `handleMouseDown` after the `selectedColorId` check:

```typescript
// After fill handling, before shape tools:
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
}
```

Import `swapColorOnLayer` from the store at the top of the file.

### Step 8: Update Preferences (if applicable)
**File:** [PreferencesModal.tsx](../src/components/PreferencesModal.tsx) (if it exists and manages tool visibility)

Add colorswap to any tool visibility preferences UI.

## Testing Checklist
- [ ] Tool appears in toolbar with correct icon
- [ ] Keyboard shortcut `C` activates tool
- [ ] Clicking empty canvas does nothing
- [ ] Clicking a stitch swaps all matching colors on active layer
- [ ] Clicking same color as selected does nothing (no-op)
- [ ] Undo restores previous colors
- [ ] Locked layers cannot be modified
- [ ] Only active layer is affected (other layers unchanged)
- [ ] Tool requires color to be selected (like pencil/fill)
- [ ] Tool stays active after swap (can click another color immediately)
- [ ] Changing palette selection while tool is active works correctly
- [ ] Multiple sequential swaps each create separate undo entries

## Files to Modify
1. [src/stores/patternStore.ts](../src/stores/patternStore.ts) - Add tool type and store action
2. [src/components/Toolbar.tsx](../src/components/Toolbar.tsx) - Add icon, visibility, and button
3. [src/components/PatternCanvas.tsx](../src/components/PatternCanvas.tsx) - Handle click event
4. [src/App.tsx](../src/App.tsx) - Add keyboard shortcut
5. [src/components/PreferencesModal.tsx](../src/components/PreferencesModal.tsx) - Tool visibility (if exists)
