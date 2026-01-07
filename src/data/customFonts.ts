// Custom fonts storage - persisted to localStorage

export interface CustomGlyph {
  width: number;
  pixels: string[];
}

export interface CustomFontSize {
  height: number;
  glyphs: Record<string, CustomGlyph>;
}

export interface CustomFont {
  family: string;
  description: string;
  category: 'custom';
  sizes: CustomFontSize[];
  createdAt: number;
  updatedAt: number;
}

const CUSTOM_FONTS_KEY = 'needle-designer-custom-fonts';

// Get all custom fonts from localStorage
export function getCustomFonts(): CustomFont[] {
  try {
    const stored = localStorage.getItem(CUSTOM_FONTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save all custom fonts to localStorage
function saveCustomFonts(fonts: CustomFont[]): void {
  localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(fonts));
}

// Get a specific custom font by name
export function getCustomFont(family: string): CustomFont | undefined {
  return getCustomFonts().find(f => f.family === family);
}

// Check if a custom font exists
export function hasCustomFont(family: string): boolean {
  return getCustomFonts().some(f => f.family === family);
}

// Save or update a custom font
export function saveCustomFont(font: CustomFont): void {
  const fonts = getCustomFonts();
  const existingIndex = fonts.findIndex(f => f.family === font.family);

  if (existingIndex >= 0) {
    fonts[existingIndex] = { ...font, updatedAt: Date.now() };
  } else {
    fonts.push({ ...font, createdAt: Date.now(), updatedAt: Date.now() });
  }

  saveCustomFonts(fonts);
}

// Delete a custom font
export function deleteCustomFont(family: string): void {
  const fonts = getCustomFonts().filter(f => f.family !== family);
  saveCustomFonts(fonts);
}

// Save a single glyph to a custom font
export function saveGlyphToFont(
  fontFamily: string,
  char: string,
  glyph: CustomGlyph,
  height: number
): void {
  const fonts = getCustomFonts();
  let font = fonts.find(f => f.family === fontFamily);

  if (!font) {
    // Create new font
    font = {
      family: fontFamily,
      description: 'Custom font',
      category: 'custom',
      sizes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    fonts.push(font);
  }

  // Find or create the size entry
  let sizeEntry = font.sizes.find(s => s.height === height);
  if (!sizeEntry) {
    sizeEntry = { height, glyphs: {} };
    font.sizes.push(sizeEntry);
  }

  // Save the glyph
  sizeEntry.glyphs[char] = glyph;
  font.updatedAt = Date.now();

  saveCustomFonts(fonts);
}

// Get glyph from custom font
export function getCustomGlyph(
  fontFamily: string,
  char: string,
  height: number
): CustomGlyph | undefined {
  const font = getCustomFont(fontFamily);
  if (!font) return undefined;

  const sizeEntry = font.sizes.find(s => s.height === height);
  return sizeEntry?.glyphs[char];
}

// Rename a custom font
export function renameCustomFont(oldName: string, newName: string): boolean {
  if (hasCustomFont(newName)) return false; // Name already exists

  const fonts = getCustomFonts();
  const font = fonts.find(f => f.family === oldName);
  if (font) {
    font.family = newName;
    font.updatedAt = Date.now();
    saveCustomFonts(fonts);
    return true;
  }
  return false;
}
