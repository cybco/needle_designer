// Unified Thread Library Interface
// Provides a common interface for all thread brands

import { dmcThreads, ThreadColor as DMCThreadColor } from './dmcThreads';
import { anchorThreads, AnchorThreadColor } from './anchorThreads';
import { kreinikThreads, KreinikThreadColor, KreinikType } from './kreinikThreads';

// Thread brands available in the application
export type ThreadBrand = 'DMC' | 'Anchor' | 'Kreinik';

// Unified thread color interface
export interface UnifiedThreadColor {
  code: string;
  name: string;
  rgb: [number, number, number];
  brand: ThreadBrand;
  category?: string; // Optional category/type info
}

// Thread library metadata
export interface ThreadLibraryInfo {
  brand: ThreadBrand;
  name: string;
  description: string;
  colorCount: number;
}

// Get all available thread libraries
export function getThreadLibraries(): ThreadLibraryInfo[] {
  return [
    {
      brand: 'DMC',
      name: 'DMC Mouliné',
      description: 'DMC Cotton Embroidery Floss - Industry standard for cross-stitch and embroidery',
      colorCount: dmcThreads.length,
    },
    {
      brand: 'Anchor',
      name: 'Anchor Stranded',
      description: 'Anchor Stranded Cotton - Popular alternative with excellent color range',
      colorCount: anchorThreads.length,
    },
    {
      brand: 'Kreinik',
      name: 'Kreinik Metallics',
      description: 'Kreinik Metallic Threads - Premium metallic and specialty threads',
      colorCount: kreinikThreads.length,
    },
  ];
}

// Convert DMC thread to unified format
function dmcToUnified(thread: DMCThreadColor): UnifiedThreadColor {
  return {
    code: thread.code,
    name: thread.name,
    rgb: thread.rgb,
    brand: 'DMC',
    category: thread.category,
  };
}

// Convert Anchor thread to unified format
function anchorToUnified(thread: AnchorThreadColor): UnifiedThreadColor {
  return {
    code: thread.code,
    name: thread.name,
    rgb: thread.rgb,
    brand: 'Anchor',
  };
}

// Convert Kreinik thread to unified format
function kreinikToUnified(thread: KreinikThreadColor): UnifiedThreadColor {
  return {
    code: thread.code,
    name: thread.name,
    rgb: thread.rgb,
    brand: 'Kreinik',
    category: thread.type,
  };
}

// Get threads for a specific brand
export function getThreadsByBrand(brand: ThreadBrand): UnifiedThreadColor[] {
  switch (brand) {
    case 'DMC':
      return dmcThreads.map(dmcToUnified);
    case 'Anchor':
      return anchorThreads.map(anchorToUnified);
    case 'Kreinik':
      return kreinikThreads.map(kreinikToUnified);
    default:
      return [];
  }
}

// Get all threads from all libraries
export function getAllThreads(): UnifiedThreadColor[] {
  return [
    ...dmcThreads.map(dmcToUnified),
    ...anchorThreads.map(anchorToUnified),
    ...kreinikThreads.map(kreinikToUnified),
  ];
}

// Get threads for multiple brands
export function getThreadsForBrands(brands: ThreadBrand[]): UnifiedThreadColor[] {
  return brands.flatMap(brand => getThreadsByBrand(brand));
}

// Search threads by name or code
export function searchThreads(
  query: string,
  brands?: ThreadBrand[]
): UnifiedThreadColor[] {
  const threads = brands ? getThreadsForBrands(brands) : getAllThreads();
  const lowerQuery = query.toLowerCase();

  return threads.filter(
    thread =>
      thread.code.toLowerCase().includes(lowerQuery) ||
      thread.name.toLowerCase().includes(lowerQuery)
  );
}

// Get thread by exact code and brand
export function getThreadByCode(
  code: string,
  brand: ThreadBrand
): UnifiedThreadColor | undefined {
  const threads = getThreadsByBrand(brand);
  return threads.find(t => t.code === code);
}

// Convert threads to palette format for color matching
export function threadsToPalette(
  threads: UnifiedThreadColor[]
): Array<{ id: string; rgb: [number, number, number]; name: string }> {
  return threads.map(t => ({
    id: `${t.brand}-${t.code}`,
    rgb: t.rgb,
    name: `${t.brand} ${t.code} - ${t.name}`,
  }));
}

// Get Kreinik type name for display
export function getKreinikTypeName(type: KreinikType): string {
  const typeNames: Record<KreinikType, string> = {
    'blending-filament': 'Blending Filament',
    'braid': 'Braid',
    'ribbon': 'Ribbon',
    'cord': 'Cord',
    'japan': 'Japan Thread',
    'silk': 'Silk',
  };
  return typeNames[type] || type;
}

// Brand display names
export function getBrandDisplayName(brand: ThreadBrand): string {
  const brandNames: Record<ThreadBrand, string> = {
    'DMC': 'DMC Mouliné',
    'Anchor': 'Anchor Stranded',
    'Kreinik': 'Kreinik Metallics',
  };
  return brandNames[brand];
}

// Export raw thread arrays for backward compatibility
export { dmcThreads, anchorThreads, kreinikThreads };
