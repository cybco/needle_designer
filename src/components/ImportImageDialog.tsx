import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { usePatternStore, Color, Stitch } from '../stores/patternStore';
import { findClosestDMC } from '../data/dmcThreads';

interface ImportImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImageInfo {
  width: number;
  height: number;
  preview_base64: string;
}

interface ProcessedImage {
  width: number;
  height: number;
  colors: Array<{
    id: string;
    name: string;
    rgb: [number, number, number];
  }>;
  pixels: string[][];
  preview_base64: string;
}

type DitherMode = 'none' | 'floyd-steinberg' | 'ordered' | 'atkinson';

export function ImportImageDialog({ isOpen, onClose }: ImportImageDialogProps) {
  const { pattern, importPattern, importAsLayer } = usePatternStore();

  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [importMode, setImportMode] = useState<'new-pattern' | 'add-layer'>('add-layer');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [livePreview, setLivePreview] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration options
  const [patternName, setPatternName] = useState('Imported Pattern');
  const [targetWidth, setTargetWidth] = useState(100);
  const [targetHeight, setTargetHeight] = useState(100);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [maxColors, setMaxColors] = useState(16);
  const [ditherMode, setDitherMode] = useState<DitherMode>('floyd-steinberg');
  const [removeBackground, setRemoveBackground] = useState(false);
  const [backgroundThreshold, setBackgroundThreshold] = useState(20);
  const [meshCount, setMeshCount] = useState(18);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [matchToDMC, setMatchToDMC] = useState(true);

  // Debounce timer for live preview
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate live preview with debouncing
  const generateLivePreview = useCallback(async () => {
    if (!imagePath || step !== 'configure') return;

    setIsGeneratingPreview(true);
    try {
      // Use reasonable preview size - larger for better quality
      const maxPreviewSize = 200;
      const previewScale = Math.min(1, maxPreviewSize / Math.max(targetWidth, targetHeight));
      const previewWidth = Math.max(20, Math.round(targetWidth * previewScale));
      const previewHeight = Math.max(20, Math.round(targetHeight * previewScale));

      const result = await invoke<ProcessedImage>('process_image', {
        path: imagePath,
        targetWidth: previewWidth,
        targetHeight: previewHeight,
        maxColors,
        ditherMode,
        removeBackground,
        backgroundThreshold,
      });

      setLivePreview(result);
    } catch (err) {
      console.error('Preview generation failed:', err);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [imagePath, step, targetWidth, targetHeight, maxColors, ditherMode, removeBackground, backgroundThreshold]);

  // Debounced preview update when settings change
  useEffect(() => {
    if (step !== 'configure' || !imagePath) return;

    // Clear existing timer
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    // Set new timer for debounced preview
    previewTimerRef.current = setTimeout(() => {
      generateLivePreview();
    }, 300);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [generateLivePreview, step, imagePath, targetWidth, targetHeight, maxColors, ditherMode, removeBackground, backgroundThreshold]);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setImagePath(null);
      setImageInfo(null);
      setProcessedImage(null);
      setLivePreview(null);
      setError(null);
      setPreviewZoom(1);
    }
  }, [isOpen]);

  // Update height when width changes (maintain aspect ratio)
  useEffect(() => {
    if (maintainAspectRatio && imageInfo) {
      const aspectRatio = imageInfo.height / imageInfo.width;
      setTargetHeight(Math.round(targetWidth * aspectRatio));
    }
  }, [targetWidth, maintainAspectRatio, imageInfo]);

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'svg']
        }]
      });

      if (selected && typeof selected === 'string') {
        setImagePath(selected);
        setIsProcessing(true);
        setError(null);

        const info = await invoke<ImageInfo>('load_image', { path: selected });
        setImageInfo(info);

        // Set initial target size (max 200 stitches on longest side)
        const maxStitches = 200;
        if (info.width >= info.height) {
          setTargetWidth(Math.min(info.width, maxStitches));
          setTargetHeight(Math.round(Math.min(info.width, maxStitches) * (info.height / info.width)));
        } else {
          setTargetHeight(Math.min(info.height, maxStitches));
          setTargetWidth(Math.round(Math.min(info.height, maxStitches) * (info.width / info.height)));
        }

        // Extract filename for pattern name
        const filename = selected.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'Imported Pattern';
        setPatternName(filename);

        setStep('configure');
        setIsProcessing(false);
      }
    } catch (err) {
      setError(`Failed to load image: ${err}`);
      setIsProcessing(false);
    }
  };

  const handleProcessImage = async () => {
    if (!imagePath) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await invoke<ProcessedImage>('process_image', {
        path: imagePath,
        targetWidth,
        targetHeight,
        maxColors,
        ditherMode,
        removeBackground,
        backgroundThreshold,
      });

      setProcessedImage(result);
      setStep('preview');
    } catch (err) {
      setError(`Failed to process image: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (!processedImage) return;

    // Map to track old color ID -> new color ID
    const colorIdMap = new Map<string, string>();

    // Convert processed image colors to Color type, optionally matching to DMC
    const colors: Color[] = processedImage.colors.map(c => {
      if (matchToDMC) {
        const dmcThread = findClosestDMC(c.rgb[0], c.rgb[1], c.rgb[2]);
        const newId = `dmc-${dmcThread.code}-${c.id}`;
        colorIdMap.set(c.id, newId);
        return {
          id: newId,
          name: dmcThread.name,
          rgb: dmcThread.rgb,
          threadBrand: 'DMC',
          threadCode: dmcThread.code,
        };
      } else {
        colorIdMap.set(c.id, c.id);
        return {
          id: c.id,
          name: c.name,
          rgb: c.rgb,
        };
      }
    });

    // Deduplicate colors (same DMC code might be matched multiple times)
    const uniqueColors: Color[] = [];
    const seenCodes = new Set<string>();
    const finalColorIdMap = new Map<string, string>();

    for (const [oldId, newId] of colorIdMap.entries()) {
      const color = colors.find(c => c.id === newId);
      if (color) {
        const key = color.threadCode || color.id;
        if (!seenCodes.has(key)) {
          seenCodes.add(key);
          uniqueColors.push(color);
        }
        // Map to the first occurrence of this color
        const existingColor = uniqueColors.find(c => (c.threadCode || c.id) === key);
        if (existingColor) {
          finalColorIdMap.set(oldId, existingColor.id);
        }
      }
    }

    // Convert pixel data to stitches with remapped color IDs
    const stitches: Stitch[] = [];
    for (let y = 0; y < processedImage.pixels.length; y++) {
      for (let x = 0; x < processedImage.pixels[y].length; x++) {
        const oldColorId = processedImage.pixels[y][x];
        if (oldColorId) {
          const newColorId = finalColorIdMap.get(oldColorId) || oldColorId;
          stitches.push({ x, y, colorId: newColorId, completed: false });
        }
      }
    }

    // Import based on mode
    if (importMode === 'add-layer' && pattern) {
      // Import as a new layer in the existing pattern
      importAsLayer(patternName, uniqueColors, stitches);
    } else {
      // Create new pattern (or replace existing)
      importPattern(patternName, processedImage.width, processedImage.height, meshCount, uniqueColors, stitches);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Import Image</h2>
          <div className="flex gap-2 mt-2">
            {['select', 'configure', 'preview'].map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-2 text-sm ${
                  step === s ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step === s ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>
                  {i + 1}
                </span>
                <span className="capitalize">{s}</span>
                {i < 2 && <span className="text-gray-300 ml-2">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Select Image */}
          {step === 'select' && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-6xl mb-4">🖼️</div>
              <p className="text-gray-600 mb-4">Select an image to convert to a needlepoint pattern</p>
              <button
                onClick={handleSelectImage}
                disabled={isProcessing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Loading...' : 'Choose Image'}
              </button>
              <p className="text-sm text-gray-400 mt-4">
                Supported: PNG, JPG, BMP, GIF, WebP, SVG
              </p>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && imageInfo && (
            <div className="grid grid-cols-2 gap-6">
              {/* Preview Area */}
              <div className="flex flex-col h-full">
                {/* Live Preview */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-700 flex items-center gap-2">
                      Preview
                      {isGeneratingPreview && (
                        <span className="text-xs text-blue-500 animate-pulse">updating...</span>
                      )}
                    </h3>
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.5))}
                        className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold"
                        title="Zoom out"
                      >
                        -
                      </button>
                      <span className="text-xs text-gray-500 w-12 text-center">{Math.round(previewZoom * 100)}%</span>
                      <button
                        onClick={() => setPreviewZoom(z => Math.min(4, z + 0.5))}
                        className="w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-sm font-bold"
                        title="Zoom in"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setPreviewZoom(1)}
                        className="px-2 h-7 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded text-xs"
                        title="Reset zoom"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div
                    className="border border-gray-200 rounded-lg"
                    style={{
                      height: '280px',
                      background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 16px 16px',
                      overflow: 'auto',
                    }}
                  >
                    {livePreview ? (
                      <div
                        style={{
                          width: `${livePreview.width * previewZoom + 32}px`,
                          height: `${livePreview.height * previewZoom + 32}px`,
                          padding: '16px',
                        }}
                      >
                        <img
                          src={livePreview.preview_base64}
                          alt="Preview"
                          style={{
                            imageRendering: 'pixelated',
                            display: 'block',
                            transform: `scale(${previewZoom})`,
                            transformOrigin: 'top left',
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-400 text-sm">Generating preview...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extracted Colors Preview */}
                {livePreview && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h3 className="font-medium text-gray-700 mb-2">
                      Colors ({livePreview.colors.length})
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {livePreview.colors.slice(0, 32).map((color) => (
                        <div
                          key={color.id}
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{
                            backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                          }}
                          title={color.name}
                        />
                      ))}
                      {livePreview.colors.length > 32 && (
                        <span className="text-xs text-gray-400 self-center ml-1">
                          +{livePreview.colors.length - 32} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern Name
                  </label>
                  <input
                    type="text"
                    value={patternName}
                    onChange={(e) => setPatternName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Width (stitches)
                    </label>
                    <input
                      type="number"
                      value={targetWidth}
                      onChange={(e) => setTargetWidth(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height (stitches)
                    </label>
                    <input
                      type="number"
                      value={targetHeight}
                      onChange={(e) => {
                        setMaintainAspectRatio(false);
                        setTargetHeight(Math.max(1, parseInt(e.target.value) || 1));
                      }}
                      min={1}
                      max={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={maintainAspectRatio}
                    onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                    className="rounded"
                  />
                  Maintain aspect ratio
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Colors: {maxColors}
                  </label>
                  <input
                    type="range"
                    value={maxColors}
                    onChange={(e) => setMaxColors(parseInt(e.target.value))}
                    min={2}
                    max={64}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>2</span>
                    <span>64</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dithering
                  </label>
                  <select
                    value={ditherMode}
                    onChange={(e) => setDitherMode(e.target.value as DitherMode)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="floyd-steinberg">Floyd-Steinberg (smooth)</option>
                    <option value="ordered">Ordered (pattern)</option>
                    <option value="atkinson">Atkinson (light)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mesh Count
                  </label>
                  <select
                    value={meshCount}
                    onChange={(e) => setMeshCount(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={14}>14 count</option>
                    <option value={18}>18 count (standard)</option>
                    <option value={22}>22 count</option>
                  </select>
                </div>

                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={matchToDMC}
                      onChange={(e) => setMatchToDMC(e.target.checked)}
                      className="rounded"
                    />
                    Match colors to DMC threads
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-5">
                    Convert colors to nearest DMC floss colors
                  </p>
                </div>

                {/* Import Mode - only show when pattern exists */}
                {pattern && (
                  <div className="border-t pt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Import Mode
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('add-layer')}
                        className={`flex-1 py-2 px-3 text-sm rounded border ${
                          importMode === 'add-layer'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        Add as Layer
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode('new-pattern')}
                        className={`flex-1 py-2 px-3 text-sm rounded border ${
                          importMode === 'new-pattern'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        New Pattern
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {importMode === 'add-layer'
                        ? 'Add imported image as a new layer in the current pattern'
                        : 'Replace current pattern with the imported image'}
                    </p>
                  </div>
                )}

                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={removeBackground}
                      onChange={(e) => setRemoveBackground(e.target.checked)}
                      className="rounded"
                    />
                    Remove white background
                  </label>
                  {removeBackground && (
                    <div className="mt-2">
                      <label className="block text-xs text-gray-500 mb-1">
                        Threshold: {backgroundThreshold}
                      </label>
                      <input
                        type="range"
                        value={backgroundThreshold}
                        onChange={(e) => setBackgroundThreshold(parseInt(e.target.value))}
                        min={0}
                        max={50}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
                  <p><strong>Canvas size:</strong> {(targetWidth / meshCount).toFixed(1)}" x {(targetHeight / meshCount).toFixed(1)}"</p>
                  <p><strong>Total stitches:</strong> {(targetWidth * targetHeight).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && processedImage && (
            <div className="grid grid-cols-2 gap-6">
              {/* Processed Preview */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Processed Pattern</h3>
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <img
                    src={processedImage.preview_base64}
                    alt="Processed"
                    className="max-w-full max-h-80 mx-auto"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {processedImage.width} x {processedImage.height} stitches
                </p>
              </div>

              {/* Color Palette */}
              <div>
                <h3 className="font-medium text-gray-700 mb-2">
                  Extracted Colors ({processedImage.colors.length})
                </h3>
                <div className="border border-gray-200 rounded-lg p-3 max-h-80 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2">
                    {processedImage.colors.map((color) => (
                      <div
                        key={color.id}
                        className="flex flex-col items-center"
                      >
                        <div
                          className="w-10 h-10 rounded border border-gray-300"
                          style={{
                            backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                          }}
                        />
                        <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                          {color.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <p><strong>Pattern:</strong> {patternName}</p>
                  <p><strong>Size:</strong> {processedImage.width} x {processedImage.height} stitches</p>
                  <p><strong>Colors:</strong> {processedImage.colors.length}</p>
                  <p><strong>Canvas:</strong> {(processedImage.width / meshCount).toFixed(1)}" x {(processedImage.height / meshCount).toFixed(1)}"</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <div>
            {step !== 'select' && (
              <button
                onClick={() => setStep(step === 'preview' ? 'configure' : 'select')}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            {step === 'configure' && (
              <button
                onClick={handleProcessImage}
                disabled={isProcessing}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Process Image'}
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                Import Pattern
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
