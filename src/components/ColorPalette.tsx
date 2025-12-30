import { useState, useRef } from 'react';
import { usePatternStore, Color } from '../stores/patternStore';
import { ThreadLibraryDialog } from './ThreadLibraryDialog';
import { dmcThreads } from '../data/dmcThreads';

export function ColorPalette() {
  const { pattern, selectedColorId, selectColor, addColor } = usePatternStore();
  const [showThreadLibrary, setShowThreadLibrary] = useState(false);
  const [dmcInput, setDmcInput] = useState('');
  const [dmcError, setDmcError] = useState('');
  const colorInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddDMC = () => {
    const code = dmcInput.trim().toUpperCase();
    if (!code) return;

    const thread = dmcThreads.find(t => t.code.toUpperCase() === code);
    if (thread) {
      const newColor: Color = {
        id: `dmc-${thread.code}-${Date.now()}`,
        name: thread.name,
        rgb: thread.rgb,
        threadBrand: 'DMC',
        threadCode: thread.code,
      };
      addColor(newColor);
      selectColor(newColor.id);
      setDmcInput('');
      setDmcError('');
    } else {
      setDmcError(`DMC ${code} not found`);
    }
  };

  const handleDmcKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddDMC();
    }
  };

  return (
    <div className="w-64 bg-white border-l border-gray-300 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">Colors</h3>
        <p className="text-xs text-gray-500 mt-1">
          {pattern.colorPalette.length} colors
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {pattern.colorPalette.map((color) => (
            <button
              key={color.id}
              onClick={() => selectColor(color.id)}
              className={`
                w-10 h-10 rounded border-2 transition-all
                ${selectedColorId === color.id
                  ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                  : 'border-gray-300 hover:border-gray-400'
                }
              `}
              style={{
                backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`,
              }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-gray-200 space-y-3">
        {/* DMC Code Input */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Add DMC by Code
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={dmcInput}
              onChange={(e) => { setDmcInput(e.target.value); setDmcError(''); }}
              onKeyDown={handleDmcKeyDown}
              placeholder="e.g. 310"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddDMC}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              Add
            </button>
          </div>
          {dmcError && (
            <p className="text-xs text-red-500 mt-1">{dmcError}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowThreadLibrary(true)}
            className="flex-1 py-2 px-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200"
          >
            Browse DMC
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
        <div className="p-3 border-t border-gray-200 bg-gray-50">
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
              </div>
            );
          })()}
        </div>
      )}

      {/* Thread Library Dialog */}
      <ThreadLibraryDialog
        isOpen={showThreadLibrary}
        onClose={() => setShowThreadLibrary(false)}
      />
    </div>
  );
}
