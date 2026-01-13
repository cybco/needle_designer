import { useState, useMemo, useEffect } from 'react';
import { dmcThreads, ThreadCategory, categoryNames, getThreadsByCategory } from '../data/dmcThreads';
import { usePatternStore, Color } from '../stores/patternStore';
import {
  ThreadBrand,
  UnifiedThreadColor,
  getThreadsByBrand,
  getThreadLibraries,
} from '../data/threadLibrary';

interface ThreadLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialBrand?: ThreadBrand;
  showSymbols?: boolean;
}

type SortMode = 'code' | 'name' | 'color';
type CategoryFilter = 'all' | ThreadCategory;

// Convert RGB to HSL for better color sorting
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h, s, l];
}

// Sort colors in a visually pleasing way
function getColorSortKey(r: number, g: number, b: number): number {
  const [h, s, l] = rgbToHsl(r, g, b);

  // Group grays separately (low saturation)
  if (s < 0.15) {
    // Grays: sort by lightness, put at the end
    return 1000 + l * 100;
  }

  // Quantize hue into 12 color groups (like a color wheel)
  const hueGroup = Math.floor(h * 12);

  // Within each hue group, sort by lightness then saturation
  return hueGroup * 100 + (1 - l) * 10 + s;
}

export function ThreadLibraryDialog({ isOpen, onClose, initialBrand = 'DMC', showSymbols = true }: ThreadLibraryDialogProps) {
  const { pattern, addColor, selectColor } = usePatternStore();

  // Check if a thread is already in the palette
  const isInPalette = (thread: UnifiedThreadColor) => {
    if (!pattern) return false;
    return pattern.colorPalette.some(
      c => c.threadCode === thread.code && c.threadBrand === thread.brand
    );
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('code');
  const [selectedThreads, setSelectedThreads] = useState<UnifiedThreadColor[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedBrand, setSelectedBrand] = useState<ThreadBrand>(initialBrand);

  const threadLibraries = getThreadLibraries();

  // Update brand when initialBrand prop changes
  useEffect(() => {
    setSelectedBrand(initialBrand);
  }, [initialBrand]);

  // Reset filters when brand changes (but keep selected threads)
  useEffect(() => {
    setCategoryFilter('all');
    setSearchQuery('');
  }, [selectedBrand]);

  // Get all threads for the selected brand
  const allBrandThreads = useMemo(() => {
    return getThreadsByBrand(selectedBrand);
  }, [selectedBrand]);

  // Get thread counts per category (only for DMC)
  const categoryCounts = useMemo(() => {
    if (selectedBrand !== 'DMC') return null;
    const counts: Record<CategoryFilter, number> = {
      'all': dmcThreads.length,
      'solid': getThreadsByCategory('solid').length,
      'variegated': getThreadsByCategory('variegated').length,
      'light-effects': getThreadsByCategory('light-effects').length,
      'satin': getThreadsByCategory('satin').length,
      'etoile': getThreadsByCategory('etoile').length,
    };
    return counts;
  }, [selectedBrand]);

  // Filter and sort threads
  const filteredThreads = useMemo(() => {
    let threads: UnifiedThreadColor[];

    // For DMC, use category filter
    if (selectedBrand === 'DMC' && categoryFilter !== 'all') {
      // Filter allBrandThreads by category (already has symbols)
      threads = allBrandThreads.filter(t => t.category === categoryFilter);
    } else {
      threads = [...allBrandThreads];
    }

    // Apply search filter
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      threads = threads.filter(
        (thread) =>
          thread.code.toLowerCase().includes(lowerQuery) ||
          thread.name.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort
    switch (sortMode) {
      case 'code':
        threads.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        break;
      case 'name':
        threads.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'color':
        threads.sort((a, b) => {
          const keyA = getColorSortKey(a.rgb[0], a.rgb[1], a.rgb[2]);
          const keyB = getColorSortKey(b.rgb[0], b.rgb[1], b.rgb[2]);
          return keyA - keyB;
        });
        break;
    }

    return threads;
  }, [searchQuery, sortMode, categoryFilter, selectedBrand, allBrandThreads]);

  // Toggle thread selection (skip if already in palette)
  const handleToggleThread = (thread: UnifiedThreadColor) => {
    if (isInPalette(thread)) return; // Don't allow selecting colors already in palette

    setSelectedThreads(prev => {
      const isSelected = prev.some(t => t.code === thread.code && t.brand === thread.brand);
      if (isSelected) {
        return prev.filter(t => !(t.code === thread.code && t.brand === thread.brand));
      } else {
        return [...prev, thread];
      }
    });
  };

  // Remove thread from selection
  const handleRemoveFromSelection = (thread: UnifiedThreadColor) => {
    setSelectedThreads(prev => prev.filter(t => !(t.code === thread.code && t.brand === thread.brand)));
  };

  // Add a single thread directly (for double-click)
  const handleAddThreadDirect = (thread: UnifiedThreadColor) => {
    if (isInPalette(thread)) return; // Don't add if already in palette

    const newColor: Color = {
      id: `${thread.brand.toLowerCase()}-${thread.code}-${Date.now()}`,
      name: thread.name,
      rgb: thread.rgb,
      threadBrand: thread.brand,
      threadCode: thread.code,
      symbol: thread.symbol,
    };
    addColor(newColor);
    selectColor(newColor.id);
    onClose();
  };

  // Add all selected threads to palette
  const handleAddSelected = () => {
    if (selectedThreads.length === 0) return;

    let lastColorId = '';
    selectedThreads.forEach((thread) => {
      const newColor: Color = {
        id: `${thread.brand.toLowerCase()}-${thread.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: thread.name,
        rgb: thread.rgb,
        threadBrand: thread.brand,
        threadCode: thread.code,
        symbol: thread.symbol,
      };
      addColor(newColor);
      lastColorId = newColor.id;
    });

    // Select the last added color
    if (lastColorId) {
      selectColor(lastColorId);
    }

    // Clear selection after adding
    setSelectedThreads([]);
    onClose();
  };

  // Check if a thread is selected
  const isThreadSelected = (thread: UnifiedThreadColor) => {
    return selectedThreads.some(t => t.code === thread.code && t.brand === thread.brand);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-800">Thread Library</h2>
            <span className="text-sm text-gray-500">{allBrandThreads.length} colors in {selectedBrand}</span>
          </div>

          {/* Brand Tabs */}
          <div className="flex gap-1 mb-3">
            {threadLibraries.map((lib) => (
              <button
                key={lib.brand}
                onClick={() => setSelectedBrand(lib.brand)}
                className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                  selectedBrand === lib.brand
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {lib.name} ({lib.colorCount})
              </button>
            ))}
          </div>

          {/* Category Tabs (DMC only) */}
          {selectedBrand === 'DMC' && categoryCounts && (
            <div className="flex gap-1 mb-3 overflow-x-auto">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({categoryCounts['all']})
              </button>
              {(Object.entries(categoryNames) as [ThreadCategory, string][]).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => setCategoryFilter(key)}
                  className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                    categoryFilter === key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {name} ({categoryCounts[key]})
                </button>
              ))}
            </div>
          )}

          {/* Search and Sort */}
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code or name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="code">Sort by Code</option>
              <option value="name">Sort by Name</option>
              <option value="color">Sort by Color</option>
            </select>
          </div>
        </div>

        {/* Thread Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-4 gap-2">
            {filteredThreads.map((thread) => {
              // Calculate contrast color for symbol display
              const luminance = (0.299 * thread.rgb[0] + 0.587 * thread.rgb[1] + 0.114 * thread.rgb[2]) / 255;
              const symbolColor = luminance > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
              const selected = isThreadSelected(thread);
              const alreadyInPalette = isInPalette(thread);

              return (
                <button
                  key={thread.code}
                  onClick={() => handleToggleThread(thread)}
                  onDoubleClick={() => handleAddThreadDirect(thread)}
                  disabled={alreadyInPalette}
                  className={`
                    p-2 rounded-lg border-2 transition-all text-left flex items-center gap-2
                    ${alreadyInPalette
                      ? 'border-green-300 bg-green-50 opacity-60 cursor-not-allowed'
                      : selected
                        ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400 bg-white'
                    }
                  `}
                >
                  <div
                    className="w-8 h-8 rounded border border-gray-300 shrink-0 relative flex items-center justify-center"
                    style={{
                      backgroundColor: `rgb(${thread.rgb[0]}, ${thread.rgb[1]}, ${thread.rgb[2]})`,
                    }}
                  >
                    {alreadyInPalette ? (
                      <svg className="w-5 h-5" style={{ color: symbolColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : selected ? (
                      <svg className="w-5 h-5" style={{ color: symbolColor }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : showSymbols ? (
                      <span
                        className="text-base font-bold"
                        style={{ color: symbolColor }}
                      >
                        {thread.symbol}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold ${alreadyInPalette ? 'text-gray-500' : 'text-gray-800'}`}>{thread.code}</p>
                    <p className="text-xs text-gray-500 truncate">{alreadyInPalette ? 'In palette' : thread.name}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredThreads.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              {searchQuery
                ? `No threads found matching "${searchQuery}"${categoryFilter !== 'all' ? ` in ${categoryNames[categoryFilter]}` : ''}`
                : 'No threads in this category'}
            </div>
          )}
        </div>

        {/* Selected Colors Preview Area */}
        {selectedThreads.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Selected Colors ({selectedThreads.length})
              </p>
              <button
                onClick={() => setSelectedThreads([])}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {selectedThreads.map((thread) => {
                const luminance = (0.299 * thread.rgb[0] + 0.587 * thread.rgb[1] + 0.114 * thread.rgb[2]) / 255;
                const symbolColor = luminance > 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
                return (
                  <div
                    key={`${thread.brand}-${thread.code}`}
                    className="group flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg pl-1 pr-1.5 py-1 hover:border-gray-400 transition-colors"
                  >
                    <div
                      className="w-6 h-6 rounded border border-gray-300 shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: `rgb(${thread.rgb[0]}, ${thread.rgb[1]}, ${thread.rgb[2]})`,
                      }}
                    >
                      {showSymbols && (
                        <span className="text-xs font-bold" style={{ color: symbolColor }}>
                          {thread.symbol}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{thread.code}</span>
                    <button
                      onClick={() => handleRemoveFromSelection(thread)}
                      className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
                      title="Remove from selection"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <p className="text-sm text-gray-500 self-center">
            {filteredThreads.length} threads shown
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedThreads.length === 0}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedThreads.length === 0
                ? 'Add to Palette'
                : `Add ${selectedThreads.length} Color${selectedThreads.length > 1 ? 's' : ''} to Palette`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
