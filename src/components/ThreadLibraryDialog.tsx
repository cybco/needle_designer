import { useState, useMemo } from 'react';
import { dmcThreads, ThreadColor, ThreadCategory, categoryNames, getThreadsByCategory } from '../data/dmcThreads';
import { usePatternStore, Color } from '../stores/patternStore';

interface ThreadLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

export function ThreadLibraryDialog({ isOpen, onClose }: ThreadLibraryDialogProps) {
  const { addColor, selectColor } = usePatternStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('code');
  const [selectedThread, setSelectedThread] = useState<ThreadColor | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Get thread counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      'all': dmcThreads.length,
      'solid': getThreadsByCategory('solid').length,
      'variegated': getThreadsByCategory('variegated').length,
      'light-effects': getThreadsByCategory('light-effects').length,
      'satin': getThreadsByCategory('satin').length,
      'etoile': getThreadsByCategory('etoile').length,
    };
    return counts;
  }, []);

  // Filter and sort threads
  const filteredThreads = useMemo(() => {
    // Start with category filter
    let threads = categoryFilter === 'all'
      ? [...dmcThreads]
      : getThreadsByCategory(categoryFilter);

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
  }, [searchQuery, sortMode, categoryFilter]);

  const handleAddThread = (thread: ThreadColor) => {
    const newColor: Color = {
      id: `dmc-${thread.code}-${Date.now()}`,
      name: thread.name,
      rgb: thread.rgb,
      threadBrand: 'DMC',
      threadCode: thread.code,
    };
    addColor(newColor);
    selectColor(newColor.id);
    onClose();
  };

  const handleAddSelected = () => {
    if (selectedThread) {
      handleAddThread(selectedThread);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-800">DMC Thread Library</h2>
            <span className="text-sm text-gray-500">{dmcThreads.length} colors total</span>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-blue-600 text-white'
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {name} ({categoryCounts[key]})
              </button>
            ))}
          </div>

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
            {filteredThreads.map((thread) => (
              <button
                key={thread.code}
                onClick={() => setSelectedThread(thread)}
                onDoubleClick={() => handleAddThread(thread)}
                className={`
                  p-2 rounded-lg border-2 transition-all text-left flex items-center gap-2
                  ${selectedThread?.code === thread.code
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                  }
                `}
              >
                <div
                  className="w-8 h-8 rounded border border-gray-300 shrink-0"
                  style={{
                    backgroundColor: `rgb(${thread.rgb[0]}, ${thread.rgb[1]}, ${thread.rgb[2]})`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800">{thread.code}</p>
                  <p className="text-xs text-gray-500 truncate">{thread.name}</p>
                </div>
              </button>
            ))}
          </div>

          {filteredThreads.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              {searchQuery
                ? `No threads found matching "${searchQuery}"${categoryFilter !== 'all' ? ` in ${categoryNames[categoryFilter]}` : ''}`
                : 'No threads in this category'}
            </div>
          )}
        </div>

        {/* Selected Thread Info */}
        {selectedThread && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg border border-gray-300 shrink-0"
                style={{
                  backgroundColor: `rgb(${selectedThread.rgb[0]}, ${selectedThread.rgb[1]}, ${selectedThread.rgb[2]})`,
                }}
              />
              <div className="flex-1">
                <p className="font-bold text-gray-800">DMC {selectedThread.code}</p>
                <p className="text-sm text-gray-600">{selectedThread.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {categoryNames[selectedThread.category]} | RGB: {selectedThread.rgb[0]}, {selectedThread.rgb[1]}, {selectedThread.rgb[2]}
                </p>
              </div>
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
              disabled={!selectedThread}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Palette
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
