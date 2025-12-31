import { useMemo, useState } from 'react';
import { usePatternStore } from '../stores/patternStore';

interface ColorProgress {
  colorId: string;
  colorName: string;
  rgb: [number, number, number];
  totalStitches: number;
  completedStitches: number;
  percentage: number;
}

export function ProgressTrackingPanel() {
  const {
    pattern,
    toggleProgressMode,
    progressShadingColor: storeShadingColor,
    progressShadingOpacity: storeShadingOpacity,
    setProgressShadingColor,
    setProgressShadingOpacity,
    activeTool,
    setTool,
  } = usePatternStore();

  // Ensure shading values have defaults
  const progressShadingColor = storeShadingColor ?? [128, 128, 128] as [number, number, number];
  const progressShadingOpacity = storeShadingOpacity ?? 70;

  const isPanning = activeTool === 'pan';

  const togglePan = () => {
    setTool(isPanning ? 'pencil' : 'pan');
  };

  const [showColorPicker, setShowColorPicker] = useState(false);

  // Convert RGB to hex for color input
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [128, 128, 128];
  };

  // Preset colors for quick selection
  const presetColors: [number, number, number][] = [
    [128, 128, 128], // Grey
    [200, 200, 200], // Light grey
    [80, 80, 80],    // Dark grey
    [100, 149, 237], // Cornflower blue
    [144, 238, 144], // Light green
    [255, 182, 193], // Light pink
  ];

  const progressData = useMemo(() => {
    if (!pattern) return null;

    // Collect all stitches from all visible layers
    const allStitches = pattern.layers
      .filter(layer => layer.visible)
      .flatMap(layer => layer.stitches);

    const totalStitches = allStitches.length;
    const completedStitches = allStitches.filter(s => s.completed).length;
    const overallPercentage = totalStitches > 0 ? (completedStitches / totalStitches) * 100 : 0;

    // Calculate progress by color
    const colorMap = new Map<string, { total: number; completed: number }>();

    for (const stitch of allStitches) {
      const existing = colorMap.get(stitch.colorId) || { total: 0, completed: 0 };
      existing.total++;
      if (stitch.completed) {
        existing.completed++;
      }
      colorMap.set(stitch.colorId, existing);
    }

    // Build color progress array with color info
    const colorProgress: ColorProgress[] = [];
    for (const color of pattern.colorPalette) {
      const progress = colorMap.get(color.id);
      if (progress && progress.total > 0) {
        colorProgress.push({
          colorId: color.id,
          colorName: color.name,
          rgb: color.rgb,
          totalStitches: progress.total,
          completedStitches: progress.completed,
          percentage: (progress.completed / progress.total) * 100,
        });
      }
    }

    // Sort by most stitches first
    colorProgress.sort((a, b) => b.totalStitches - a.totalStitches);

    return {
      totalStitches,
      completedStitches,
      overallPercentage,
      colorProgress,
    };
  }, [pattern]);

  if (!pattern || !progressData) {
    return (
      <div className="w-64 bg-white border-l border-gray-300 p-4">
        <p className="text-gray-500">No pattern loaded</p>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-l border-gray-300 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-green-50">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-green-800">Progress Tracking</h2>
          <button
            onClick={toggleProgressMode}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Exit
          </button>
        </div>
        <p className="text-xs text-green-600 mt-1">Click on stitches to mark complete</p>
      </div>

      {/* Overall Progress */}
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Overall Progress</h3>
        <div className="mb-2">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total</span>
            <span className="font-medium">{progressData.overallPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressData.overallPercentage}%` }}
            />
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">{progressData.completedStitches.toLocaleString()}</span>
          {' / '}
          <span>{progressData.totalStitches.toLocaleString()}</span>
          {' stitches'}
        </div>
      </div>

      {/* Canvas Navigation */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePan}
            className={`flex-1 h-8 flex items-center justify-center gap-2 rounded text-sm ${
              isPanning
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isPanning ? 'Exit Pan Mode' : 'Pan Canvas'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 9l-3 3 3 3" />
              <path d="M9 5l3-3 3 3" />
              <path d="M15 19l-3 3-3-3" />
              <path d="M19 9l3 3-3 3" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            {isPanning ? 'Exit Pan Mode' : 'Move Canvas'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">Hold Space to pan temporarily</p>
      </div>

      {/* Shading Controls */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Completed Shading</h3>

        {/* Color Picker */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-600 w-12">Color</span>
          <div className="relative flex-1">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-full h-7 rounded border border-gray-300 flex items-center px-2 gap-2"
            >
              <div
                className="w-5 h-5 rounded border border-gray-400"
                style={{
                  backgroundColor: `rgb(${progressShadingColor[0]}, ${progressShadingColor[1]}, ${progressShadingColor[2]})`,
                }}
              />
              <span className="text-xs text-gray-600">
                {rgbToHex(progressShadingColor[0], progressShadingColor[1], progressShadingColor[2]).toUpperCase()}
              </span>
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-300 p-2 z-20">
                <input
                  type="color"
                  value={rgbToHex(progressShadingColor[0], progressShadingColor[1], progressShadingColor[2])}
                  onChange={(e) => {
                    setProgressShadingColor(hexToRgb(e.target.value));
                    setShowColorPicker(false);
                  }}
                  className="w-full h-8 cursor-pointer"
                />
                <div className="flex gap-1 mt-2 justify-center">
                  {presetColors.map((color, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setProgressShadingColor(color);
                        setShowColorPicker(false);
                      }}
                      className="w-7 h-7 rounded border border-gray-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                      title={`RGB(${color[0]}, ${color[1]}, ${color[2]})`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-12">Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progressShadingOpacity}
            onChange={(e) => setProgressShadingOpacity(parseInt(e.target.value, 10))}
            className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-600 w-8 text-right">{progressShadingOpacity}%</span>
        </div>
      </div>

      {/* Progress by Color */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">By Color</h3>

          {progressData.colorProgress.length === 0 ? (
            <p className="text-sm text-gray-500">No stitches in pattern</p>
          ) : (
            <div className="space-y-3">
              {progressData.colorProgress.map(cp => (
                <div key={cp.colorId} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-4 h-4 rounded border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: `rgb(${cp.rgb[0]}, ${cp.rgb[1]}, ${cp.rgb[2]})` }}
                    />
                    <span className="text-gray-700 truncate flex-1" title={cp.colorName}>
                      {cp.colorName}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {cp.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${cp.percentage}%`,
                        backgroundColor: `rgb(${cp.rgb[0]}, ${cp.rgb[1]}, ${cp.rgb[2]})`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {cp.completedStitches.toLocaleString()} / {cp.totalStitches.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer with quick stats */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div>
            <div className="text-gray-500">Remaining</div>
            <div className="font-medium text-gray-800">
              {(progressData.totalStitches - progressData.completedStitches).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Colors</div>
            <div className="font-medium text-gray-800">
              {progressData.colorProgress.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
