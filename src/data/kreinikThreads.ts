// Kreinik Metallic Thread Library
// Comprehensive collection of Kreinik metallic and specialty threads

export type KreinikType = 'blending-filament' | 'braid' | 'ribbon' | 'cord' | 'japan' | 'silk';

export interface KreinikThreadColor {
  code: string;
  name: string;
  rgb: [number, number, number];
  brand: 'Kreinik';
  type: KreinikType;
}

// Kreinik Metallic Threads - organized by color family
export const kreinikThreads: KreinikThreadColor[] = [
  // ============================================
  // GOLDS
  // ============================================
  { code: '002', name: 'Gold', rgb: [255, 215, 0], brand: 'Kreinik', type: 'braid' },
  { code: '002C', name: 'Gold Cord', rgb: [255, 215, 0], brand: 'Kreinik', type: 'cord' },
  { code: '002F', name: 'Gold Fine', rgb: [255, 215, 0], brand: 'Kreinik', type: 'blending-filament' },
  { code: '002HL', name: 'Gold Hi Lustre', rgb: [255, 220, 50], brand: 'Kreinik', type: 'braid' },
  { code: '002J', name: 'Japan Gold', rgb: [255, 210, 80], brand: 'Kreinik', type: 'japan' },
  { code: '002L', name: 'Gold Light', rgb: [255, 230, 100], brand: 'Kreinik', type: 'braid' },
  { code: '002P', name: 'Gold Pearl', rgb: [255, 225, 130], brand: 'Kreinik', type: 'braid' },
  { code: '002V', name: 'Vintage Gold', rgb: [200, 160, 60], brand: 'Kreinik', type: 'braid' },
  { code: '003HL', name: 'Red Gold Hi Lustre', rgb: [255, 180, 50], brand: 'Kreinik', type: 'braid' },
  { code: '021', name: 'Copper', rgb: [184, 115, 51], brand: 'Kreinik', type: 'braid' },
  { code: '021C', name: 'Copper Cord', rgb: [184, 115, 51], brand: 'Kreinik', type: 'cord' },
  { code: '021F', name: 'Copper Filament', rgb: [184, 115, 51], brand: 'Kreinik', type: 'blending-filament' },
  { code: '021HL', name: 'Copper Hi Lustre', rgb: [205, 135, 75], brand: 'Kreinik', type: 'braid' },
  { code: '202HL', name: 'Aztec Gold', rgb: [218, 165, 32], brand: 'Kreinik', type: 'braid' },
  { code: '205C', name: 'Antique Gold', rgb: [180, 145, 75], brand: 'Kreinik', type: 'cord' },
  { code: '205HL', name: 'Antique Gold Hi Lustre', rgb: [195, 160, 85], brand: 'Kreinik', type: 'braid' },
  { code: '221', name: 'Antique Gold Dark', rgb: [155, 120, 50], brand: 'Kreinik', type: 'braid' },
  { code: '3212', name: 'Citron', rgb: [210, 200, 70], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // SILVERS
  // ============================================
  { code: '001', name: 'Silver', rgb: [192, 192, 192], brand: 'Kreinik', type: 'braid' },
  { code: '001C', name: 'Silver Cord', rgb: [192, 192, 192], brand: 'Kreinik', type: 'cord' },
  { code: '001F', name: 'Silver Fine', rgb: [192, 192, 192], brand: 'Kreinik', type: 'blending-filament' },
  { code: '001HL', name: 'Silver Hi Lustre', rgb: [210, 210, 215], brand: 'Kreinik', type: 'braid' },
  { code: '001J', name: 'Japan Silver', rgb: [195, 195, 200], brand: 'Kreinik', type: 'japan' },
  { code: '001L', name: 'Silver Light', rgb: [220, 220, 225], brand: 'Kreinik', type: 'braid' },
  { code: '001P', name: 'Silver Pearl', rgb: [230, 230, 235], brand: 'Kreinik', type: 'braid' },
  { code: '001V', name: 'Vintage Silver', rgb: [160, 160, 165], brand: 'Kreinik', type: 'braid' },
  { code: '011HL', name: 'Nickel Hi Lustre', rgb: [175, 175, 180], brand: 'Kreinik', type: 'braid' },
  { code: '012', name: 'Pewter', rgb: [130, 130, 135], brand: 'Kreinik', type: 'braid' },
  { code: '012HL', name: 'Pewter Hi Lustre', rgb: [145, 145, 150], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // WHITES
  // ============================================
  { code: '032', name: 'Pearl', rgb: [255, 255, 255], brand: 'Kreinik', type: 'braid' },
  { code: '032C', name: 'Pearl Cord', rgb: [255, 255, 255], brand: 'Kreinik', type: 'cord' },
  { code: '032F', name: 'Pearl Fine', rgb: [255, 255, 255], brand: 'Kreinik', type: 'blending-filament' },
  { code: '032HL', name: 'Pearl Hi Lustre', rgb: [255, 255, 255], brand: 'Kreinik', type: 'braid' },
  { code: '100', name: 'White', rgb: [255, 255, 255], brand: 'Kreinik', type: 'braid' },
  { code: '100HL', name: 'White Hi Lustre', rgb: [255, 255, 255], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // BLACKS
  // ============================================
  { code: '005', name: 'Black', rgb: [0, 0, 0], brand: 'Kreinik', type: 'braid' },
  { code: '005C', name: 'Black Cord', rgb: [0, 0, 0], brand: 'Kreinik', type: 'cord' },
  { code: '005F', name: 'Black Fine', rgb: [0, 0, 0], brand: 'Kreinik', type: 'blending-filament' },
  { code: '005HL', name: 'Black Hi Lustre', rgb: [25, 25, 25], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // REDS
  // ============================================
  { code: '003', name: 'Red', rgb: [255, 0, 0], brand: 'Kreinik', type: 'braid' },
  { code: '003F', name: 'Red Fine', rgb: [255, 0, 0], brand: 'Kreinik', type: 'blending-filament' },
  { code: '003L', name: 'Red Light', rgb: [255, 80, 80], brand: 'Kreinik', type: 'braid' },
  { code: '003HL', name: 'Red Hi Lustre', rgb: [255, 40, 40], brand: 'Kreinik', type: 'braid' },
  { code: '031', name: 'Flame', rgb: [255, 100, 30], brand: 'Kreinik', type: 'braid' },
  { code: '031HL', name: 'Flame Hi Lustre', rgb: [255, 115, 45], brand: 'Kreinik', type: 'braid' },
  { code: '034', name: 'Fuschia', rgb: [255, 0, 128], brand: 'Kreinik', type: 'braid' },
  { code: '034HL', name: 'Fuschia Hi Lustre', rgb: [255, 30, 140], brand: 'Kreinik', type: 'braid' },
  { code: '042', name: 'Confetti Red', rgb: [220, 50, 50], brand: 'Kreinik', type: 'braid' },
  { code: '203HL', name: 'Flame Red', rgb: [255, 60, 20], brand: 'Kreinik', type: 'braid' },
  { code: '332', name: 'Christmas Red', rgb: [200, 0, 0], brand: 'Kreinik', type: 'braid' },
  { code: '332F', name: 'Christmas Red Fine', rgb: [200, 0, 0], brand: 'Kreinik', type: 'blending-filament' },
  { code: '333', name: 'Ruby', rgb: [155, 25, 50], brand: 'Kreinik', type: 'braid' },
  { code: '334', name: 'Cranberry', rgb: [130, 30, 50], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // PINKS
  // ============================================
  { code: '007', name: 'Pink', rgb: [255, 192, 203], brand: 'Kreinik', type: 'braid' },
  { code: '007HL', name: 'Pink Hi Lustre', rgb: [255, 200, 210], brand: 'Kreinik', type: 'braid' },
  { code: '024', name: 'Fuchsia', rgb: [255, 50, 150], brand: 'Kreinik', type: 'braid' },
  { code: '024HL', name: 'Fuchsia Hi Lustre', rgb: [255, 70, 160], brand: 'Kreinik', type: 'braid' },
  { code: '194', name: 'Pale Pink', rgb: [255, 220, 225], brand: 'Kreinik', type: 'braid' },
  { code: '9194', name: 'Star Pink', rgb: [255, 180, 200], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // ORANGES
  // ============================================
  { code: '006', name: 'Orange', rgb: [255, 165, 0], brand: 'Kreinik', type: 'braid' },
  { code: '006HL', name: 'Orange Hi Lustre', rgb: [255, 175, 30], brand: 'Kreinik', type: 'braid' },
  { code: '052', name: 'Grapefruit', rgb: [255, 130, 100], brand: 'Kreinik', type: 'braid' },
  { code: '321', name: 'Tangerine', rgb: [255, 145, 50], brand: 'Kreinik', type: 'braid' },
  { code: '326', name: 'Burnt Orange', rgb: [205, 95, 20], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // YELLOWS
  // ============================================
  { code: '091', name: 'Star Yellow', rgb: [255, 255, 100], brand: 'Kreinik', type: 'braid' },
  { code: '091HL', name: 'Star Yellow Hi Lustre', rgb: [255, 255, 120], brand: 'Kreinik', type: 'braid' },
  { code: '311', name: 'Sunlight', rgb: [255, 250, 150], brand: 'Kreinik', type: 'braid' },
  { code: '312', name: 'Sunflower', rgb: [255, 240, 80], brand: 'Kreinik', type: 'braid' },
  { code: '2122', name: 'Yellow Gold', rgb: [255, 220, 50], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // GREENS
  // ============================================
  { code: '008', name: 'Green', rgb: [0, 128, 0], brand: 'Kreinik', type: 'braid' },
  { code: '008HL', name: 'Green Hi Lustre', rgb: [30, 145, 30], brand: 'Kreinik', type: 'braid' },
  { code: '009', name: 'Emerald', rgb: [0, 155, 80], brand: 'Kreinik', type: 'braid' },
  { code: '009HL', name: 'Emerald Hi Lustre', rgb: [30, 170, 95], brand: 'Kreinik', type: 'braid' },
  { code: '015', name: 'Chartreuse', rgb: [180, 220, 50], brand: 'Kreinik', type: 'braid' },
  { code: '015HL', name: 'Chartreuse Hi Lustre', rgb: [195, 230, 70], brand: 'Kreinik', type: 'braid' },
  { code: '051', name: 'Peacock', rgb: [50, 130, 130], brand: 'Kreinik', type: 'braid' },
  { code: '051HL', name: 'Peacock Hi Lustre', rgb: [70, 145, 145], brand: 'Kreinik', type: 'braid' },
  { code: '053', name: 'Willow', rgb: [150, 190, 100], brand: 'Kreinik', type: 'braid' },
  { code: '322', name: 'Grass Green', rgb: [80, 160, 60], brand: 'Kreinik', type: 'braid' },
  { code: '334V', name: 'Vintage Emerald', rgb: [40, 120, 70], brand: 'Kreinik', type: 'braid' },
  { code: '3215', name: 'Leaf Green', rgb: [100, 150, 70], brand: 'Kreinik', type: 'braid' },
  { code: '3216', name: 'Pine', rgb: [45, 95, 55], brand: 'Kreinik', type: 'braid' },
  { code: '5982', name: 'Forest', rgb: [30, 80, 45], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // BLUES
  // ============================================
  { code: '006B', name: 'Blue', rgb: [0, 100, 200], brand: 'Kreinik', type: 'braid' },
  { code: '014', name: 'Sky Blue', rgb: [135, 206, 235], brand: 'Kreinik', type: 'braid' },
  { code: '014HL', name: 'Sky Blue Hi Lustre', rgb: [150, 215, 240], brand: 'Kreinik', type: 'braid' },
  { code: '022', name: 'Royal Blue', rgb: [65, 105, 225], brand: 'Kreinik', type: 'braid' },
  { code: '022HL', name: 'Royal Blue Hi Lustre', rgb: [80, 120, 235], brand: 'Kreinik', type: 'braid' },
  { code: '033', name: 'Confetti Blue', rgb: [100, 150, 220], brand: 'Kreinik', type: 'braid' },
  { code: '051B', name: 'Sapphire', rgb: [30, 70, 160], brand: 'Kreinik', type: 'braid' },
  { code: '051BHL', name: 'Sapphire Hi Lustre', rgb: [50, 90, 175], brand: 'Kreinik', type: 'braid' },
  { code: '052B', name: 'Colonial Blue', rgb: [80, 120, 180], brand: 'Kreinik', type: 'braid' },
  { code: '085', name: 'Peacock Blue', rgb: [0, 100, 140], brand: 'Kreinik', type: 'braid' },
  { code: '086', name: 'Midnight', rgb: [25, 40, 95], brand: 'Kreinik', type: 'braid' },
  { code: '095', name: 'Starburst', rgb: [100, 165, 215], brand: 'Kreinik', type: 'braid' },
  { code: '3514', name: 'Blue Ice', rgb: [180, 210, 240], brand: 'Kreinik', type: 'braid' },
  { code: '3515', name: 'Wedgewood', rgb: [100, 140, 190], brand: 'Kreinik', type: 'braid' },
  { code: '3545', name: 'Navy', rgb: [20, 35, 80], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // PURPLES
  // ============================================
  { code: '012P', name: 'Purple', rgb: [128, 0, 128], brand: 'Kreinik', type: 'braid' },
  { code: '012PHL', name: 'Purple Hi Lustre', rgb: [145, 30, 145], brand: 'Kreinik', type: 'braid' },
  { code: '016', name: 'Amethyst', rgb: [155, 90, 180], brand: 'Kreinik', type: 'braid' },
  { code: '016HL', name: 'Amethyst Hi Lustre', rgb: [170, 105, 195], brand: 'Kreinik', type: 'braid' },
  { code: '023', name: 'Lilac', rgb: [200, 160, 210], brand: 'Kreinik', type: 'braid' },
  { code: '023HL', name: 'Lilac Hi Lustre', rgb: [210, 175, 220], brand: 'Kreinik', type: 'braid' },
  { code: '026', name: 'Violet', rgb: [130, 80, 160], brand: 'Kreinik', type: 'braid' },
  { code: '026HL', name: 'Violet Hi Lustre', rgb: [145, 95, 175], brand: 'Kreinik', type: 'braid' },
  { code: '026L', name: 'Violet Light', rgb: [175, 130, 195], brand: 'Kreinik', type: 'braid' },
  { code: '3225', name: 'Orchid', rgb: [185, 110, 175], brand: 'Kreinik', type: 'braid' },
  { code: '3226', name: 'Grape', rgb: [100, 50, 100], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // BROWNS
  // ============================================
  { code: '024B', name: 'Brown', rgb: [139, 90, 43], brand: 'Kreinik', type: 'braid' },
  { code: '024BHL', name: 'Brown Hi Lustre', rgb: [155, 105, 60], brand: 'Kreinik', type: 'braid' },
  { code: '052V', name: 'Vintage Bronze', rgb: [135, 95, 55], brand: 'Kreinik', type: 'braid' },
  { code: '022B', name: 'Chestnut', rgb: [150, 85, 50], brand: 'Kreinik', type: 'braid' },
  { code: '222', name: 'Bronze', rgb: [165, 120, 70], brand: 'Kreinik', type: 'braid' },
  { code: '222HL', name: 'Bronze Hi Lustre', rgb: [180, 135, 85], brand: 'Kreinik', type: 'braid' },
  { code: '223', name: 'Antique Bronze', rgb: [140, 100, 60], brand: 'Kreinik', type: 'braid' },
  { code: '231', name: 'Autumn Brown', rgb: [125, 80, 45], brand: 'Kreinik', type: 'braid' },
  { code: '232', name: 'Chocolate', rgb: [90, 50, 30], brand: 'Kreinik', type: 'braid' },
  { code: '5125', name: 'Caramel', rgb: [175, 130, 80], brand: 'Kreinik', type: 'braid' },
  { code: '5215', name: 'Toffee', rgb: [155, 110, 65], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // SPECIALTY / GLOW IN DARK
  // ============================================
  { code: '052G', name: 'Glow White', rgb: [250, 255, 250], brand: 'Kreinik', type: 'braid' },
  { code: '054F', name: 'Glow Green', rgb: [180, 255, 180], brand: 'Kreinik', type: 'braid' },
  { code: '056F', name: 'Glow Orange', rgb: [255, 200, 150], brand: 'Kreinik', type: 'braid' },

  // ============================================
  // COLOR VARIEGATED
  // ============================================
  { code: '048', name: 'Confetti Rainbow', rgb: [255, 128, 128], brand: 'Kreinik', type: 'braid' },
  { code: '091V', name: 'Vintage Variegated', rgb: [200, 175, 130], brand: 'Kreinik', type: 'braid' },
];
