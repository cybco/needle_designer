import { useState, useRef } from 'react';
import { usePatternStore, Color } from '../stores/patternStore';
import { useConfigStore } from '../stores/configStore';
import { ThreadLibraryDialog } from './ThreadLibraryDialog';
import {
  ThreadBrand,
  getThreadsByBrand,
  getThreadLibraries
} from '../data/threadLibrary';

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
}

export function ColorPalette({ showSymbols = true }: ColorPaletteProps) {
  const { pattern, selectedColorId, selectColor, addColor, removeColor } = usePatternStore();
  const { confirmColorRemoval, setConfirmColorRemoval } = useConfigStore();
  const [showThreadLibrary, setShowThreadLibrary] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ThreadBrand>('DMC');
  const [threadCodeInput, setThreadCodeInput] = useState('');
  const [threadCodeError, setThreadCodeError] = useState('');
  const [colorToRemove, setColorToRemove] = useState<Color | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveColor = (color: Color) => {
    if (confirmColorRemoval) {
      setColorToRemove(color);
      setDontShowAgain(false); // Reset checkbox each time dialog opens
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

  const threadLibraries = getThreadLibraries();

  if (!pattern) {
    return (
      <div className="w-64 bg-white border-l border-gray-300 p-3">
        <h3 className="font-semibold text-gray-700 mb-2">Colors</h3>
        <p className="text-sm text-gray-500">No pattern loaded</p>
      </div>
    );
  }

  const handleAddColor = () => {
    // Trigger the hidden color input
    colorInputRef.current?.click();
  };

  const handleColorPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const newColor: Color = {
      id: `color-${Date.now()}`,
      name: `Custom ${hex.toUpperCase()}`,
      rgb: [r, g, b],
    };
    addColor(newColor);
    selectColor(newColor.id);
  };

  const handleAddThreadByCode = () => {
    const code = threadCodeInput.trim().toUpperCase();
    if (!code) return;

    const threads = getThreadsByBrand(selectedBrand);
    const thread = threads.find(t => t.code.toUpperCase() === code);
    if (thread) {
      const newColor: Color = {
        id: `${selectedBrand.toLowerCase()}-${thread.code}-${Date.now()}`,
        name: thread.name,
        rgb: thread.rgb,
        threadBrand: selectedBrand,
        threadCode: thread.code,
      };
      addColor(newColor);
      selectColor(newColor.id);
      setThreadCodeInput('');
      setThreadCodeError('');
    } else {
      setThreadCodeError(`${selectedBrand} ${code} not found`);
    }
  };

  const handleThreadCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddThreadByCode();
    }
  };

  return (
    <div className="w-64 bg-white border-l border-gray-300 flex flex-col flex-1 min-h-0">
      <div className="p-3 border-b border-gray-200 shrink-0">
        <h3 className="font-semibold text-gray-700">Colors</h3>
        <p className="text-xs text-gray-500 mt-1">
          {pattern.colorPalette.length} colors
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {pattern.colorPalette.map((color) => {
            // Calculate contrast color for symbol
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
                  title={`${color.name}${color.symbol ? ` (${color.symbol})` : ''}${used ? ' (in use)' : ''}`}
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
                {/* Remove button - always visible for unused colors (touch-friendly) */}
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

      <div className="p-3 border-t border-gray-200 space-y-3 shrink-0">
        {/* Thread Library Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Thread Library
          </label>
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value as ThreadBrand);
              setThreadCodeError('');
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {threadLibraries.map((lib) => (
              <option key={lib.brand} value={lib.brand}>
                {lib.name} ({lib.colorCount})
              </option>
            ))}
          </select>
        </div>

        {/* Thread Code Input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Add by Code
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={threadCodeInput}
              onChange={(e) => { setThreadCodeInput(e.target.value); setThreadCodeError(''); }}
              onKeyDown={handleThreadCodeKeyDown}
              placeholder={selectedBrand === 'DMC' ? 'e.g. 310' : selectedBrand === 'Anchor' ? 'e.g. 403' : 'e.g. 002'}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddThreadByCode}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Add
            </button>
          </div>
          {threadCodeError && (
            <p className="text-xs text-red-500 mt-1">{threadCodeError}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowThreadLibrary(true)}
            className="flex-1 py-2 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
          >
            Browse Library
          </button>
          <button
            onClick={handleAddColor}
            className="flex-1 py-2 px-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
          >
            Custom
          </button>
        </div>

        {/* Hidden color input */}
        <input
          ref={colorInputRef}
          type="color"
          onChange={handleColorPicked}
          className="sr-only"
        />
      </div>

      {/* Selected color info */}
      {selectedColorId && (
        <div className="p-3 pb-8 border-t border-gray-200 bg-gray-50 shrink-0 min-h-[140px]">
          {(() => {
            const color = pattern.colorPalette.find(c => c.id === selectedColorId);
            if (!color) return null;
            return (
              <div>
                <div
                  className="w-full h-8 rounded mb-2 border border-gray-300"
                  style={{
                    backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
                  }}
                />
                <p className="text-sm font-medium text-gray-700">{color.name}</p>
                <p className="text-xs text-gray-500">
                  RGB: {color.rgb[0]}, {color.rgb[1]}, {color.rgb[2]}
                </p>
                {color.threadCode && (
                  <p className="text-xs text-gray-500">
                    {color.threadBrand} {color.threadCode}
                  </p>
                )}
                {color.symbol && (
                  <p className="text-xs text-gray-500 pb-1">
                    Symbol: {color.symbol}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Thread Library Dialog */}
      <ThreadLibraryDialog
        isOpen={showThreadLibrary}
        onClose={() => setShowThreadLibrary(false)}
        initialBrand={selectedBrand}
        showSymbols={showSymbols}
      />

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
