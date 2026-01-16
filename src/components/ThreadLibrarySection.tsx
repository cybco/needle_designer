import { useState, useRef } from 'react';
import { usePatternStore, Color } from '../stores/patternStore';
import { ThreadLibraryDialog } from './ThreadLibraryDialog';
import {
  ThreadBrand,
  getThreadsByBrand,
  getThreadLibraries
} from '../data/threadLibrary';

interface ThreadLibrarySectionProps {
  showSymbols?: boolean;
  defaultCollapsed?: boolean;
}

export function ThreadLibrarySection({ showSymbols = true, defaultCollapsed = false }: ThreadLibrarySectionProps) {
  const { pattern, addColor, selectColor } = usePatternStore();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showThreadLibrary, setShowThreadLibrary] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<ThreadBrand>('DMC');
  const [threadCodeInput, setThreadCodeInput] = useState('');
  const [threadCodeError, setThreadCodeError] = useState('');
  const colorInputRef = useRef<HTMLInputElement>(null);

  const threadLibraries = getThreadLibraries();

  if (!pattern) {
    return null;
  }

  const handleAddColor = () => {
    colorInputRef.current?.click();
  };

  const handleColorPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
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
    <div className="w-full bg-white border-b border-gray-200 shrink-0">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-700">Thread Library</h3>
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
        <div className="p-3 pt-0 space-y-3">
          {/* Thread Library Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Library
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
              Custom Color
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
      )}

      {/* Thread Library Dialog */}
      <ThreadLibraryDialog
        isOpen={showThreadLibrary}
        onClose={() => setShowThreadLibrary(false)}
        initialBrand={selectedBrand}
        showSymbols={showSymbols}
      />
    </div>
  );
}
