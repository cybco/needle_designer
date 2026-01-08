import { useState, useEffect } from 'react';
import { usePatternStore, detectClippedContent, AnchorPosition } from '../stores/patternStore';
import { CanvasClipWarningDialog } from './CanvasClipWarningDialog';

interface CanvasLayoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Unit = 'inches' | 'mm';
type InputMode = 'physical' | 'stitches';

const MM_PER_INCH = 25.4;

export function CanvasLayoutDialog({ isOpen, onClose }: CanvasLayoutDialogProps) {
  const { pattern, resizeCanvas } = usePatternStore();

  const [meshCount, setMeshCount] = useState(18);
  const [unit, setUnit] = useState<Unit>('inches');

  // Physical dimensions (stored in inches internally)
  const [physicalWidth, setPhysicalWidth] = useState(12);
  const [physicalHeight, setPhysicalHeight] = useState(12);

  // Stitch dimensions
  const [stitchWidth, setStitchWidth] = useState(216);
  const [stitchHeight, setStitchHeight] = useState(216);

  // Track which input was last changed to avoid circular updates
  const [lastInputMode, setLastInputMode] = useState<InputMode>('stitches');

  // Anchor position for resize
  const [anchor, setAnchor] = useState<AnchorPosition>('top-left');

  // Warning dialog state
  const [showWarning, setShowWarning] = useState(false);
  const [clipInfo, setClipInfo] = useState<{ stitchesClipped: number; layersAffected: string[] }>({ stitchesClipped: 0, layersAffected: [] });

  // Initialize values from current pattern when dialog opens
  useEffect(() => {
    if (isOpen && pattern) {
      setMeshCount(pattern.canvas.meshCount);
      setStitchWidth(pattern.canvas.width);
      setStitchHeight(pattern.canvas.height);
      setPhysicalWidth(pattern.canvas.width / pattern.canvas.meshCount);
      setPhysicalHeight(pattern.canvas.height / pattern.canvas.meshCount);
      setLastInputMode('stitches');
      setAnchor('top-left');
    }
  }, [isOpen, pattern]);

  // Convert between units for display
  const toDisplayUnit = (inches: number): number => {
    return unit === 'mm' ? inches * MM_PER_INCH : inches;
  };

  const fromDisplayUnit = (value: number): number => {
    return unit === 'mm' ? value / MM_PER_INCH : value;
  };

  // Update stitches when physical size or mesh count changes
  useEffect(() => {
    if (lastInputMode === 'physical') {
      setStitchWidth(Math.round(physicalWidth * meshCount));
      setStitchHeight(Math.round(physicalHeight * meshCount));
    }
  }, [physicalWidth, physicalHeight, meshCount, lastInputMode]);

  // Update physical size when stitches change
  useEffect(() => {
    if (lastInputMode === 'stitches') {
      setPhysicalWidth(stitchWidth / meshCount);
      setPhysicalHeight(stitchHeight / meshCount);
    }
  }, [stitchWidth, stitchHeight, meshCount, lastInputMode]);

  // When mesh count changes, recalculate based on last input mode
  const handleMeshCountChange = (newMeshCount: number) => {
    setMeshCount(newMeshCount);
    if (lastInputMode === 'physical') {
      // Keep physical size, update stitch count
      setStitchWidth(Math.round(physicalWidth * newMeshCount));
      setStitchHeight(Math.round(physicalHeight * newMeshCount));
    } else {
      // Keep stitch count, update physical size
      setPhysicalWidth(stitchWidth / newMeshCount);
      setPhysicalHeight(stitchHeight / newMeshCount);
    }
  };

  const handlePhysicalWidthChange = (displayValue: number) => {
    const inchValue = fromDisplayUnit(displayValue);
    setPhysicalWidth(inchValue);
    setLastInputMode('physical');
  };

  const handlePhysicalHeightChange = (displayValue: number) => {
    const inchValue = fromDisplayUnit(displayValue);
    setPhysicalHeight(inchValue);
    setLastInputMode('physical');
  };

  const handleStitchWidthChange = (value: number) => {
    setStitchWidth(Math.max(1, value));
    setLastInputMode('stitches');
  };

  const handleStitchHeightChange = (value: number) => {
    setStitchHeight(Math.max(1, value));
    setLastInputMode('stitches');
  };

  if (!isOpen || !pattern) return null;

  const handleApply = () => {
    // Check if dimensions changed (mesh count only change doesn't need transform)
    const dimensionsChanged = stitchWidth !== pattern.canvas.width || stitchHeight !== pattern.canvas.height;

    if (dimensionsChanged) {
      // Check for clipped content
      const clipResult = detectClippedContent(
        pattern.layers,
        pattern.canvas.width,
        pattern.canvas.height,
        stitchWidth,
        stitchHeight,
        anchor
      );

      if (clipResult.stitchesClipped > 0) {
        setClipInfo(clipResult);
        setShowWarning(true);
        return;
      }
    }

    // Apply resize
    applyResize();
  };

  const applyResize = () => {
    resizeCanvas(stitchWidth, stitchHeight, meshCount, anchor);
    setShowWarning(false);
    onClose();
  };

  const displayWidth = toDisplayUnit(physicalWidth);
  const displayHeight = toDisplayUnit(physicalHeight);
  const unitLabel = unit === 'mm' ? 'mm' : '"';

  // Check if values have changed from current pattern
  const hasChanges =
    stitchWidth !== pattern.canvas.width ||
    stitchHeight !== pattern.canvas.height ||
    meshCount !== pattern.canvas.meshCount;

  const anchorPositions: AnchorPosition[] = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right',
  ];

  const anchorLabels: Record<AnchorPosition, string> = {
    'top-left': 'TL', 'top': 'T', 'top-right': 'TR',
    'left': 'L', 'center': 'C', 'right': 'R',
    'bottom-left': 'BL', 'bottom': 'B', 'bottom-right': 'BR',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-[480px] p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Canvas Layout</h2>

          <div className="space-y-4">
            {/* Mesh Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mesh Count (holes per inch)
              </label>
              <select
                value={meshCount}
                onChange={(e) => handleMeshCountChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>7 count (large)</option>
                <option value={10}>10 count</option>
                <option value={12}>12 count</option>
                <option value={13}>13 count</option>
                <option value={14}>14 count</option>
                <option value={16}>16 count</option>
                <option value={18}>18 count (standard)</option>
                <option value={22}>22 count</option>
                <option value={24}>24 count (fine)</option>
              </select>
            </div>

            {/* Unit Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setUnit('inches')}
                  className={`flex-1 py-2 px-4 rounded-md border transition-colors ${
                    unit === 'inches'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Inches
                </button>
                <button
                  onClick={() => setUnit('mm')}
                  className={`flex-1 py-2 px-4 rounded-md border transition-colors ${
                    unit === 'mm'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Millimeters
                </button>
              </div>
            </div>

            {/* Physical Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Canvas Size ({unit === 'mm' ? 'mm' : 'inches'})
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={parseFloat(displayWidth.toFixed(2))}
                      onChange={(e) => handlePhysicalWidthChange(parseFloat(e.target.value) || 0)}
                      min={0.1}
                      step={unit === 'mm' ? 10 : 0.5}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {unitLabel}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={parseFloat(displayHeight.toFixed(2))}
                      onChange={(e) => handlePhysicalHeightChange(parseFloat(e.target.value) || 0)}
                      min={0.1}
                      step={unit === 'mm' ? 10 : 0.5}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      {unitLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stitch Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stitch Count
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width (stitches)</label>
                  <input
                    type="number"
                    value={stitchWidth}
                    onChange={(e) => handleStitchWidthChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height (stitches)</label>
                  <input
                    type="number"
                    value={stitchHeight}
                    onChange={(e) => handleStitchHeightChange(parseInt(e.target.value) || 1)}
                    min={1}
                    max={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Anchor Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anchor Position
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Content stays anchored to this position when resizing
              </p>
              <div className="inline-grid grid-cols-3 gap-1 bg-gray-100 p-2 rounded-lg">
                {anchorPositions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setAnchor(pos)}
                    className={`w-10 h-10 rounded text-xs font-medium transition-colors ${
                      anchor === pos
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                    }`}
                    title={pos}
                  >
                    {anchorLabels[pos]}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Current size:</span>
                <span className="font-medium">{pattern.canvas.width} x {pattern.canvas.height} stitches</span>
              </div>
              <div className="flex justify-between">
                <span>New size:</span>
                <span className={`font-medium ${hasChanges ? 'text-blue-600' : ''}`}>
                  {stitchWidth} x {stitchHeight} stitches
                </span>
              </div>
              <div className="flex justify-between">
                <span>Canvas size:</span>
                <span className="font-medium">
                  {physicalWidth.toFixed(2)}" x {physicalHeight.toFixed(2)}"
                  {unit === 'mm' && (
                    <span className="text-gray-400 ml-1">
                      ({(physicalWidth * MM_PER_INCH).toFixed(0)} x {(physicalHeight * MM_PER_INCH).toFixed(0)} mm)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mesh count:</span>
                <span className="font-medium">{meshCount} per inch</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges}
              className={`px-4 py-2 text-white rounded-md transition-colors ${
                hasChanges
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {showWarning && (
        <CanvasClipWarningDialog
          clipInfo={clipInfo}
          onConfirm={applyResize}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </>
  );
}
