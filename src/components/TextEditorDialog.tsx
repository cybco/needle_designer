import { useState, useEffect, useRef, useCallback } from 'react';
import { Stitch, Color } from '../stores/patternStore';
import { bundledFonts, waitForFont } from '../data/bundledFonts';

interface TextEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stitches: Stitch[], width: number, height: number) => void;
  colorPalette: Color[];
  initialColorId: string;
  onOpenFontBrowser: () => void;
  selectedFont: string;
  selectedWeight: number;
}

// Convert text to stitches using canvas rendering
function textToStitches(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  italic: boolean,
  colorId: string
): { stitches: Stitch[]; width: number; height: number } {
  if (!text.trim()) {
    return { stitches: [], width: 0, height: 0 };
  }

  // Create temporary canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Set up font
  const fontStyle = `${italic ? 'italic ' : ''}${fontWeight} ${fontSize}px "${fontFamily}"`;
  ctx.font = fontStyle;

  // Handle multiline text
  const lines = text.split('\n');
  const lineHeight = Math.ceil(fontSize * 1.2);

  // Measure all lines to find actual bounding box (accounts for ascenders/descenders that extend beyond em-square)
  let maxWidth = 0;
  let maxAscent = 0;
  let maxDescent = 0;
  let maxLeft = 0;

  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, Math.ceil(metrics.width));

    // Use actual bounding box if available (modern browsers)
    if (metrics.actualBoundingBoxAscent !== undefined) {
      maxAscent = Math.max(maxAscent, Math.ceil(metrics.actualBoundingBoxAscent));
      maxDescent = Math.max(maxDescent, Math.ceil(metrics.actualBoundingBoxDescent));
      maxLeft = Math.max(maxLeft, Math.ceil(metrics.actualBoundingBoxLeft));
    }
  }

  // Fallback padding if bounding box metrics not available
  const padding = Math.max(4, Math.ceil(fontSize * 0.2));
  const topPadding = maxAscent > 0 ? Math.ceil(maxAscent * 0.3) + 2 : padding;
  const leftPadding = maxLeft > 0 ? maxLeft + 2 : padding;

  const totalHeight = lineHeight * lines.length;

  // Size canvas with adequate padding for glyphs that extend beyond em-square
  canvas.width = maxWidth + leftPadding + padding;
  canvas.height = totalHeight + topPadding + padding;

  // Clear and redraw
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render text
  ctx.font = fontStyle;
  ctx.fillStyle = 'black';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], leftPadding, topPadding + i * lineHeight);
  }

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert to stitches (any pixel that's not white becomes a stitch)
  const rawStitches: { x: number; y: number }[] = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Check if pixel is dark enough (text is rendered in black on white)
      const brightness = (r + g + b) / 3;
      if (brightness < 200) { // threshold for anti-aliased edges
        rawStitches.push({ x, y });
      }
    }
  }

  if (rawStitches.length === 0) {
    return { stitches: [], width: 0, height: 0 };
  }

  // Find bounding box of actual stitches to trim empty space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of rawStitches) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x);
    maxY = Math.max(maxY, s.y);
  }

  // Normalize coordinates to start from 0,0
  const stitches: Stitch[] = rawStitches.map(s => ({
    x: s.x - minX,
    y: s.y - minY,
    colorId,
    completed: false
  }));

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;

  return { stitches, width: trimmedWidth, height: trimmedHeight };
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
}: TextEditorDialogProps) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(24);
  const [italic, setItalic] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState(initialColorId);
  const [previewData, setPreviewData] = useState<{ stitches: Stitch[]; width: number; height: number } | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset selected color when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedColorId(initialColorId);
    }
  }, [isOpen, initialColorId]);

  // Get current color RGB
  const currentColor = colorPalette.find(c => c.id === selectedColorId);
  const colorRgb: [number, number, number] = currentColor?.rgb ?? [0, 0, 0];

  // Load the selected font
  useEffect(() => {
    const loadFont = async () => {
      setFontLoaded(false);
      const loaded = await waitForFont(selectedFont, selectedWeight);
      setFontLoaded(loaded);
    };
    loadFont();
  }, [selectedFont, selectedWeight]);

  // Generate preview when text or settings change
  const generatePreview = useCallback(() => {
    if (!text.trim() || !fontLoaded) {
      setPreviewData(null);
      return;
    }

    const data = textToStitches(text, selectedFont, fontSize, selectedWeight, italic, selectedColorId);
    setPreviewData(data);
  }, [text, selectedFont, fontSize, selectedWeight, italic, selectedColorId, fontLoaded]);

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
      onConfirm(previewData.stitches, previewData.width, previewData.height);
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
                  {!fontLoaded && <span className="text-gray-400 ml-2">(loading...)</span>}
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
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Math.max(8, Math.min(200, parseInt(e.target.value) || 24)))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="8"
                max="200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight
              </label>
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600">
                {selectedWeight}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-6">
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
