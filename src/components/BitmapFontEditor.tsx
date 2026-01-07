// DEV TOOL ONLY - Bitmap Font Editor
// This component is for creating/editing bitmap font glyph data
// Access via Ctrl+Shift+F in development mode

import { useState, useCallback, useEffect } from 'react';
import { bitmapFonts } from '../data/bitmapFonts';

interface BitmapFontEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?\'"()-+=#@&/:;';

// Basic character templates for 8-pixel height - will be scaled for other sizes
// These are simple starting points that users can refine
const CHAR_TEMPLATES_8PX: Record<string, { width: number; pixels: string[] }> = {
  // Uppercase letters
  'A': { width: 5, pixels: ['01110', '10001', '10001', '11111', '10001', '10001', '10001', '00000'] },
  'B': { width: 5, pixels: ['11110', '10001', '10001', '11110', '10001', '10001', '11110', '00000'] },
  'C': { width: 5, pixels: ['01110', '10001', '10000', '10000', '10000', '10001', '01110', '00000'] },
  'D': { width: 5, pixels: ['11100', '10010', '10001', '10001', '10001', '10010', '11100', '00000'] },
  'E': { width: 5, pixels: ['11111', '10000', '10000', '11110', '10000', '10000', '11111', '00000'] },
  'F': { width: 5, pixels: ['11111', '10000', '10000', '11110', '10000', '10000', '10000', '00000'] },
  'G': { width: 5, pixels: ['01110', '10001', '10000', '10111', '10001', '10001', '01110', '00000'] },
  'H': { width: 5, pixels: ['10001', '10001', '10001', '11111', '10001', '10001', '10001', '00000'] },
  'I': { width: 3, pixels: ['111', '010', '010', '010', '010', '010', '111', '000'] },
  'J': { width: 5, pixels: ['00111', '00010', '00010', '00010', '00010', '10010', '01100', '00000'] },
  'K': { width: 5, pixels: ['10001', '10010', '10100', '11000', '10100', '10010', '10001', '00000'] },
  'L': { width: 5, pixels: ['10000', '10000', '10000', '10000', '10000', '10000', '11111', '00000'] },
  'M': { width: 5, pixels: ['10001', '11011', '10101', '10101', '10001', '10001', '10001', '00000'] },
  'N': { width: 5, pixels: ['10001', '11001', '10101', '10011', '10001', '10001', '10001', '00000'] },
  'O': { width: 5, pixels: ['01110', '10001', '10001', '10001', '10001', '10001', '01110', '00000'] },
  'P': { width: 5, pixels: ['11110', '10001', '10001', '11110', '10000', '10000', '10000', '00000'] },
  'Q': { width: 5, pixels: ['01110', '10001', '10001', '10001', '10101', '10010', '01101', '00000'] },
  'R': { width: 5, pixels: ['11110', '10001', '10001', '11110', '10100', '10010', '10001', '00000'] },
  'S': { width: 5, pixels: ['01110', '10001', '10000', '01110', '00001', '10001', '01110', '00000'] },
  'T': { width: 5, pixels: ['11111', '00100', '00100', '00100', '00100', '00100', '00100', '00000'] },
  'U': { width: 5, pixels: ['10001', '10001', '10001', '10001', '10001', '10001', '01110', '00000'] },
  'V': { width: 5, pixels: ['10001', '10001', '10001', '10001', '10001', '01010', '00100', '00000'] },
  'W': { width: 5, pixels: ['10001', '10001', '10001', '10101', '10101', '11011', '10001', '00000'] },
  'X': { width: 5, pixels: ['10001', '10001', '01010', '00100', '01010', '10001', '10001', '00000'] },
  'Y': { width: 5, pixels: ['10001', '10001', '01010', '00100', '00100', '00100', '00100', '00000'] },
  'Z': { width: 5, pixels: ['11111', '00001', '00010', '00100', '01000', '10000', '11111', '00000'] },
  // Lowercase letters
  'a': { width: 5, pixels: ['00000', '00000', '01110', '00001', '01111', '10001', '01111', '00000'] },
  'b': { width: 5, pixels: ['10000', '10000', '10110', '11001', '10001', '10001', '11110', '00000'] },
  'c': { width: 4, pixels: ['0000', '0000', '0110', '1000', '1000', '1000', '0110', '0000'] },
  'd': { width: 5, pixels: ['00001', '00001', '01101', '10011', '10001', '10001', '01111', '00000'] },
  'e': { width: 5, pixels: ['00000', '00000', '01110', '10001', '11111', '10000', '01110', '00000'] },
  'f': { width: 4, pixels: ['0011', '0100', '1111', '0100', '0100', '0100', '0100', '0000'] },
  'g': { width: 5, pixels: ['00000', '01111', '10001', '10001', '01111', '00001', '01110', '00000'] },
  'h': { width: 5, pixels: ['10000', '10000', '10110', '11001', '10001', '10001', '10001', '00000'] },
  'i': { width: 1, pixels: ['1', '0', '1', '1', '1', '1', '1', '0'] },
  'j': { width: 3, pixels: ['001', '000', '011', '001', '001', '001', '110', '000'] },
  'k': { width: 4, pixels: ['1000', '1000', '1010', '1100', '1100', '1010', '1001', '0000'] },
  'l': { width: 2, pixels: ['11', '01', '01', '01', '01', '01', '11', '00'] },
  'm': { width: 5, pixels: ['00000', '00000', '11010', '10101', '10101', '10001', '10001', '00000'] },
  'n': { width: 5, pixels: ['00000', '00000', '10110', '11001', '10001', '10001', '10001', '00000'] },
  'o': { width: 5, pixels: ['00000', '00000', '01110', '10001', '10001', '10001', '01110', '00000'] },
  'p': { width: 5, pixels: ['00000', '11110', '10001', '11110', '10000', '10000', '10000', '00000'] },
  'q': { width: 5, pixels: ['00000', '01111', '10001', '01111', '00001', '00001', '00001', '00000'] },
  'r': { width: 4, pixels: ['0000', '0000', '1011', '1100', '1000', '1000', '1000', '0000'] },
  's': { width: 4, pixels: ['0000', '0000', '0111', '1000', '0110', '0001', '1110', '0000'] },
  't': { width: 4, pixels: ['0100', '0100', '1110', '0100', '0100', '0100', '0011', '0000'] },
  'u': { width: 5, pixels: ['00000', '00000', '10001', '10001', '10001', '10011', '01101', '00000'] },
  'v': { width: 5, pixels: ['00000', '00000', '10001', '10001', '10001', '01010', '00100', '00000'] },
  'w': { width: 5, pixels: ['00000', '00000', '10001', '10001', '10101', '10101', '01010', '00000'] },
  'x': { width: 5, pixels: ['00000', '00000', '10001', '01010', '00100', '01010', '10001', '00000'] },
  'y': { width: 5, pixels: ['00000', '10001', '10001', '01111', '00001', '00001', '01110', '00000'] },
  'z': { width: 4, pixels: ['0000', '0000', '1111', '0010', '0100', '1000', '1111', '0000'] },
  // Numbers
  '0': { width: 5, pixels: ['01110', '10001', '10011', '10101', '11001', '10001', '01110', '00000'] },
  '1': { width: 3, pixels: ['010', '110', '010', '010', '010', '010', '111', '000'] },
  '2': { width: 5, pixels: ['01110', '10001', '00001', '00110', '01000', '10000', '11111', '00000'] },
  '3': { width: 5, pixels: ['01110', '10001', '00001', '00110', '00001', '10001', '01110', '00000'] },
  '4': { width: 5, pixels: ['00010', '00110', '01010', '10010', '11111', '00010', '00010', '00000'] },
  '5': { width: 5, pixels: ['11111', '10000', '11110', '00001', '00001', '10001', '01110', '00000'] },
  '6': { width: 5, pixels: ['00110', '01000', '10000', '11110', '10001', '10001', '01110', '00000'] },
  '7': { width: 5, pixels: ['11111', '00001', '00010', '00100', '01000', '01000', '01000', '00000'] },
  '8': { width: 5, pixels: ['01110', '10001', '10001', '01110', '10001', '10001', '01110', '00000'] },
  '9': { width: 5, pixels: ['01110', '10001', '10001', '01111', '00001', '00010', '01100', '00000'] },
  // Punctuation
  ' ': { width: 3, pixels: ['000', '000', '000', '000', '000', '000', '000', '000'] },
  '.': { width: 2, pixels: ['00', '00', '00', '00', '00', '00', '11', '00'] },
  ',': { width: 2, pixels: ['00', '00', '00', '00', '00', '01', '01', '10'] },
  '!': { width: 1, pixels: ['1', '1', '1', '1', '1', '0', '1', '0'] },
  '?': { width: 5, pixels: ['01110', '10001', '00001', '00010', '00100', '00000', '00100', '00000'] },
  "'": { width: 2, pixels: ['11', '01', '10', '00', '00', '00', '00', '00'] },
  '"': { width: 3, pixels: ['101', '101', '000', '000', '000', '000', '000', '000'] },
  '(': { width: 2, pixels: ['01', '10', '10', '10', '10', '10', '01', '00'] },
  ')': { width: 2, pixels: ['10', '01', '01', '01', '01', '01', '10', '00'] },
  '-': { width: 4, pixels: ['0000', '0000', '0000', '1111', '0000', '0000', '0000', '0000'] },
  '+': { width: 5, pixels: ['00000', '00100', '00100', '11111', '00100', '00100', '00000', '00000'] },
  '=': { width: 4, pixels: ['0000', '0000', '1111', '0000', '1111', '0000', '0000', '0000'] },
  '#': { width: 5, pixels: ['01010', '01010', '11111', '01010', '11111', '01010', '01010', '00000'] },
  '@': { width: 5, pixels: ['01110', '10001', '10111', '10101', '10110', '10000', '01110', '00000'] },
  '&': { width: 5, pixels: ['01100', '10010', '10100', '01000', '10101', '10010', '01101', '00000'] },
  '/': { width: 3, pixels: ['001', '001', '010', '010', '010', '100', '100', '000'] },
  ':': { width: 1, pixels: ['0', '0', '1', '0', '0', '1', '0', '0'] },
  ';': { width: 2, pixels: ['00', '00', '01', '00', '00', '01', '01', '10'] },
};

// Scale template to target size
function scaleTemplate(template: { width: number; pixels: string[] }, targetHeight: number): { width: number; pixels: boolean[][] } {
  const sourceHeight = 8; // Templates are 8px

  if (targetHeight === sourceHeight) {
    return {
      width: template.width,
      pixels: template.pixels.map(row => row.split('').map(c => c === '1')),
    };
  }

  const scale = targetHeight / sourceHeight;
  const newWidth = Math.max(1, Math.round(template.width * scale));
  const newPixels: boolean[][] = [];

  for (let y = 0; y < targetHeight; y++) {
    const sourceY = Math.floor(y / scale);
    const row: boolean[] = [];
    for (let x = 0; x < newWidth; x++) {
      const sourceX = Math.floor(x / scale);
      const sourceRow = template.pixels[Math.min(sourceY, template.pixels.length - 1)] || '';
      row.push(sourceRow[Math.min(sourceX, sourceRow.length - 1)] === '1');
    }
    newPixels.push(row);
  }

  return { width: newWidth, pixels: newPixels };
}

// Get template for a character at a given size
function getCharTemplate(char: string, height: number): { width: number; pixels: boolean[][] } | null {
  const template = CHAR_TEMPLATES_8PX[char];
  if (!template) return null;
  return scaleTemplate(template, height);
}

export function BitmapFontEditor({ isOpen, onClose }: BitmapFontEditorProps) {
  // Font management
  const [selectedFontName, setSelectedFontName] = useState(() =>
    bitmapFonts.length > 0 ? bitmapFonts[0].family : 'New Font'
  );
  const [newFontName, setNewFontName] = useState('');
  const [showNewFontInput, setShowNewFontInput] = useState(false);

  // Character editing
  const [selectedChar, setSelectedChar] = useState('A');
  const [gridWidth, setGridWidth] = useState(5);
  const [gridHeight, setGridHeight] = useState(8);
  const [pixels, setPixels] = useState<boolean[][]>(() =>
    Array(8).fill(null).map(() => Array(5).fill(false))
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<'draw' | 'erase'>('draw');
  const [exportedCode, setExportedCode] = useState('');
  const [importCode, setImportCode] = useState('');

  // Get available fonts (existing + ability to create new)
  const existingFonts = bitmapFonts.map(f => f.family);

  // Load existing glyph data when font or character changes
  useEffect(() => {
    const font = bitmapFonts.find(f => f.family === selectedFontName);
    if (font) {
      // Try to find glyph in any available size
      for (const sizeData of font.sizes) {
        if (sizeData.glyphs[selectedChar]) {
          const glyph = sizeData.glyphs[selectedChar];
          setGridWidth(glyph.width);
          setGridHeight(glyph.pixels.length);
          setPixels(glyph.pixels.map(row =>
            row.split('').map(c => c === '1')
          ));
          return;
        }
      }
    }
    // No existing data - use template as starting point (default 8px height)
    const template = getCharTemplate(selectedChar, 8);
    if (template) {
      setGridWidth(template.width);
      setGridHeight(template.pixels.length);
      setPixels(template.pixels);
    } else {
      // No template available - use empty grid with default height
      setGridHeight(8);
      setPixels(Array(8).fill(null).map(() => Array(gridWidth).fill(false)));
    }
  }, [selectedChar, selectedFontName]);

  const handleWidthChange = (newWidth: number) => {
    setGridWidth(newWidth);
    setPixels(prev => prev.map(row => {
      const newRow = [...row];
      while (newRow.length < newWidth) newRow.push(false);
      return newRow.slice(0, newWidth);
    }));
  };

  const handleHeightChange = (newHeight: number) => {
    setGridHeight(newHeight);
    setPixels(prev => {
      const newPixels: boolean[][] = [];
      for (let y = 0; y < newHeight; y++) {
        if (y < prev.length) {
          newPixels.push([...prev[y]]);
        } else {
          newPixels.push(Array(gridWidth).fill(false));
        }
      }
      return newPixels;
    });
  };

  // Handle pixel toggle - uses current drawMode
  const togglePixel = useCallback((x: number, y: number, mode: 'draw' | 'erase') => {
    setPixels(prev => {
      const newPixels = prev.map(row => [...row]);
      newPixels[y][x] = mode === 'draw';
      return newPixels;
    });
  }, []);

  const handleMouseDown = (x: number, y: number) => {
    // Determine draw mode based on current pixel state
    const newMode = pixels[y][x] ? 'erase' : 'draw';
    setDrawMode(newMode);
    setIsDrawing(true);
    // Directly use the new mode instead of relying on state
    togglePixel(x, y, newMode);
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (isDrawing) {
      togglePixel(x, y, drawMode);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Clear grid
  const clearGrid = () => {
    setPixels(Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false)));
  };

  // Invert grid
  const invertGrid = () => {
    setPixels(prev => prev.map(row => row.map(p => !p)));
  };

  // Load template for current character at current grid height
  const loadTemplate = () => {
    const template = getCharTemplate(selectedChar, gridHeight);
    if (template) {
      setGridWidth(template.width);
      setPixels(template.pixels);
    }
  };

  // Create new font
  const handleCreateFont = () => {
    if (newFontName.trim()) {
      setSelectedFontName(newFontName.trim());
      setNewFontName('');
      setShowNewFontInput(false);
    }
  };

  // Export current glyph as TypeScript code
  const exportGlyph = () => {
    const pixelStrings = pixels.map(row =>
      "'" + row.map(p => p ? '1' : '0').join('') + "'"
    );
    const code = `'${selectedChar}': { width: ${gridWidth}, pixels: [
  ${pixelStrings.join(',\n  ')},
]},`;
    setExportedCode(code);
  };

  // Export full font structure
  const exportFullFont = () => {
    const font = bitmapFonts.find(f => f.family === selectedFontName);

    let code = `{
  family: '${selectedFontName}',
  description: 'Custom bitmap font',
  category: 'bitmap',
  sizes: [
    {
      height: ${gridHeight},
      glyphs: {`;

    if (font) {
      const sizeData = font.sizes.find(s => s.height === gridHeight);
      if (sizeData) {
        const entries = Object.entries(sizeData.glyphs).map(([char, glyph]) => {
          const pixelStrings = glyph.pixels.map(row => `'${row}'`);
          return `\n        '${char}': { width: ${glyph.width}, pixels: [\n          ${pixelStrings.join(',\n          ')},\n        ]},`;
        });
        code += entries.join('');
      }
    }

    code += `
      },
    },
  ],
},`;

    setExportedCode(code);
  };

  // Import glyph from code
  const importGlyph = () => {
    try {
      // Parse simple format: ['01110', '10001', ...]
      const match = importCode.match(/\[([\s\S]*?)\]/);
      if (match) {
        const pixelArrayStr = match[1];
        const rows = pixelArrayStr.match(/'([01]+)'/g);
        if (rows) {
          const newPixels = rows.map(row => {
            const cleanRow = row.replace(/'/g, '');
            return cleanRow.split('').map(c => c === '1');
          });
          setGridWidth(newPixels[0]?.length ?? 5);
          setPixels(newPixels);
        }
      }
    } catch (e) {
      console.error('Failed to import glyph:', e);
    }
  };

  if (!isOpen) return null;

  const cellSize = Math.min(40, Math.floor(400 / Math.max(gridWidth, gridHeight)));

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-100"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="bg-white rounded-lg shadow-xl w-[1000px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-yellow-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-800 rounded font-mono">DEV TOOL</span>
              <h2 className="text-lg font-semibold text-gray-900">Bitmap Font Editor</h2>
            </div>

            {/* Font Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Font:</label>
              <select
                value={selectedFontName}
                onChange={(e) => setSelectedFontName(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                {existingFonts.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {!existingFonts.includes(selectedFontName) && (
                  <option value={selectedFontName}>{selectedFontName} (new)</option>
                )}
              </select>
              <button
                onClick={() => setShowNewFontInput(!showNewFontInput)}
                className="px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                + New
              </button>
            </div>

          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ×
          </button>
        </div>

        {/* New Font Name Input */}
        {showNewFontInput && (
          <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2">
            <input
              type="text"
              value={newFontName}
              onChange={(e) => setNewFontName(e.target.value)}
              placeholder="Enter new font name..."
              className="flex-1 px-3 py-1 border border-gray-300 rounded"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFont()}
            />
            <button
              onClick={handleCreateFont}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewFontInput(false)}
              className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Character Selection */}
          <div className="w-48 border-r border-gray-200 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Character</h3>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_CHARS.split('').map((char, idx) => (
                <button
                  key={`${char}-${idx}`}
                  onClick={() => setSelectedChar(char)}
                  className={`w-8 h-8 flex items-center justify-center text-sm font-mono border rounded ${
                    selectedChar === char
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {char === ' ' ? '␣' : char}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Char</label>
              <input
                type="text"
                maxLength={1}
                value={selectedChar}
                onChange={(e) => e.target.value && setSelectedChar(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-center font-mono text-lg"
              />
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={loadTemplate}
                className="w-full px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                title="Load the default template for this character"
              >
                Load Template
              </button>
              <button
                onClick={clearGrid}
                className="w-full px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                Clear
              </button>
              <button
                onClick={invertGrid}
                className="w-full px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              >
                Invert
              </button>
            </div>
          </div>

          {/* Center Panel - Grid Editor */}
          <div className="flex-1 p-4 flex flex-col items-center justify-center bg-gray-50">
            <div className="mb-4 text-center">
              <div className="text-sm text-gray-500 mb-1">{selectedFontName}</div>
              <span className="text-2xl font-mono">{selectedChar === ' ' ? '(space)' : selectedChar}</span>
            </div>

            {/* Dimension Controls */}
            <div className="mb-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Width:</label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={gridWidth}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    handleWidthChange(Math.max(1, Math.min(32, val)));
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center font-mono"
                />
              </div>
              <span className="text-gray-400">×</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Height:</label>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={gridHeight}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    handleHeightChange(Math.max(1, Math.min(48, val)));
                  }}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center font-mono"
                />
              </div>
            </div>

            <div
              className="inline-block border-2 border-gray-400 bg-white"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridWidth}, ${cellSize}px)`,
                gap: '1px',
                backgroundColor: '#e5e7eb',
              }}
            >
              {pixels.map((row, y) =>
                row.map((filled, x) => (
                  <div
                    key={`${x}-${y}`}
                    onMouseDown={() => handleMouseDown(x, y)}
                    onMouseEnter={() => handleMouseEnter(x, y)}
                    className={`cursor-crosshair transition-colors ${
                      filled ? 'bg-gray-900' : 'bg-white hover:bg-gray-100'
                    }`}
                    style={{ width: cellSize, height: cellSize }}
                  />
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Click and drag to draw. Click on filled pixel to erase.
            </div>
          </div>

          {/* Right Panel - Export/Import */}
          <div className="w-72 border-l border-gray-200 p-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Export</h3>
            <div className="space-y-2 mb-4">
              <button
                onClick={exportGlyph}
                className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Export This Glyph
              </button>
              <button
                onClick={exportFullFont}
                className="w-full px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Export Full Font
              </button>
            </div>

            {exportedCode && (
              <div className="mb-4">
                <textarea
                  readOnly
                  value={exportedCode}
                  className="w-full h-48 text-xs font-mono p-2 border border-gray-300 rounded bg-gray-50"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(exportedCode);
                  }}
                  className="mt-1 w-full px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Copy to Clipboard
                </button>
              </div>
            )}

            <h3 className="text-sm font-medium text-gray-700 mb-2">Import</h3>
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="Paste pixel array here...&#10;['01110', '10001', ...]"
              className="w-full h-24 text-xs font-mono p-2 border border-gray-300 rounded"
            />
            <button
              onClick={importGlyph}
              className="mt-2 w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Import
            </button>

            <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <p className="font-medium mb-1">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select or create a font</li>
                <li>Choose size (height)</li>
                <li>Select character to edit</li>
                <li>Draw pixels on the grid</li>
                <li>Export and paste into bitmapFonts.ts</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
