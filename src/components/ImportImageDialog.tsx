import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { usePatternStore, Color, Stitch } from '../stores/patternStore';
import { useConfigStore } from '../stores/configStore';
import { ColorMatchAlgorithm, findClosestColor } from '../utils/colorMatching';
import {
  ThreadBrand,
  getThreadLibraries,
  getThreadsByBrand,
  threadsToPalette,
} from '../data/threadLibrary';

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

// Response from the new Rust-side complete processing with thread matching
interface ProcessedImageWithThreads {
  width: number;
  height: number;
  colors: Array<{
    id: string;
    name: string;
    rgb: [number, number, number];
    thread_brand?: string;
    thread_code?: string;
  }>;
  pixels: string[][];
  preview_base64: string;
  thread_brand: string;
  algorithm: string;
}

type DitherMode = 'none' | 'floyd-steinberg' | 'ordered' | 'atkinson';
type DimensionUnit = 'stitches' | 'inches' | 'mm';

export function ImportImageDialog({ isOpen, onClose }: ImportImageDialogProps) {
  const { pattern, importPattern, importAsLayer } = usePatternStore();
  const { autoGeneratePreview, setAutoGeneratePreview } = useConfigStore();

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
  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>('stitches');
  const [maxColors, setMaxColors] = useState(16);
  const [ditherMode, setDitherMode] = useState<DitherMode>('floyd-steinberg');
  const [removeBackground, setRemoveBackground] = useState(false);
  const [backgroundThreshold, setBackgroundThreshold] = useState(20);
  const [meshCount, setMeshCount] = useState(18);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [matchToThreads, setMatchToThreads] = useState(true);
  const [selectedThreadBrand, setSelectedThreadBrand] = useState<ThreadBrand>('DMC');
  const [colorMatchAlgorithm, setColorMatchAlgorithm] = useState<ColorMatchAlgorithm>('ciede2000');

  // Unit conversion helpers
  const stitchesToUnit = useCallback((stitches: number, unit: DimensionUnit): number => {
    switch (unit) {
      case 'inches':
        return stitches / meshCount;
      case 'mm':
        return (stitches / meshCount) * 25.4;
      default:
        return stitches;
    }
  }, [meshCount]);

  const unitToStitches = useCallback((value: number, unit: DimensionUnit): number => {
    switch (unit) {
      case 'inches':
        return Math.round(value * meshCount);
      case 'mm':
        return Math.round((value / 25.4) * meshCount);
      default:
        return Math.round(value);
    }
  }, [meshCount]);

  // Local string state for dimension inputs (allows free typing)
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');

  // Format value for display based on unit
  const formatForDisplay = useCallback((stitches: number, unit: DimensionUnit): string => {
    if (unit === 'stitches') {
      return String(stitches);
    }
    const converted = stitchesToUnit(stitches, unit);
    // Show more precision for small values
    return converted < 10 ? converted.toFixed(2) : converted.toFixed(1);
  }, [stitchesToUnit]);

  // Sync input strings when stitches or unit changes externally
  useEffect(() => {
    setWidthInput(formatForDisplay(targetWidth, dimensionUnit));
  }, [targetWidth, dimensionUnit, formatForDisplay]);

  useEffect(() => {
    setHeightInput(formatForDisplay(targetHeight, dimensionUnit));
  }, [targetHeight, dimensionUnit, formatForDisplay]);

  // Commit width value (on blur or enter)
  const commitWidth = useCallback(() => {
    const value = parseFloat(widthInput);
    if (!isNaN(value) && value > 0) {
      const newStitches = unitToStitches(value, dimensionUnit);
      setTargetWidth(Math.max(1, newStitches));
    } else {
      // Reset to current value if invalid
      setWidthInput(formatForDisplay(targetWidth, dimensionUnit));
    }
  }, [widthInput, dimensionUnit, unitToStitches, targetWidth, formatForDisplay]);

  // Commit height value (on blur or enter)
  const commitHeight = useCallback(() => {
    const value = parseFloat(heightInput);
    if (!isNaN(value) && value > 0) {
      setMaintainAspectRatio(false);
      const newStitches = unitToStitches(value, dimensionUnit);
      setTargetHeight(Math.max(1, newStitches));
    } else {
      // Reset to current value if invalid
      setHeightInput(formatForDisplay(targetHeight, dimensionUnit));
    }
  }, [heightInput, dimensionUnit, unitToStitches, targetHeight, formatForDisplay]);

  // Handle unit change - keep the stitch values, just change display
  const handleUnitChange = (newUnit: DimensionUnit) => {
    setDimensionUnit(newUnit);
  };

  // Debounce timer for live preview
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag to abort preview generation when processing starts
  const abortPreviewRef = useRef(false);
  // Track settings used for current live preview
  const livePreviewSettingsRef = useRef<{
    width: number;
    height: number;
    maxColors: number;
    ditherMode: DitherMode;
    removeBackground: boolean;
    backgroundThreshold: number;
  } | null>(null);

  // Generate live preview with debouncing
  const generateLivePreview = useCallback(async () => {
    if (!imagePath || step !== 'configure') return;

    // Reset abort flag when starting new preview
    abortPreviewRef.current = false;
    setIsGeneratingPreview(true);

    // Capture current settings for this preview
    const currentSettings = {
      width: targetWidth,
      height: targetHeight,
      maxColors,
      ditherMode,
      removeBackground,
      backgroundThreshold,
    };

    try {
      // Use actual target dimensions for accurate preview (including dithering)
      const previewParams = {
        path: imagePath,
        targetWidth,
        targetHeight,
        maxColors,
        ditherMode,
        removeBackground,
        backgroundThreshold,
      };
      console.log('Preview with params:', previewParams);
      const result = await invoke<ProcessedImage>('process_image', previewParams);

      // Only set result if not aborted
      if (!abortPreviewRef.current) {
        setLivePreview(result);
        livePreviewSettingsRef.current = currentSettings;
      }
    } catch (err) {
      if (!abortPreviewRef.current) {
        console.error('Preview generation failed:', err);
      }
    } finally {
      if (!abortPreviewRef.current) {
        setIsGeneratingPreview(false);
      }
    }
  }, [imagePath, step, targetWidth, targetHeight, maxColors, ditherMode, removeBackground, backgroundThreshold]);

  // Debounced preview update when settings change
  useEffect(() => {
    if (step !== 'configure' || !imagePath) return;

    // Mark current preview as stale immediately when settings change
    livePreviewSettingsRef.current = null;

    // Clear existing timer
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    // Only auto-generate if enabled
    if (!autoGeneratePreview) return;

    // Set new timer for debounced preview
    previewTimerRef.current = setTimeout(() => {
      generateLivePreview();
    }, 300);

    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [generateLivePreview, step, imagePath, targetWidth, targetHeight, maxColors, ditherMode, removeBackground, backgroundThreshold, autoGeneratePreview]);

  // Check if current preview matches current settings
  const isPreviewStale = !livePreviewSettingsRef.current ||
    livePreviewSettingsRef.current.width !== targetWidth ||
    livePreviewSettingsRef.current.height !== targetHeight ||
    livePreviewSettingsRef.current.maxColors !== maxColors ||
    livePreviewSettingsRef.current.ditherMode !== ditherMode;

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
      setIsGeneratingPreview(false);
      setIsProcessing(false);
      abortPreviewRef.current = false;
      livePreviewSettingsRef.current = null;
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

  const handleProcessImage = () => {
    if (!imagePath || isProcessing) return;

    // Cancel any pending preview generation
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    // Abort any in-flight preview request
    abortPreviewRef.current = true;
    setIsGeneratingPreview(false);

    setIsProcessing(true);
    setError(null);

    // Defer processing to next frame so UI updates immediately
    requestAnimationFrame(() => {
      if (matchToThreads) {
        // Use new Rust-side complete processing with thread matching
        const params = {
          path: imagePath,
          targetWidth,
          targetHeight,
          maxColors,
          ditherMode,
          removeBackground,
          backgroundThreshold,
          threadBrand: selectedThreadBrand,
          colorMatchAlgorithm,
        };

        console.log('Processing with thread matching (Rust):', params);

        invoke<ProcessedImageWithThreads>('process_image_with_threads', params)
          .then((result) => {
            // Convert to ProcessedImage format for compatibility
            setProcessedImage({
              width: result.width,
              height: result.height,
              colors: result.colors.map(c => ({
                id: c.id,
                name: c.name,
                rgb: c.rgb,
                // Store thread info for later use
                threadBrand: c.thread_brand,
                threadCode: c.thread_code,
              })) as ProcessedImage['colors'],
              pixels: result.pixels,
              preview_base64: result.preview_base64,
            });
            setStep('preview');
          })
          .catch((err) => {
            setError(`Failed to process image: ${err}`);
          })
          .finally(() => {
            setIsProcessing(false);
          });
      } else {
        // Use original Rust processing without thread matching
        const params = {
          path: imagePath,
          targetWidth,
          targetHeight,
          maxColors,
          ditherMode,
          removeBackground,
          backgroundThreshold,
        };

        console.log('Processing without thread matching:', params);

        invoke<ProcessedImage>('process_image', params)
          .then((result) => {
            setProcessedImage(result);
            setStep('preview');
          })
          .catch((err) => {
            setError(`Failed to process image: ${err}`);
          })
          .finally(() => {
            setIsProcessing(false);
          });
      }
    });
  };

  const handleImport = () => {
    if (!processedImage) {
      console.error('handleImport called but processedImage is null');
      return;
    }

    console.log('Importing pattern:', {
      width: processedImage.width,
      height: processedImage.height,
      pixelRows: processedImage.pixels?.length,
      firstRowLength: processedImage.pixels?.[0]?.length,
      colors: processedImage.colors?.length,
      samplePixels: processedImage.pixels?.[0]?.slice(0, 5),
      sampleColorIds: processedImage.colors?.slice(0, 3).map(c => c.id),
    });

    // Check if colors already have thread info (from Rust-side processing)
    const hasThreadInfo = processedImage.colors.some(c =>
      (c as { threadBrand?: string }).threadBrand || (c as { threadCode?: string }).threadCode
    );

    let colors: Color[];
    let finalColorIdMap: Map<string, string>;

    if (hasThreadInfo) {
      // Colors already have thread info from Rust processing - use directly
      console.log('Using Rust-side thread matching results');
      colors = processedImage.colors.map(c => ({
        id: c.id,
        name: c.name,
        rgb: c.rgb,
        threadBrand: (c as { threadBrand?: string }).threadBrand,
        threadCode: (c as { threadCode?: string }).threadCode,
      }));
      finalColorIdMap = new Map(colors.map(c => [c.id, c.id]));
    } else if (matchToThreads) {
      // Need to do JavaScript-side thread matching (fallback for old process_image command)
      console.log('Using JavaScript-side thread matching');
      const colorIdMap = new Map<string, string>();
      const threadLibrary = getThreadsByBrand(selectedThreadBrand);
      const threadPalette = threadsToPalette(threadLibrary);

      colors = processedImage.colors.map(c => {
        const match = findClosestColor(c.rgb, threadPalette, colorMatchAlgorithm);
        if (match) {
          const matchedThread = threadLibrary.find(t => `${t.brand}-${t.code}` === match.colorId);

          if (matchedThread) {
            const newId = `${matchedThread.brand.toLowerCase()}-${matchedThread.code}-${c.id}`;
            colorIdMap.set(c.id, newId);
            return {
              id: newId,
              name: matchedThread.name,
              rgb: matchedThread.rgb,
              threadBrand: matchedThread.brand,
              threadCode: matchedThread.code,
            };
          }
        }

        // Fallback: use original color
        colorIdMap.set(c.id, c.id);
        return {
          id: c.id,
          name: c.name,
          rgb: c.rgb,
        };
      });

      // Deduplicate colors (same thread code might be matched multiple times)
      const uniqueColors: Color[] = [];
      const seenCodes = new Set<string>();
      finalColorIdMap = new Map<string, string>();

      for (const [oldId, newId] of colorIdMap.entries()) {
        const color = colors.find(c => c.id === newId);
        if (color) {
          const key = color.threadCode || color.id;
          if (!seenCodes.has(key)) {
            seenCodes.add(key);
            uniqueColors.push(color);
          }
          const existingColor = uniqueColors.find(c => (c.threadCode || c.id) === key);
          if (existingColor) {
            finalColorIdMap.set(oldId, existingColor.id);
          }
        }
      }
      colors = uniqueColors;
    } else {
      // No thread matching - use original colors
      console.log('No thread matching');
      colors = processedImage.colors.map(c => ({
        id: c.id,
        name: c.name,
        rgb: c.rgb,
      }));
      finalColorIdMap = new Map(colors.map(c => [c.id, c.id]));
    }

    console.log('Color mapping:', {
      hasThreadInfo,
      finalColorIdMapSize: finalColorIdMap.size,
      mapEntries: Array.from(finalColorIdMap.entries()).slice(0, 5),
    });

    // Convert pixel data to stitches with remapped color IDs
    const stitches: Stitch[] = [];
    let emptyPixels = 0;
    let mappedPixels = 0;
    let unmappedPixels = 0;
    for (let y = 0; y < processedImage.pixels.length; y++) {
      for (let x = 0; x < processedImage.pixels[y].length; x++) {
        const oldColorId = processedImage.pixels[y][x];
        if (oldColorId) {
          const newColorId = finalColorIdMap.get(oldColorId) || oldColorId;
          if (finalColorIdMap.has(oldColorId)) {
            mappedPixels++;
          } else {
            unmappedPixels++;
          }
          stitches.push({ x, y, colorId: newColorId, completed: false });
        } else {
          emptyPixels++;
        }
      }
    }

    console.log('Stitch creation:', {
      stitches: stitches.length,
      colors: colors.length,
      emptyPixels,
      mappedPixels,
      unmappedPixels,
    });

    // Import based on mode
    if (importMode === 'add-layer' && pattern) {
      // Import as a new layer in the existing pattern
      importAsLayer(patternName, colors, stitches);
    } else {
      // Create new pattern (or replace existing)
      importPattern(patternName, processedImage.width, processedImage.height, meshCount, colors, stitches);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Convert to Pattern</h2>
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
              <div className="flex flex-col">
                {/* Live Preview */}
                <div className="flex flex-col">
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
                        <span className="text-gray-400 text-sm">
                          {isGeneratingPreview
                            ? 'Generating preview...'
                            : autoGeneratePreview
                              ? 'Preview will generate automatically'
                              : 'Click "Generate Preview" below'}
                        </span>
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

                {/* Auto-generate Preview Control */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoGeneratePreview}
                      onChange={(e) => setAutoGeneratePreview(e.target.checked)}
                      className="rounded"
                    />
                    Auto-generate preview
                  </label>
                  {!autoGeneratePreview && (
                    <button
                      onClick={generateLivePreview}
                      disabled={isGeneratingPreview}
                      className={`mt-2 w-full px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 ${
                        isPreviewStale && !isGeneratingPreview
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {isGeneratingPreview ? 'Generating...' : 'Generate Preview'}
                    </button>
                  )}
                </div>
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

                {/* Unit Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dimension Unit
                  </label>
                  <div className="flex gap-1">
                    {(['stitches', 'inches', 'mm'] as DimensionUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => handleUnitChange(unit)}
                        className={`flex-1 py-1.5 px-2 text-sm rounded border transition-colors ${
                          dimensionUnit === unit
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {unit === 'stitches' ? 'Stitches' : unit === 'inches' ? 'Inches' : 'mm'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Width {dimensionUnit !== 'stitches' && <span className="text-gray-400 font-normal">({targetWidth} st)</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={widthInput}
                      onChange={(e) => setWidthInput(e.target.value)}
                      onBlur={commitWidth}
                      onKeyDown={(e) => e.key === 'Enter' && commitWidth()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height {dimensionUnit !== 'stitches' && <span className="text-gray-400 font-normal">({targetHeight} st)</span>}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={heightInput}
                      onChange={(e) => setHeightInput(e.target.value)}
                      onBlur={commitHeight}
                      onKeyDown={(e) => e.key === 'Enter' && commitHeight()}
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
                      checked={matchToThreads}
                      onChange={(e) => setMatchToThreads(e.target.checked)}
                      className="rounded"
                    />
                    Match colors to thread library
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-5">
                    Convert colors to nearest thread colors
                  </p>
                  {matchToThreads && (
                    <div className="mt-2 ml-5 space-y-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Thread Library
                        </label>
                        <select
                          value={selectedThreadBrand}
                          onChange={(e) => setSelectedThreadBrand(e.target.value as ThreadBrand)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {getThreadLibraries().map(lib => (
                            <option key={lib.brand} value={lib.brand}>
                              {lib.name} ({lib.colorCount} colors)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Color Matching Algorithm
                        </label>
                        <select
                          value={colorMatchAlgorithm}
                          onChange={(e) => setColorMatchAlgorithm(e.target.value as ColorMatchAlgorithm)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="ciede2000">CIEDE2000 (Most Accurate)</option>
                          <option value="cie94">CIE94 (Textile optimized)</option>
                          <option value="cie76">CIE76 (Standard)</option>
                          <option value="weighted">Weighted RGB</option>
                          <option value="euclidean">Simple RGB</option>
                        </select>
                      </div>
                    </div>
                  )}
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

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-semibold text-blue-800">
                    Pattern: {targetWidth} x {targetHeight} stitches
                  </p>
                  <p className="text-blue-700">
                    Physical size: {(targetWidth / meshCount).toFixed(1)}" x {(targetHeight / meshCount).toFixed(1)}" ({(targetWidth / meshCount * 25.4).toFixed(0)} x {(targetHeight / meshCount * 25.4).toFixed(0)} mm)
                  </p>
                  <p className="text-blue-600 text-xs mt-1">
                    Total: {(targetWidth * targetHeight).toLocaleString()} stitches
                    {imageInfo && ` (original image: ${imageInfo.width} x ${imageInfo.height} px)`}
                  </p>
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
                disabled={isProcessing || isGeneratingPreview}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : isGeneratingPreview ? 'Preview updating...' : 'Process Image'}
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
