import { useState, useMemo, useCallback } from 'react';
import { usePatternStore, Color } from '../stores/patternStore';
import {
  ColorMatchAlgorithm,
  findClosestColors,
  getColorDifferenceCategory,
  rgbToLab,
  labToRgb,
  LAB,
} from '../utils/colorMatching';
import { EyedropperButton } from './EyedropperButton';
import {
  ThreadBrand,
  getThreadLibraries,
  getThreadsByBrand,
  threadsToPalette,
} from '../data/threadLibrary';

interface ColorMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialColor?: [number, number, number];
}

type ColorInputMode = 'hex' | 'rgb' | 'lab';

export function ColorMatchDialog({ isOpen, onClose, initialColor }: ColorMatchDialogProps) {
  const { pattern, addColor } = usePatternStore();

  // Color input state
  const [inputMode, setInputMode] = useState<ColorInputMode>('hex');
  const [pickerColor, setPickerColor] = useState(
    initialColor ? `#${initialColor.map(c => c.toString(16).padStart(2, '0')).join('')}` : '#ff0000'
  );
  const [rgbInput, setRgbInput] = useState<[number, number, number]>(initialColor || [255, 0, 0]);
  const [labInput, setLabInput] = useState<LAB>(() =>
    initialColor ? rgbToLab(initialColor) : rgbToLab([255, 0, 0])
  );

  // Algorithm selection
  const [algorithm, setAlgorithm] = useState<ColorMatchAlgorithm>('ciede2000');

  // Number of matches to show
  const [matchCount, setMatchCount] = useState(10);

  // Thread library selection
  const [matchSource, setMatchSource] = useState<'palette' | 'library'>('palette');
  const [selectedThreadBrand, setSelectedThreadBrand] = useState<ThreadBrand>('DMC');

  // Notification state
  const [notification, setNotification] = useState<string | null>(null);

  // Get the current target color based on input mode
  const targetColor = useMemo((): [number, number, number] => {
    switch (inputMode) {
      case 'hex': {
        const hex = pickerColor.replace('#', '');
        return [
          parseInt(hex.substring(0, 2), 16) || 0,
          parseInt(hex.substring(2, 4), 16) || 0,
          parseInt(hex.substring(4, 6), 16) || 0,
        ];
      }
      case 'rgb':
        return rgbInput;
      case 'lab':
        return labToRgb(labInput);
    }
  }, [inputMode, pickerColor, rgbInput, labInput]);

  // Find matching colors from the current palette or thread library
  const matches = useMemo(() => {
    let palette: Array<{ id: string; rgb: [number, number, number]; name: string }>;

    if (matchSource === 'library') {
      // Match against selected thread library
      const threads = getThreadsByBrand(selectedThreadBrand);
      palette = threadsToPalette(threads);
    } else {
      // Match against current pattern palette
      if (!pattern) return [];
      palette = pattern.colorPalette.map(c => ({ id: c.id, rgb: c.rgb, name: c.name }));
    }

    return findClosestColors(targetColor, palette, matchCount, algorithm);
  }, [targetColor, pattern, matchCount, algorithm, matchSource, selectedThreadBrand]);

  // Handle hex color change
  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let hex = e.target.value.toUpperCase();
    // Allow # prefix but normalize it
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    // Only allow valid hex characters
    hex = '#' + hex.slice(1).replace(/[^0-9A-F]/gi, '').slice(0, 6);
    setPickerColor(hex);

    // Sync to other modes if we have a complete hex
    const cleanHex = hex.slice(1);
    if (cleanHex.length === 6) {
      const r = parseInt(cleanHex.substring(0, 2), 16);
      const g = parseInt(cleanHex.substring(2, 4), 16);
      const b = parseInt(cleanHex.substring(4, 6), 16);
      setRgbInput([r, g, b]);
      setLabInput(rgbToLab([r, g, b]));
    }
  }, []);

  // Handle RGB input change
  const handleRgbChange = useCallback((channel: 0 | 1 | 2, value: string) => {
    const numValue = Math.max(0, Math.min(255, parseInt(value) || 0));
    const newRgb: [number, number, number] = [...rgbInput];
    newRgb[channel] = numValue;
    setRgbInput(newRgb);
    setPickerColor(`#${newRgb.map(c => c.toString(16).padStart(2, '0')).join('')}`);
    setLabInput(rgbToLab(newRgb));
  }, [rgbInput]);

  // Handle LAB input change
  const handleLabChange = useCallback((channel: 0 | 1 | 2, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newLab: LAB = [...labInput];
    // L: 0-100, a: -128 to 127, b: -128 to 127
    if (channel === 0) {
      newLab[0] = Math.max(0, Math.min(100, numValue));
    } else {
      newLab[channel] = Math.max(-128, Math.min(127, numValue));
    }
    setLabInput(newLab);
    const rgb = labToRgb(newLab);
    setRgbInput(rgb);
    setPickerColor(`#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`);
  }, [labInput]);

  // Show notification with auto-dismiss
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Add color to palette
  const handleAddToPalette = useCallback(() => {
    if (!pattern) return;

    // Check if color already exists in palette (by RGB values)
    const existsInPalette = pattern.colorPalette.some(
      c => c.rgb[0] === targetColor[0] && c.rgb[1] === targetColor[1] && c.rgb[2] === targetColor[2]
    );

    if (existsInPalette) {
      showNotification(`RGB(${targetColor.join(', ')}) is already in palette`);
      return;
    }

    const newColor: Color = {
      id: `color-${Date.now()}`,
      name: `Custom ${targetColor.join(',')}`,
      rgb: targetColor,
    };
    addColor(newColor);
    showNotification(`Added RGB(${targetColor.join(', ')}) to palette`);
  }, [pattern, targetColor, addColor, showNotification]);

  // Add a matched color to the palette if not already there
  const handleSelectMatch = useCallback((colorId: string, colorName?: string, colorRgb?: [number, number, number]) => {
    if (!pattern || !colorRgb) return;

    // Check if color already exists in palette (by RGB values)
    const existsInPalette = pattern.colorPalette.some(
      c => c.rgb[0] === colorRgb[0] && c.rgb[1] === colorRgb[1] && c.rgb[2] === colorRgb[2]
    );

    if (existsInPalette) {
      showNotification(`"${colorName || colorId}" is already in palette`);
    } else {
      const newColor: Color = {
        id: `color-${Date.now()}`,
        name: colorName || `Color ${colorId}`,
        rgb: colorRgb,
      };
      addColor(newColor);
      showNotification(`Added "${colorName || colorId}" to palette`);
    }
  }, [pattern, addColor, showNotification]);

  // Handle eyedropper color pick
  const handleEyedropperPick = useCallback((rgb: [number, number, number]) => {
    setRgbInput(rgb);
    setPickerColor(`#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`);
    setLabInput(rgbToLab(rgb));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header with notification */}
        <div className="flex items-center justify-between mb-4 h-8">
          <h2 className="text-lg font-semibold text-gray-800">Color Matching</h2>
          <div
            className={`px-3 py-1 bg-green-100 border border-green-300 text-green-800 rounded-lg text-sm flex items-center gap-2 transition-opacity duration-200 ${
              notification ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="whitespace-nowrap">{notification || '\u00A0'}</span>
          </div>
        </div>

        {/* Target Color Input */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Target Color</h3>

          {/* Input mode tabs */}
          <div className="flex gap-2 mb-3 flex-wrap items-center">
            {(['hex', 'rgb', 'lab'] as ColorInputMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`px-3 py-1 text-sm rounded ${
                  inputMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
            <div className="ml-2 border-l border-gray-300 pl-2">
              <EyedropperButton onColorPicked={handleEyedropperPick} />
            </div>
          </div>

          {/* Color preview and input */}
          <div className="flex gap-4 items-start">
            {/* Color swatch */}
            <div className="text-center">
              <div
                className="w-20 h-20 rounded border border-gray-300 shadow-inner"
                style={{ backgroundColor: `rgb(${targetColor.join(',')})` }}
              />
              <div className="text-xs text-gray-500 mt-1 font-mono">
                RGB({targetColor[0]}, {targetColor[1]}, {targetColor[2]})
              </div>
            </div>

            {/* Input fields */}
            <div className="flex-1">
              {inputMode === 'hex' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hex Color</label>
                  <input
                    type="text"
                    value={pickerColor}
                    onChange={handleHexChange}
                    placeholder="#FF0000"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                    maxLength={7}
                  />
                  {pickerColor.length !== 7 && (
                    <div className="mt-1 text-xs text-amber-600">
                      Enter a 6-digit hex color (e.g., #FF0000)
                    </div>
                  )}
                </div>
              )}

              {inputMode === 'rgb' && (
                <div className="grid grid-cols-3 gap-2">
                  {['R', 'G', 'B'].map((label, i) => (
                    <div key={label}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type="number"
                        min="0"
                        max="255"
                        value={rgbInput[i as 0 | 1 | 2]}
                        onChange={(e) => handleRgbChange(i as 0 | 1 | 2, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {inputMode === 'lab' && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'L*', min: 0, max: 100 },
                    { label: 'a*', min: -128, max: 127 },
                    { label: 'b*', min: -128, max: 127 },
                  ].map((item, i) => (
                    <div key={item.label}>
                      <label className="block text-xs text-gray-500 mb-1">{item.label}</label>
                      <input
                        type="number"
                        min={item.min}
                        max={item.max}
                        step="0.1"
                        value={labInput[i as 0 | 1 | 2].toFixed(1)}
                        onChange={(e) => handleLabChange(i as 0 | 1 | 2, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleAddToPalette}
                className="mt-2 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Add to Palette
              </button>
            </div>
          </div>
        </div>

        {/* Match source and algorithm selection */}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Match Against</label>
            <select
              value={matchSource}
              onChange={(e) => setMatchSource(e.target.value as 'palette' | 'library')}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="palette">Current Palette</option>
              <option value="library">Thread Library</option>
            </select>
          </div>

          {matchSource === 'library' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Thread Library</label>
              <select
                value={selectedThreadBrand}
                onChange={(e) => setSelectedThreadBrand(e.target.value as ThreadBrand)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                {getThreadLibraries().map(lib => (
                  <option key={lib.brand} value={lib.brand}>
                    {lib.name} ({lib.colorCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as ColorMatchAlgorithm)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="ciede2000">CIEDE2000 (Most Accurate)</option>
              <option value="cie94">CIE94 (Textile)</option>
              <option value="cie76">CIE76 (Standard)</option>
              <option value="weighted">Weighted RGB</option>
              <option value="euclidean">Simple RGB</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Results</label>
            <select
              value={matchCount}
              onChange={(e) => setMatchCount(parseInt(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">All</option>
            </select>
          </div>
        </div>

        {/* Matching colors */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Closest Matches {matchSource === 'library' ? `from ${selectedThreadBrand}` : 'from Palette'}
            {matches.length > 0 && ` (${matches.length})`}
          </h3>

          {matches.length === 0 ? (
            <p className="text-sm text-gray-500">
              {matchSource === 'library'
                ? 'No matching colors found in the thread library.'
                : 'No colors in palette to match against.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {matches.map((match, index) => (
                <button
                  key={match.colorId}
                  onClick={() => handleSelectMatch(match.colorId, match.name, match.color)}
                  className="flex items-center gap-3 p-2 rounded border border-gray-200 hover:bg-gray-50 text-left"
                >
                  <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                  <div
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: `rgb(${match.color.join(',')})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {match.name || `Color ${match.colorId}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      ΔE = {match.distance.toFixed(2)} ({getColorDifferenceCategory(match.distance)})
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      RGB({match.color[0]}, {match.color[1]}, {match.color[2]})
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Color difference guide */}
        <div className="mb-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
          <strong>Delta E Guide:</strong>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            <span>{'< 1: Imperceptible'}</span>
            <span>{'1-2: Very close'}</span>
            <span>{'2-3.5: Close'}</span>
            <span>{'3.5-5: Noticeable'}</span>
            <span>{'5-10: Different'}</span>
            <span>{'>10: Very different'}</span>
          </div>
        </div>

        {/* Dialog actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
