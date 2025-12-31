import { useState } from 'react';
import { usePatternStore } from '../stores/patternStore';
import {
  PATTERN_SYMBOLS,
  SYMBOL_INFO,
  getAvailableSymbols,
  SymbolAssignmentMode,
} from '../utils/symbolAssignment';

interface SymbolAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SymbolAssignmentDialog({ isOpen, onClose }: SymbolAssignmentDialogProps) {
  const { pattern, updateColorSymbol, autoAssignSymbols, clearAllSymbols } = usePatternStore();
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [autoAssignMode, setAutoAssignMode] = useState<SymbolAssignmentMode>('usage');

  if (!isOpen || !pattern) return null;

  const handleAutoAssign = () => {
    autoAssignSymbols(autoAssignMode);
  };

  const handleClearAll = () => {
    clearAllSymbols();
  };

  const handleSymbolSelect = (colorId: string, symbol: string) => {
    updateColorSymbol(colorId, symbol);
    setEditingColorId(null);
  };

  const getSymbolInfo = (symbol: string) => {
    return SYMBOL_INFO.find(s => s.symbol === symbol);
  };

  // Get all stitches for counting
  const allStitches = pattern.layers.flatMap(l => l.stitches);
  const stitchCounts = new Map<string, number>();
  for (const stitch of allStitches) {
    stitchCounts.set(stitch.colorId, (stitchCounts.get(stitch.colorId) || 0) + 1);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Symbol Assignment</h2>
          <p className="text-sm text-gray-500 mt-1">
            Assign symbols to colors for printed pattern charts
          </p>
        </div>

        {/* Auto-assign controls */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auto-assign Mode
              </label>
              <select
                value={autoAssignMode}
                onChange={(e) => setAutoAssignMode(e.target.value as SymbolAssignmentMode)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="usage">By Usage (most used get best symbols)</option>
                <option value="lightness">By Lightness (dark=filled, light=outline)</option>
                <option value="sequential">Sequential (palette order)</option>
              </select>
            </div>
            <div className="flex gap-2 pt-5">
              <button
                onClick={handleAutoAssign}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
              >
                Auto-Assign
              </button>
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Color list */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-2 w-12">Color</th>
                <th className="pb-2">Name</th>
                <th className="pb-2 w-20 text-center">Symbol</th>
                <th className="pb-2 w-24 text-right">Stitches</th>
                <th className="pb-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {pattern.colorPalette.map((color) => {
                const count = stitchCounts.get(color.id) || 0;
                const isEditing = editingColorId === color.id;
                const availableSymbols = getAvailableSymbols(color.id, pattern.colorPalette);

                return (
                  <tr key={color.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2">
                      <div
                        className="w-8 h-8 rounded border border-gray-300"
                        style={{ backgroundColor: `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})` }}
                      />
                    </td>
                    <td className="py-2">
                      <div className="text-sm font-medium text-gray-800">{color.name}</div>
                      {color.threadCode && (
                        <div className="text-xs text-gray-500">
                          {color.threadBrand} {color.threadCode}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {isEditing ? (
                        <SymbolPicker
                          availableSymbols={availableSymbols}
                          currentSymbol={color.symbol}
                          onSelect={(symbol) => handleSymbolSelect(color.id, symbol)}
                          onCancel={() => setEditingColorId(null)}
                        />
                      ) : (
                        <span className="text-2xl" title={color.symbol ? getSymbolInfo(color.symbol)?.name : 'No symbol'}>
                          {color.symbol || '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right text-sm text-gray-600">
                      {count.toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      {!isEditing && (
                        <button
                          onClick={() => setEditingColorId(color.id)}
                          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        >
                          Change
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface SymbolPickerProps {
  availableSymbols: string[];
  currentSymbol?: string;
  onSelect: (symbol: string) => void;
  onCancel: () => void;
}

function SymbolPicker({ availableSymbols, currentSymbol, onSelect, onCancel }: SymbolPickerProps) {
  const [selectedSet, setSelectedSet] = useState<number>(1);

  const getSymbolsBySet = (set: number): string[] => {
    switch (set) {
      case 1:
        return PATTERN_SYMBOLS.tier1;
      case 2:
        return PATTERN_SYMBOLS.tier2;
      case 3:
        return PATTERN_SYMBOLS.tier3;
      case 4:
        return PATTERN_SYMBOLS.tier4;
      default:
        return [];
    }
  };

  const symbolsToShow = getSymbolsBySet(selectedSet);

  return (
    <div className="absolute z-10 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-64 left-1/2 -translate-x-1/2">
      {/* Set selector */}
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4].map((set) => (
          <button
            key={set}
            onClick={() => setSelectedSet(set)}
            className={`flex-1 py-1 text-xs rounded ${
              selectedSet === set
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Set {set}
          </button>
        ))}
      </div>

      {/* Symbol grid */}
      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
        {symbolsToShow.map((symbol) => {
          const isAvailable = availableSymbols.includes(symbol);
          const isCurrent = symbol === currentSymbol;

          return (
            <button
              key={symbol}
              onClick={() => isAvailable && onSelect(symbol)}
              disabled={!isAvailable}
              className={`
                w-7 h-7 text-lg flex items-center justify-center rounded border
                ${isCurrent ? 'bg-blue-100 border-blue-500' : ''}
                ${isAvailable
                  ? 'hover:bg-gray-100 border-gray-300 cursor-pointer'
                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
              title={isAvailable ? SYMBOL_INFO.find(s => s.symbol === symbol)?.name : 'Already in use'}
            >
              {symbol}
            </button>
          );
        })}
      </div>

      {/* Cancel button */}
      <div className="mt-2 flex justify-end">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
