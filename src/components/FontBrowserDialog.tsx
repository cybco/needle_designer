import { useState, useEffect, useCallback, useRef } from 'react';
import { bundledFonts, isFontLoaded } from '../data/bundledFonts';
import { googleFonts, loadGoogleFont, parseVariantWeight } from '../data/googleFonts';
import { pixelFonts, loadPixelFont, isPixelFontLoaded } from '../data/pixelFonts';
import { bitmapFonts, isBitmapFont } from '../data/bitmapFonts';

interface FontBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFont: (fontFamily: string, weight: number) => void;
  currentFont: string;
  currentWeight: number;
}

type Tab = 'bundled' | 'bitmap' | 'pixel' | 'google' | 'recent';
type Category = 'all' | 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace' | 'pixel';

const RECENT_FONTS_KEY = 'needle-designer-recent-fonts';
const DOWNLOADED_FONTS_KEY = 'needle-designer-downloaded-fonts';
const MAX_RECENT_FONTS = 20;

interface RecentFont {
  family: string;
  weight: number;
  timestamp: number;
}

function getRecentFonts(): RecentFont[] {
  try {
    const stored = localStorage.getItem(RECENT_FONTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentFont(family: string, weight: number): void {
  const recent = getRecentFonts().filter(f => f.family !== family);
  recent.unshift({ family, weight, timestamp: Date.now() });
  localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_FONTS)));
}

// Track downloaded fonts in localStorage
function getDownloadedFonts(): Set<string> {
  try {
    const stored = localStorage.getItem(DOWNLOADED_FONTS_KEY);
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

function addDownloadedFont(family: string): void {
  const downloaded = getDownloadedFonts();
  downloaded.add(family);
  localStorage.setItem(DOWNLOADED_FONTS_KEY, JSON.stringify(Array.from(downloaded)));
}

interface FontCardProps {
  family: string;
  category: string;
  weight: number;
  isAvailable: boolean; // Font is ready to use (bundled or downloaded)
  isDownloading: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function FontCard({ family, category, weight, isAvailable, isDownloading, isSelected, onClick }: FontCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`p-3 border rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
      }`}
    >
      <div
        className="text-lg mb-1 truncate h-7"
        style={{
          fontFamily: isAvailable ? `"${family}", sans-serif` : 'inherit',
          fontWeight: weight,
        }}
      >
        {isAvailable ? 'The quick brown fox' : (isDownloading ? 'Downloading...' : family)}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 truncate">{family}</span>
        {isAvailable ? (
          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">available</span>
        ) : isDownloading ? (
          <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            downloading
          </span>
        ) : (
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            download
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {category} - {weight >= 700 ? 'Bold' : 'Regular'}
      </div>
    </div>
  );
}

export function FontBrowserDialog({
  isOpen,
  onClose,
  onSelectFont,
  currentFont,
  currentWeight,
}: FontBrowserDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('bundled');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedFont, setSelectedFont] = useState<string>(currentFont);
  const [selectedWeight, setSelectedWeight] = useState<number>(currentWeight);
  const [downloadedFonts, setDownloadedFonts] = useState<Set<string>>(new Set());
  const [downloadingFonts, setDownloadingFonts] = useState<Set<string>>(new Set());
  const [recentFonts, setRecentFonts] = useState<RecentFont[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  // Load state from localStorage when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRecentFonts(getRecentFonts());
      setDownloadedFonts(getDownloadedFonts());
      setSelectedFont(currentFont);
      setSelectedWeight(currentWeight);
      setIsConfirming(false);
    }
  }, [isOpen, currentFont, currentWeight]);

  // Check if font is available (bundled, bitmap, pixel, or downloaded)
  const isFontAvailable = useCallback((family: string): boolean => {
    // Bundled fonts are always available
    if (bundledFonts.some(f => f.family === family)) {
      return true;
    }
    // Bitmap fonts are always available (data is bundled)
    if (isBitmapFont(family)) {
      return true;
    }
    // Check if it's a pixel font that's loaded
    if (pixelFonts.some(f => f.family === family) && isPixelFontLoaded(family)) {
      return true;
    }
    // Check if downloaded
    return downloadedFonts.has(family);
  }, [downloadedFonts]);

  // Download a font
  const downloadFont = useCallback(async (family: string, weight: number): Promise<boolean> => {
    // Already available
    if (isFontAvailable(family)) {
      return true;
    }

    // Already downloading
    if (downloadingFonts.has(family)) {
      return false;
    }

    setDownloadingFonts(prev => new Set(prev).add(family));

    try {
      // Check if it's a pixel font and load accordingly
      const isPixel = pixelFonts.some(f => f.family === family);
      if (isPixel) {
        loadPixelFont(family, weight);
      } else {
        loadGoogleFont(family, weight);
      }

      // Wait for font to load (with timeout)
      const maxWait = 10000; // 10 seconds
      const checkInterval = 100;
      let waited = 0;

      while (waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;

        if (isFontLoaded(family)) {
          // Font loaded successfully
          addDownloadedFont(family);
          setDownloadedFonts(prev => new Set(prev).add(family));
          setDownloadingFonts(prev => {
            const next = new Set(prev);
            next.delete(family);
            return next;
          });
          return true;
        }
      }

      // Timeout - assume it loaded anyway (network might be slow)
      addDownloadedFont(family);
      setDownloadedFonts(prev => new Set(prev).add(family));
      setDownloadingFonts(prev => {
        const next = new Set(prev);
        next.delete(family);
        return next;
      });
      return true;
    } catch (error) {
      console.error('Failed to download font:', error);
      setDownloadingFonts(prev => {
        const next = new Set(prev);
        next.delete(family);
        return next;
      });
      return false;
    }
  }, [isFontAvailable, downloadingFonts]);

  // Handle font selection - download if needed
  const handleSelectFont = useCallback(async (family: string, weight: number) => {
    setSelectedFont(family);
    setSelectedWeight(weight);

    // Start downloading if not available
    if (!isFontAvailable(family)) {
      downloadFont(family, weight);
    }
  }, [isFontAvailable, downloadFont]);

  // Handle confirm - ensure font is downloaded first
  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);

    // Download if not available
    if (!isFontAvailable(selectedFont)) {
      const success = await downloadFont(selectedFont, selectedWeight);
      if (!success) {
        setIsConfirming(false);
        return;
      }
    }

    addRecentFont(selectedFont, selectedWeight);
    onSelectFont(selectedFont, selectedWeight);
    onClose();
  }, [selectedFont, selectedWeight, isFontAvailable, downloadFont, onSelectFont, onClose]);

  // Get available weights for selected font
  const getAvailableWeights = (family: string): number[] => {
    const bundled = bundledFonts.find(f => f.family === family);
    if (bundled) return bundled.weights;

    // Bitmap fonts only have one weight (400)
    if (isBitmapFont(family)) return [400];

    const pixel = pixelFonts.find(f => f.family === family);
    if (pixel) return pixel.weights;

    const google = googleFonts.find(f => f.family === family);
    if (google) {
      const weights = new Set<number>();
      for (const variant of google.variants) {
        weights.add(parseVariantWeight(variant));
      }
      return Array.from(weights).sort((a, b) => a - b);
    }

    return [400];
  };

  // Filter fonts based on search and category
  const filterFonts = <T extends { family: string; category: string }>(fonts: T[]): T[] => {
    return fonts.filter(font => {
      const matchesSearch = font.family.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || font.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const filteredBundledFonts = filterFonts(bundledFonts);
  const filteredGoogleFonts = filterFonts(googleFonts).slice(0, 100); // Limit for performance

  if (!isOpen) return null;

  const isSelectedFontAvailable = isFontAvailable(selectedFont);
  const isSelectedFontDownloading = downloadingFonts.has(selectedFont);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Choose Font</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            x
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('bundled')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'bundled'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Bundled ({bundledFonts.length})
            </button>
            <button
              onClick={() => setActiveTab('bitmap')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'bitmap'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Bitmap ({bitmapFonts.length})
            </button>
            <button
              onClick={() => setActiveTab('pixel')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'pixel'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Pixel ({pixelFonts.length})
            </button>
            <button
              onClick={() => setActiveTab('google')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'google'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Google Fonts ({googleFonts.length})
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeTab === 'recent'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Recent ({recentFonts.length})
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        {activeTab !== 'recent' && (
          <div className="p-4 border-b border-gray-200 flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fonts..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as Category)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="serif">Serif</option>
                <option value="sans-serif">Sans-Serif</option>
                <option value="display">Display</option>
                <option value="handwriting">Handwriting</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>
        )}

        {/* Font List */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'bundled' && (
            <div className="grid grid-cols-2 gap-3">
              {filteredBundledFonts.map((font) => (
                <FontCard
                  key={font.family}
                  family={font.family}
                  category={font.category}
                  weight={font.weights.includes(selectedWeight) ? selectedWeight : font.weights[0]}
                  isAvailable={true}
                  isDownloading={false}
                  isSelected={selectedFont === font.family}
                  onClick={() => handleSelectFont(font.family, font.weights.includes(selectedWeight) ? selectedWeight : font.weights[0])}
                />
              ))}
              {filteredBundledFonts.length === 0 && (
                <p className="col-span-2 text-center text-gray-500 py-8">No fonts match your search</p>
              )}
            </div>
          )}

          {activeTab === 'bitmap' && (
            <div>
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Pixel-Perfect Fonts:</strong> These fonts use pre-rendered bitmap data for guaranteed crisp rendering at small sizes. Perfect for needlepoint text.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {bitmapFonts.map((font) => (
                  <FontCard
                    key={font.family}
                    family={font.family}
                    category="bitmap"
                    weight={400}
                    isAvailable={true}
                    isDownloading={false}
                    isSelected={selectedFont === font.family}
                    onClick={() => handleSelectFont(font.family, 400)}
                  />
                ))}
                {bitmapFonts.length === 0 && (
                  <p className="col-span-2 text-center text-gray-500 py-8">No bitmap fonts available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pixel' && (
            <div>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  These fonts have a retro/pixelated style. For best results, use sizes 16 or larger. Very small sizes (under 12) may not render clearly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {pixelFonts.map((font) => {
                  const available = isPixelFontLoaded(font.family) || downloadedFonts.has(font.family);
                  const downloading = downloadingFonts.has(font.family);
                  return (
                    <FontCard
                      key={font.family}
                      family={font.family}
                      category={font.category}
                      weight={font.weights.includes(selectedWeight) ? selectedWeight : font.weights[0]}
                      isAvailable={available}
                      isDownloading={downloading}
                      isSelected={selectedFont === font.family}
                      onClick={() => handleSelectFont(font.family, font.weights.includes(selectedWeight) ? selectedWeight : font.weights[0])}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'google' && (
            <div>
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Note: Google Fonts are designed for screen display and may not render optimally at small stitch sizes. For best results under 20 stitches, try the Pixel fonts tab.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {filteredGoogleFonts.map((font) => {
                  const defaultWeight = font.variants.includes('regular') ? 400 : parseVariantWeight(font.variants[0]);
                  const available = isFontAvailable(font.family);
                  const downloading = downloadingFonts.has(font.family);
                  return (
                    <FontCard
                      key={font.family}
                      family={font.family}
                      category={font.category}
                      weight={defaultWeight}
                      isAvailable={available}
                      isDownloading={downloading}
                      isSelected={selectedFont === font.family}
                      onClick={() => handleSelectFont(font.family, defaultWeight)}
                    />
                  );
                })}
                {filteredGoogleFonts.length === 0 && (
                  <p className="col-span-2 text-center text-gray-500 py-8">No fonts match your search</p>
                )}
                {filteredGoogleFonts.length === 100 && (
                  <p className="col-span-2 text-center text-gray-400 text-sm py-2">
                    Showing first 100 results. Use search to find more.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'recent' && (
            <div className="grid grid-cols-2 gap-3">
              {recentFonts.map((font) => {
                const available = isFontAvailable(font.family);
                const downloading = downloadingFonts.has(font.family);
                // Find category from bitmap fonts, pixel fonts, bundled fonts, or google fonts
                const bitmapFont = bitmapFonts.find(b => b.family === font.family);
                const pixelFont = pixelFonts.find(p => p.family === font.family);
                const bundledFont = bundledFonts.find(b => b.family === font.family);
                const googleFont = googleFonts.find(g => g.family === font.family);
                const category = bitmapFont?.category || pixelFont?.category || bundledFont?.category || googleFont?.category || 'sans-serif';
                return (
                  <FontCard
                    key={font.family}
                    family={font.family}
                    category={category}
                    weight={font.weight}
                    isAvailable={available}
                    isDownloading={downloading}
                    isSelected={selectedFont === font.family}
                    onClick={() => handleSelectFont(font.family, font.weight)}
                  />
                );
              })}
              {recentFonts.length === 0 && (
                <p className="col-span-2 text-center text-gray-500 py-8">No recently used fonts</p>
              )}
            </div>
          )}
        </div>

        {/* Selected Font Details */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span>Selected Font</span>
                {isSelectedFontAvailable ? (
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">available</span>
                ) : isSelectedFontDownloading ? (
                  <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">downloading...</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">will download</span>
                )}
              </div>
              <div
                className="text-xl"
                style={{
                  fontFamily: isSelectedFontAvailable ? `"${selectedFont}", sans-serif` : 'inherit',
                  fontWeight: selectedWeight,
                }}
              >
                {selectedFont} - {isSelectedFontAvailable ? 'The quick brown fox' : '(preview after download)'}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Weight</label>
              <select
                value={selectedWeight}
                onChange={(e) => setSelectedWeight(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableWeights(selectedFont).map((w) => (
                  <option key={w} value={w}>{w >= 700 ? 'Bold' : 'Regular'}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isSelectedFontDownloading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-wait flex items-center gap-2"
          >
            {(isConfirming || isSelectedFontDownloading) && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {!isSelectedFontAvailable && !isSelectedFontDownloading && !isConfirming ? 'Download & Select' : 'Select Font'}
          </button>
        </div>
      </div>
    </div>
  );
}
