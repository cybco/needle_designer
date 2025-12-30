// 10 popular fonts that are bundled with the app for offline use
// These fonts are loaded from Google Fonts CDN on app startup

export interface BundledFont {
  family: string;
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace';
  weights: number[];
  googleUrl: string;
}

export const bundledFonts: BundledFont[] = [
  {
    family: 'Roboto',
    category: 'sans-serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap',
  },
  {
    family: 'Open Sans',
    category: 'sans-serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap',
  },
  {
    family: 'Lato',
    category: 'sans-serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap',
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap',
  },
  {
    family: 'Merriweather',
    category: 'serif',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
  },
  {
    family: 'Pacifico',
    category: 'handwriting',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
  },
  {
    family: 'Dancing Script',
    category: 'handwriting',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap',
  },
  {
    family: 'Bebas Neue',
    category: 'display',
    weights: [400],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  },
  {
    family: 'Courier Prime',
    category: 'monospace',
    weights: [400, 700],
    googleUrl: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap',
  },
];

// Load all bundled fonts on app startup
export function loadBundledFonts(): void {
  bundledFonts.forEach((font) => {
    const link = document.createElement('link');
    link.href = font.googleUrl;
    link.rel = 'stylesheet';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// Check if a font is loaded and ready to use
export function isFontLoaded(fontFamily: string): boolean {
  return document.fonts.check(`16px "${fontFamily}"`);
}

// Wait for a specific font to load
export async function waitForFont(fontFamily: string, weight: number = 400): Promise<boolean> {
  try {
    await document.fonts.load(`${weight} 16px "${fontFamily}"`);
    return true;
  } catch {
    return false;
  }
}
