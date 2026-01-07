# Text System Architecture

## Overview

The text rendering system uses a **unified high-resolution render + coverage sampling** approach that keeps the font preview readable at any stitch size while providing precise control over the output.

## Key Components

### 1. Unified Text Renderer (`src/utils/textToStitches.ts`)

Single entry point for all text rendering:

```typescript
renderTextToStitches(options: TextRenderOptions): TextRenderResult
```

**Options:**
- `text` - The text to render
- `fontFamily` - Font name
- `fontWeight` - Font weight (400 = regular, 700 = bold)
- `italic` - Whether to render italic
- `targetHeight` - Desired height in stitches
- `colorId` - Color for the stitches
- `boldness` - Coverage threshold (0.0-1.0, default 0.5)

### 2. Two-Stage Rendering

**Stage 1: High-Resolution Render**
- Text is always rendered at 8x target size (minimum 48px)
- Browser font hinting and anti-aliasing work optimally
- Result is always readable in preview

**Stage 2: Coverage-Based Sampling**
- High-res image is sampled into stitch grid
- Each cell's "darkness" is calculated
- Boldness threshold determines if cell becomes a stitch

### 3. Preview with Grid Overlay

The `TextEditorDialog` shows:
- High-resolution text image (always readable)
- Blue grid overlay showing stitch cell boundaries
- Semi-transparent color fill showing which cells will become stitches

### 4. Text Layer Metadata

Text layers store rendering parameters for re-rendering on resize:

```typescript
interface TextLayerMetadata {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: number;
  italic: boolean;
  colorId: string;
  boldness: number;
}
```

### 5. Smart Resize

When a text layer is resized:
- The system detects `metadata.type === 'text'`
- Re-renders the text at the new target height
- Results in optimal quality at any size
- Non-text layers use the standard `resampleStitches()` approach

## UI Controls

### Thickness Slider
- Controls the `boldness` parameter (0-100%)
- Lower values = thinner strokes (higher threshold)
- Higher values = thicker strokes (lower threshold)
- Affects how much of each stitch cell needs to be filled

### Bold/Italic Buttons
- Toggle `fontWeight` between 400 and 700
- Toggle `italic` style

## Bitmap Fonts

Bitmap fonts (like "Pixel 8x8") use direct pixel mapping:
- No high-res rendering needed (already pixel-perfect)
- Boldness slider has no effect
- Scaling uses block multiplication for clean integer scales

## File Locations

| File | Purpose |
|------|---------|
| `src/utils/textToStitches.ts` | Unified renderer |
| `src/components/TextEditorDialog.tsx` | Text input UI with preview |
| `src/stores/patternStore.ts` | Layer metadata, resize handling |
| `src/data/bitmapFonts.ts` | Bitmap font glyph data |
| `src/data/bitmapFontRenderer.ts` | Legacy bitmap renderer (still used for bitmap fonts) |
