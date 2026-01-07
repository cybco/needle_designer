import { useState, useEffect, useRef, useCallback } from 'react';
import { Stitch, Color } from '../stores/patternStore';
import { bundledFonts, waitForFont } from '../data/bundledFonts';
import {
  generateTextPreview,
  TextLayerMetadata,
  createTextLayerMetadata,
} from '../utils/textToStitches';
import { getCustomFont } from '../data/customFonts';

interface TextEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (stitches: Stitch[], width: number, height: number, colorToAdd?: Color, metadata?: TextLayerMetadata) => void;
  colorPalette: Color[];
  initialColorId: string;
  onOpenFontBrowser: () => void;
  selectedFont: string;
  selectedWeight: number;
  onWeightChange: (weight: number) => void;
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
  // Default values for reset
  const DEFAULT_FONT_SIZE = 24;
  const DEFAULT_BOLDNESS = 0.5;
  const DEFAULT_ITALIC = false;

  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [fontSizeInput, setFontSizeInput] = useState(String(DEFAULT_FONT_SIZE));
  const [italic, setItalic] = useState(DEFAULT_ITALIC);
  const [boldness, setBoldness] = useState(DEFAULT_BOLDNESS);
  const [selectedColorId, setSelectedColorId] = useState(initialColorId);
  const [previewData, setPreviewData] = useState<{
    stitches: Stitch[];
    width: number;
    height: number;
    highResCanvas?: HTMLCanvasElement;
    gridWidth: number;
    gridHeight: number;
  } | null>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fontSampleCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset to defaults
  const handleReset = () => {
    setFontSize(DEFAULT_FONT_SIZE);
    setFontSizeInput(String(DEFAULT_FONT_SIZE));
    setItalic(DEFAULT_ITALIC);
    setBoldness(DEFAULT_BOLDNESS);
    onWeightChange(400); // Reset to regular weight
  };

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

  // Generate preview when text or settings change
  const generatePreview = useCallback(() => {
    if (!text.trim()) {
      setPreviewData(null);
      return;
    }

    // Wait for font to load
    if (!fontLoaded) {
      setPreviewData(null);
      return;
    }

    // Use unified renderer for all fonts
    const preview = generateTextPreview({
      text,
      fontFamily: selectedFont,
      fontWeight: selectedWeight,
      italic,
      targetHeight: fontSize,
      colorId: effectiveColorId,
      boldness,
    });

    setPreviewData({
      stitches: preview.stitches,
      width: preview.gridWidth,
      height: preview.gridHeight,
      highResCanvas: preview.highResCanvas,
      gridWidth: preview.gridWidth,
      gridHeight: preview.gridHeight,
    });
  }, [text, selectedFont, fontSize, selectedWeight, italic, boldness, effectiveColorId, fontLoaded]);

  useEffect(() => {
    const debounce = setTimeout(generatePreview, 150);
    return () => clearTimeout(debounce);
  }, [generatePreview]);

  // Draw font sample canvas - shows high-res text (readable)
  useEffect(() => {
    const canvas = fontSampleCanvasRef.current;
    if (!canvas || !previewData?.highResCanvas) return;

    const ctx = canvas.getContext('2d')!;
    const { highResCanvas } = previewData;

    if (highResCanvas.width === 0 || highResCanvas.height === 0) return;

    // Fit within sample area
    const maxWidth = 540;
    const maxHeight = 80;
    const scale = Math.min(maxWidth / highResCanvas.width, maxHeight / highResCanvas.height, 1);

    canvas.width = Math.ceil(highResCanvas.width * scale);
    canvas.height = Math.ceil(highResCanvas.height * scale);

    // Clear with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw high-res text
    ctx.drawImage(highResCanvas, 0, 0, canvas.width, canvas.height);
  }, [previewData]);

  // Draw preview on canvas - shows stitch grid only (no high-res text)
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !previewData) return;

    const ctx = canvas.getContext('2d')!;
    const { gridWidth, gridHeight, stitches } = previewData;

    // Calculate display size - fit within preview area
    const maxDisplaySize = 280;
    const aspectRatio = gridWidth / gridHeight;
    let displayWidth: number, displayHeight: number;

    if (aspectRatio > 1) {
      displayWidth = Math.min(maxDisplaySize, gridWidth * 10);
      displayHeight = displayWidth / aspectRatio;
    } else {
      displayHeight = Math.min(maxDisplaySize, gridHeight * 10);
      displayWidth = displayHeight * aspectRatio;
    }

    canvas.width = Math.ceil(displayWidth);
    canvas.height = Math.ceil(displayHeight);

    // Clear with light gray background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    // Draw stitch grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= gridWidth; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellWidth, 0);
      ctx.lineTo(x * cellWidth, canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y <= gridHeight; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellHeight);
      ctx.lineTo(canvas.width, y * cellHeight);
      ctx.stroke();
    }

    // Draw filled stitch cells
    ctx.fillStyle = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
    for (const stitch of stitches) {
      ctx.fillRect(
        stitch.x * cellWidth,
        stitch.y * cellHeight,
        cellWidth,
        cellHeight
      );
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

      // Create metadata for re-rendering on resize
      const metadata = createTextLayerMetadata({
        text,
        fontFamily: selectedFont,
        fontWeight: selectedWeight,
        italic,
        targetHeight: fontSize,
        colorId: effectiveColorId,
        boldness,
      });

      onConfirm(previewData.stitches, previewData.width, previewData.height, colorToAdd, metadata);
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
  const isCustomFont = !!getCustomFont(selectedFont);

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
                  {isBundledFont && fontLoaded && <span className="text-xs text-green-600 ml-2">(available)</span>}
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

          {/* Size, Style, and Thickness - all on one row */}
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stitch Height
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={fontSizeInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d+$/.test(val)) {
                    setFontSizeInput(val);
                    const num = parseInt(val);
                    if (!isNaN(num) && num >= 1) {
                      setFontSize(num);
                    }
                  }
                }}
                onBlur={() => {
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
                className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
              />
            </div>

            {/* Hide Bold, Italic, Thickness for custom bitmap fonts */}
            {!isCustomFont && (
              <>
                <div className="flex items-center gap-1">
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

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thickness
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={boldness * 100}
                      onChange={(e) => setBoldness(parseInt(e.target.value) / 100)}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-xs text-gray-500 w-8">{Math.round(boldness * 100)}%</span>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={handleReset}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md border border-gray-300"
              title="Reset to defaults"
            >
              Reset
            </button>
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

          {/* Font Sample - shows readable high-res text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Font Sample
            </label>
            <div className="border border-gray-300 rounded-md p-3 bg-white h-[80px] flex items-center justify-center overflow-hidden">
              {previewData?.highResCanvas ? (
                <canvas
                  ref={fontSampleCanvasRef}
                  className="max-w-full max-h-full"
                />
              ) : (
                <p className="text-gray-400 text-sm">
                  {text.trim() ? 'Loading...' : 'Enter text to see font sample'}
                </p>
              )}
            </div>
          </div>

          {/* Stitch Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stitch Preview
            </label>
            <div className="border border-gray-300 rounded-md p-2 bg-gray-50 h-[180px] flex items-center justify-center overflow-hidden">
              {previewData && previewData.stitches.length > 0 ? (
                <div className="text-center h-full flex flex-col items-center justify-center">
                  <canvas
                    ref={previewCanvasRef}
                    className="border border-gray-200 mx-auto max-w-full max-h-[140px]"
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
