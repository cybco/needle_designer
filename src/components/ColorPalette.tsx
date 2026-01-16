import { useState } from 'react';
import { usePatternStore, Color } from '../stores/patternStore';
import { useConfigStore } from '../stores/configStore';

// Check if a color is used in any layer's stitches
function isColorUsed(pattern: { layers: Array<{ stitches: Array<{ colorId: string }> }> }, colorId: string): boolean {
  for (const layer of pattern.layers) {
    if (layer.stitches.some(stitch => stitch.colorId === colorId)) {
      return true;
    }
  }
  return false;
}

interface ColorPaletteProps {
  showSymbols?: boolean;
  defaultCollapsed?: boolean;
}

export function ColorPalette({ showSymbols = true, defaultCollapsed = false }: ColorPaletteProps) {
  const { pattern, selectedColorId, selectColor, removeColor } = usePatternStore();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const { confirmColorRemoval, setConfirmColorRemoval } = useConfigStore();
  const [colorToRemove, setColorToRemove] = useState<Color | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleRemoveColor = (color: Color) => {
    if (confirmColorRemoval) {
      setColorToRemove(color);
      setDontShowAgain(false);
    } else {
      removeColor(color.id);
    }
  };

  const confirmRemove = () => {
    if (colorToRemove) {
      removeColor(colorToRemove.id);
      if (dontShowAgain) {
        setConfirmColorRemoval(false);
      }
      setColorToRemove(null);
    }
  };

  if (!pattern) {
    return (
      <div className="w-full bg-white border-b border-gray-200 p-3">
        <h3 className="font-semibold text-gray-700 mb-2">Colors</h3>
        <p className="text-sm text-gray-500">No pattern loaded</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 flex flex-col shrink-0">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors shrink-0"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-700">Colors</h3>
          <span className="text-xs text-gray-500">({pattern.colorPalette.length})</span>
        </div>
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
          className={`text-gray-500 transition-transform ${!isCollapsed ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!isCollapsed && (
        <>
          <div className="flex-1 p-2">
            <div className="grid grid-cols-4 gap-1">
              {pattern.colorPalette.map((color) => {
                const luminance = (0.299 * color.rgb[0] + 0.587 * color.rgb[1] + 0.114 * color.rgb[2]) / 255;
                const symbolColor = luminance > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
                const used = isColorUsed(pattern, color.id);

                return (
                  <div key={color.id} className="relative group">
                    <button
                      onClick={() => selectColor(color.id)}
                      className={`
                        w-10 h-10 rounded border-2 transition-all relative
                        ${selectedColorId === color.id
                          ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                        }
                      `}
                      style={{
                        backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                      }}
                      title={`${color.name}${color.threadCode ? ` - ${color.threadBrand} ${color.threadCode}` : ''}${color.symbol ? ` (${color.symbol})` : ''}${used ? ' (in use)' : ''}`}
                    >
                      {showSymbols && color.symbol && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                          style={{ color: symbolColor }}
                        >
                          {color.symbol}
                        </span>
                      )}
                    </button>
                    {!used && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveColor(color);
                        }}
                        className="absolute top-0 right-0 w-4 h-4 bg-gray-300 hover:bg-red-500 active:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors"
                        title="Remove from palette"
                      >
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected color info */}
          {selectedColorId && (
            <div className="p-3 pb-4 border-t border-gray-200 bg-gray-50 shrink-0">
              {(() => {
                const color = pattern.colorPalette.find(c => c.id === selectedColorId);
                if (!color) return null;
                return (
                  <div>
                    <p className="text-sm font-medium text-gray-700">{color.name}</p>
                    {(color.threadCode || color.symbol) && (
                      <p className="text-xs text-gray-500">
                        {color.threadCode && `${color.threadBrand} ${color.threadCode}`}
                        {color.threadCode && color.symbol && ' · '}
                        {color.symbol && `Symbol: ${color.symbol}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      RGB: {color.rgb[0]}, {color.rgb[1]}, {color.rgb[2]}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Remove Color Confirmation Dialog */}
      {colorToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Remove Color?</h3>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded border border-gray-300 shrink-0"
                style={{
                  backgroundColor: `rgb(${colorToRemove.rgb[0]}, ${colorToRemove.rgb[1]}, ${colorToRemove.rgb[2]})`,
                }}
              />
              <div>
                <p className="text-sm font-medium text-gray-700">{colorToRemove.name}</p>
                {colorToRemove.threadCode && (
                  <p className="text-xs text-gray-500">{colorToRemove.threadBrand} {colorToRemove.threadCode}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Are you sure you want to remove this color from your palette?
            </p>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Don't show this again</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setColorToRemove(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
