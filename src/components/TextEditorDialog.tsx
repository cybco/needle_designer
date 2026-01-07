import { useState, useEffect, useRef, useCallback } from 'react';
import { Stitch, Color } from '../stores/patternStore';
import { bundledFonts, waitForFont } from '../data/bundledFonts';
import { isBitmapFont, bitmapFonts } from '../data/bitmapFonts';
import { renderBitmapText } from '../data/bitmapFontRenderer';

interface TextEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stitches: Stitch[], width: number, height: number, colorToAdd?: Color) => void;
  colorPalette: Color[];
  initialColorId: string;
  onOpenFontBrowser: () => void;
  selectedFont: string;
  selectedWeight: number;
  onWeightChange: (weight: number) => void;
}

// Convert text to stitches using canvas rendering
// targetHeight is the desired height in stitches
// Uses direct pixel rendering at target size to leverage browser font hinting
function textToStitchesRegular(
  text: string,
  fontFamily: string,
  targetHeight: number,
  fontWeight: number,
  italic: boolean,
  colorId: string
): { stitches: Stitch[]; width: number; height: number } {
  // Create temporary canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Render directly at target pixel size - let the browser's font hinting do the work
  // This produces much better results at small sizes than downscaling
  const fontSize = targetHeight;

  // Set up font - use pixel units directly
  const fontStyle = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.font = fontStyle;

  // Handle multiline text
  const lines = text.split('\n');
  const lineHeight = Math.ceil(fontSize * 1.2);

  // Measure text to determine canvas size
  let maxWidth = 0;
  let maxLeft = 0;

  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, Math.ceil(metrics.width));
    if (metrics.actualBoundingBoxLeft !== undefined) {
      maxLeft = Math.max(maxLeft, Math.ceil(metrics.actualBoundingBoxLeft));
    }
  }

  // Add padding for italic slant and glyph overflow
  const italicExtra = italic ? Math.ceil(fontSize * 0.4) : 0;
  const padding = Math.max(2, Math.ceil(fontSize * 0.3));
  const leftPadding = padding + italicExtra + maxLeft;

  const totalHeight = lineHeight * lines.length;

  // Size canvas - add extra padding to ensure nothing is clipped
  canvas.width = Math.ceil(maxWidth) + leftPadding + padding + italicExtra;
  canvas.height = totalHeight + padding * 2;

  // Disable image smoothing for crisp pixel rendering
  ctx.imageSmoothingEnabled = false;

  // Clear canvas
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Re-set font after canvas resize (canvas resize clears context state)
  ctx.font = fontStyle;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = false;

  // Render text at integer pixel positions for best hinting
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], Math.round(leftPadding), Math.round(padding + i * lineHeight));
  }

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Find bounding box and collect filled pixels
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  const filledPixels: { x: number; y: number }[] = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;

      // Use threshold to convert anti-aliased pixels to binary
      // Lower threshold (< 180) captures more of the glyph including anti-aliased edges
      if (brightness < 180) {
        filledPixels.push({ x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (filledPixels.length === 0) {
    return { stitches: [], width: 0, height: 0 };
  }

  // Calculate dimensions from bounding box
  const finalWidth = maxX - minX + 1;
  const finalHeight = maxY - minY + 1;

  // Convert to stitches, normalized to origin (0,0)
  const stitches: Stitch[] = filledPixels.map(p => ({
    x: p.x - minX,
    y: p.y - minY,
    colorId,
    completed: false,
  }));

  return { stitches, width: finalWidth, height: finalHeight };
}

export function TextEditorDialog({
  isOpen,
  onClose,
  onConfirm,
  colorPalette,
  initialColorId,
  onOpenFontBrowser,
  selectedFont,
  selectedWeight,
  onWeightChange,
}: TextEditorDialogProps) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(24);
  const [fontSizeInput, setFontSizeInput] = useState('24'); // Local string for free typing
  const [italic, setItalic] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState(initialColorId);
  const [previewData, setPreviewData] = useState<{ stitches: Stitch[]; width: number; height: number } | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Use initialColorId if it exists in palette, otherwise use first color, otherwise use a placeholder
      const validColorId = colorPalette.find(c => c.id === initialColorId)
        ? initialColorId
        : colorPalette.length > 0
          ? colorPalette[0].id
          : '__black__';
      setSelectedColorId(validColorId);
      setFontSizeInput('24'); // Reset to default
      setFontSize(24);
    }
  }, [isOpen, initialColorId, colorPalette]);

  // Get current color RGB - default to black if no color selected
  const currentColor = colorPalette.find(c => c.id === selectedColorId);
  const colorRgb: [number, number, number] = currentColor?.rgb ?? [0, 0, 0];

  // Effective color ID to use (for stitches) - if using placeholder, we'll need to add black to palette
  const effectiveColorId = currentColor ? selectedColorId : '__black__';

  // Load the selected font
  useEffect(() => {
    const loadFont = async () => {
      setFontLoaded(false);
      const loaded = await waitForFont(selectedFont, selectedWeight);
      setFontLoaded(loaded);
    };
    loadFont();
  }, [selectedFont, selectedWeight]);

  // Check if current font is a bitmap font
  const isBitmap = isBitmapFont(selectedFont);

  // Generate preview when text or settings change
  const generatePreview = useCallback(() => {
    if (!text.trim()) {
      setPreviewData(null);
      return;
    }

    // Use bitmap renderer for bitmap fonts (no font loading needed)
    if (isBitmapFont(selectedFont)) {
      const data = renderBitmapText(text, selectedFont, fontSize, effectiveColorId);
      setPreviewData(data);
      return;
    }

    // For other fonts, wait for font to load
    if (!fontLoaded) {
      setPreviewData(null);
      return;
    }

    const data = textToStitchesRegular(text, selectedFont, fontSize, selectedWeight, italic, effectiveColorId);
    setPreviewData(data);
  }, [text, selectedFont, fontSize, selectedWeight, italic, effectiveColorId, fontLoaded]);

  useEffect(() => {
    const debounce = setTimeout(generatePreview, 150);
    return () => clearTimeout(debounce);
  }, [generatePreview]);

  // Draw preview on canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !previewData) return;

    const ctx = canvas.getContext('2d')!;
    const cellSize = Math.min(4, Math.max(1, Math.floor(200 / Math.max(previewData.width, previewData.height))));

    canvas.width = previewData.width * cellSize;
    canvas.height = previewData.height * cellSize;

    // Clear
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= previewData.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= previewData.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvas.width, y * cellSize);
      ctx.stroke();
    }

    // Draw stitches
    ctx.fillStyle = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
    for (const stitch of previewData.stitches) {
      ctx.fillRect(stitch.x * cellSize, stitch.y * cellSize, cellSize, cellSize);
    }
  }, [previewData, colorRgb]);

  const handleConfirm = () => {
    if (previewData && previewData.stitches.length > 0) {
      // If no color was available in palette, add black
      const colorToAdd: Color | undefined = !currentColor ? {
        id: '__black__',
        name: 'Black',
        rgb: [0, 0, 0],
      } : undefined;
      onConfirm(previewData.stitches, previewData.width, previewData.height, colorToAdd);
      setText('');
      onClose();
    }
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  if (!isOpen) return null;

  const currentFontData = bundledFonts.find(f => f.family === selectedFont);
  const isBundledFont = !!currentFontData;
  const currentBitmapFont = bitmapFonts.find(f => f.family === selectedFont);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Text</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            x
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
          </div>

          {/* Font Selection */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Font
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  style={{ fontFamily: `"${selectedFont}", sans-serif` }}
                >
                  {selectedFont}
                  {!isBitmap && !fontLoaded && <span className="text-gray-400 ml-2">(loading...)</span>}
                  {currentBitmapFont && <span className="text-xs text-green-600 ml-2">(pixel-perfect)</span>}
                  {isBundledFont && <span className="text-xs text-green-600 ml-2">(available)</span>}
                </div>
                <button
                  onClick={onOpenFontBrowser}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>

          {/* Size and Style */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size (stitches tall)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={fontSizeInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing any digits
                  if (val === '' || /^\d+$/.test(val)) {
                    setFontSizeInput(val);
                    // Update fontSize if valid number for live preview
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 1) {
                      setFontSize(num);
                    }
                  }
                }}
                onBlur={() => {
                  // Validate and clamp on blur
                  const num = parseInt(fontSizeInput);
                  if (isNaN(num) || num < 8) {
                    setFontSize(8);
                    setFontSizeInput('8');
                  } else if (num > 200) {
                    setFontSize(200);
                    setFontSizeInput('200');
                  } else {
                    setFontSize(num);
                    setFontSizeInput(String(num));
                  }
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <button
                onClick={() => onWeightChange(selectedWeight >= 700 ? 400 : 700)}
                className={`w-10 h-10 flex items-center justify-center rounded border ${
                  selectedWeight >= 700
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title={selectedWeight >= 700 ? 'Bold' : 'Regular'}
              >
                <span className="font-bold">B</span>
              </button>
              <button
                onClick={() => setItalic(!italic)}
                className={`w-10 h-10 flex items-center justify-center rounded border ${
                  italic
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                title="Italic"
              >
                <span className="italic font-serif">I</span>
              </button>
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colorPalette.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColorId(color.id)}
                  className={`w-8 h-8 rounded border-2 transition-all ${
                    selectedColorId === color.id
                      ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})` }}
                  title={color.name}
                />
              ))}
            </div>
            {currentColor && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {currentColor.name}
                {currentColor.threadCode && ` (${currentColor.threadCode})`}
              </p>
            )}
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preview
            </label>
            <div className="border border-gray-300 rounded-md p-2 bg-gray-50 min-h-[120px] flex items-center justify-center overflow-auto">
              {previewData && previewData.stitches.length > 0 ? (
                <div className="text-center">
                  <canvas
                    ref={previewCanvasRef}
                    className="border border-gray-200 mx-auto"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {previewData.width} x {previewData.height} stitches ({previewData.stitches.length} total)
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">
                  {text.trim() ? 'Generating preview...' : 'Enter text to see preview'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!previewData || previewData.stitches.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add Text
          </button>
        </div>
      </div>
    </div>
  );
}
