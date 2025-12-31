import { Color, Stitch } from '../stores/patternStore';

// Symbol tiers from docs/symbol-reference.md
export const PATTERN_SYMBOLS = {
  tier1: ['●', '■', '▲', '★', '◆', '✕', '♦', '♥'],
  tier2: ['○', '□', '△', '☆', '◇', '✚', '⬡', '♠'],
  tier3: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  tier4: ['◐', '◑', '◒', '◓', '⊕', '⊗', '⊞', '⊠'],

  // Combined in order of assignment
  all: [
    '●', '■', '▲', '★', '◆', '✕', '♦', '♥',
    '○', '□', '△', '☆', '◇', '✚', '⬡', '♠',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
    'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
    'Y', 'Z', '1', '2', '3', '4', '5', '6',
    '7', '8', '9', '0',
    '◐', '◑', '◒', '◓', '⊕', '⊗', '⊞', '⊠',
  ],

  // High contrast subset for accessibility
  highContrast: ['●', '○', '■', '▲', '▼', '✕', '✚', '★'],
};

// Symbol metadata for display in UI
export interface SymbolInfo {
  symbol: string;
  name: string;
  set: number;
  bestFor?: string;
}

export const SYMBOL_INFO: SymbolInfo[] = [
  // Set 1
  { symbol: '●', name: 'Black Circle', set: 1, bestFor: 'Dark colors' },
  { symbol: '■', name: 'Black Square', set: 1, bestFor: 'Bold colors' },
  { symbol: '▲', name: 'Black Triangle', set: 1, bestFor: 'Warm colors' },
  { symbol: '★', name: 'Black Star', set: 1, bestFor: 'Accent colors' },
  { symbol: '◆', name: 'Black Diamond', set: 1, bestFor: 'Medium tones' },
  { symbol: '✕', name: 'Multiplication X', set: 1, bestFor: 'Neutral colors' },
  { symbol: '♦', name: 'Diamond Suit', set: 1, bestFor: 'Rich colors' },
  { symbol: '♥', name: 'Heart Suit', set: 1, bestFor: 'Reds/Pinks' },
  // Set 2
  { symbol: '○', name: 'White Circle', set: 2, bestFor: 'Light colors' },
  { symbol: '□', name: 'White Square', set: 2, bestFor: 'Pastels' },
  { symbol: '△', name: 'White Triangle', set: 2, bestFor: 'Light warm tones' },
  { symbol: '☆', name: 'White Star', set: 2, bestFor: 'Highlights' },
  { symbol: '◇', name: 'White Diamond', set: 2, bestFor: 'Light accents' },
  { symbol: '✚', name: 'Heavy Greek Cross', set: 2, bestFor: 'Greens' },
  { symbol: '⬡', name: 'White Hexagon', set: 2, bestFor: 'Blues' },
  { symbol: '♠', name: 'Spade Suit', set: 2, bestFor: 'Dark accents' },
  // Set 3 - Letters
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({
    symbol: letter,
    name: `Letter ${letter}`,
    set: 3,
  })),
  // Numbers
  ...'1234567890'.split('').map(num => ({
    symbol: num,
    name: `Number ${num}`,
    set: 3,
  })),
  // Set 4
  { symbol: '◐', name: 'Circle Left Half', set: 4 },
  { symbol: '◑', name: 'Circle Right Half', set: 4 },
  { symbol: '◒', name: 'Circle Bottom Half', set: 4 },
  { symbol: '◓', name: 'Circle Top Half', set: 4 },
  { symbol: '⊕', name: 'Circled Plus', set: 4 },
  { symbol: '⊗', name: 'Circled Times', set: 4 },
  { symbol: '⊞', name: 'Squared Plus', set: 4 },
  { symbol: '⊠', name: 'Squared Times', set: 4 },
];

// Calculate color lightness (0-100) using HSL formula
export function getColorLightness(rgb: [number, number, number]): number {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return ((max + min) / 2) * 100;
}

// Get appropriate symbol based on color lightness
export function getSymbolForLightness(lightness: number, index: number): string {
  const filled = ['●', '■', '▲', '◆', '★'];
  const outline = ['○', '□', '△', '◇', '☆'];
  const symbols = lightness < 50 ? filled : outline;
  return symbols[index % symbols.length];
}

// Count stitches per color
export function countStitchesByColor(stitches: Stitch[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stitch of stitches) {
    counts.set(stitch.colorId, (counts.get(stitch.colorId) || 0) + 1);
  }
  return counts;
}

export type SymbolAssignmentMode = 'usage' | 'lightness' | 'sequential';

// Auto-assign symbols to colors
export function autoAssignSymbols(
  colors: Color[],
  stitches: Stitch[],
  mode: SymbolAssignmentMode = 'usage'
): Color[] {
  const stitchCounts = countStitchesByColor(stitches);
  const usedSymbols = new Set<string>();

  // Sort colors based on mode
  let sortedColors: Color[];
  switch (mode) {
    case 'usage':
      // Most-used colors get Tier 1 symbols
      sortedColors = [...colors].sort((a, b) => {
        const countA = stitchCounts.get(a.id) || 0;
        const countB = stitchCounts.get(b.id) || 0;
        return countB - countA; // Descending by usage
      });
      break;
    case 'lightness':
      // Dark colors first (get filled symbols), light colors last (get outline symbols)
      sortedColors = [...colors].sort((a, b) => {
        const lightnessA = getColorLightness(a.rgb);
        const lightnessB = getColorLightness(b.rgb);
        return lightnessA - lightnessB; // Ascending by lightness
      });
      break;
    case 'sequential':
    default:
      sortedColors = [...colors];
      break;
  }

  // Assign symbols
  const assignedColors: Color[] = [];
  for (const color of sortedColors) {
    let symbol: string;

    if (mode === 'lightness') {
      // Use lightness-based symbol selection
      const lightness = getColorLightness(color.rgb);
      let symbolIndex = 0;
      do {
        symbol = getSymbolForLightness(lightness, symbolIndex);
        symbolIndex++;
      } while (usedSymbols.has(symbol) && symbolIndex < 100);

      // Fallback to sequential if all lightness-based symbols are used
      if (usedSymbols.has(symbol)) {
        for (const s of PATTERN_SYMBOLS.all) {
          if (!usedSymbols.has(s)) {
            symbol = s;
            break;
          }
        }
      }
    } else {
      // Sequential assignment from all symbols
      symbol = PATTERN_SYMBOLS.all[assignedColors.length % PATTERN_SYMBOLS.all.length];
      // Find first unused symbol
      for (const s of PATTERN_SYMBOLS.all) {
        if (!usedSymbols.has(s)) {
          symbol = s;
          break;
        }
      }
    }

    usedSymbols.add(symbol);
    assignedColors.push({ ...color, symbol });
  }

  // Return in original order
  return colors.map(originalColor => {
    const assigned = assignedColors.find(c => c.id === originalColor.id);
    return assigned || originalColor;
  });
}

// Check if a symbol is available (not used by other colors)
export function isSymbolAvailable(
  symbol: string,
  colorId: string,
  colors: Color[]
): boolean {
  return !colors.some(c => c.id !== colorId && c.symbol === symbol);
}

// Get list of available symbols for a color
export function getAvailableSymbols(colorId: string, colors: Color[]): string[] {
  const usedSymbols = new Set(
    colors
      .filter(c => c.id !== colorId && c.symbol)
      .map(c => c.symbol!)
  );
  return PATTERN_SYMBOLS.all.filter(s => !usedSymbols.has(s));
}

// Validate that all colors have unique symbols
export function validateSymbolAssignment(colors: Color[]): {
  valid: boolean;
  duplicates: string[];
  missing: string[];
} {
  const symbolCounts = new Map<string, number>();
  const missing: string[] = [];

  for (const color of colors) {
    if (!color.symbol) {
      missing.push(color.id);
    } else {
      symbolCounts.set(color.symbol, (symbolCounts.get(color.symbol) || 0) + 1);
    }
  }

  const duplicates = Array.from(symbolCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([symbol]) => symbol);

  return {
    valid: duplicates.length === 0 && missing.length === 0,
    duplicates,
    missing,
  };
}

// Get the next available symbol for a new color
export function getNextAvailableSymbol(existingColors: Color[]): string {
  const usedSymbols = new Set(
    existingColors
      .filter(c => c.symbol)
      .map(c => c.symbol!)
  );

  for (const symbol of PATTERN_SYMBOLS.all) {
    if (!usedSymbols.has(symbol)) {
      return symbol;
    }
  }

  // Fallback if all symbols are used (unlikely with 50+ symbols)
  return PATTERN_SYMBOLS.all[existingColors.length % PATTERN_SYMBOLS.all.length];
}

// Assign symbols to colors that don't have them
export function assignMissingSymbols(colors: Color[]): Color[] {
  const usedSymbols = new Set(
    colors
      .filter(c => c.symbol)
      .map(c => c.symbol!)
  );

  return colors.map(color => {
    if (color.symbol) {
      return color;
    }

    // Find next available symbol
    for (const symbol of PATTERN_SYMBOLS.all) {
      if (!usedSymbols.has(symbol)) {
        usedSymbols.add(symbol);
        return { ...color, symbol };
      }
    }

    // Fallback
    return color;
  });
}
