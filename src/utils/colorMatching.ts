/**
 * Advanced Color Matching Algorithms
 *
 * Provides various algorithms for finding the closest matching colors
 * from a palette, useful for color reduction and thread matching.
 */

export type RGB = [number, number, number];
export type LAB = [number, number, number];

/**
 * Color matching algorithm types
 */
export type ColorMatchAlgorithm =
  | 'euclidean'      // Simple RGB Euclidean distance
  | 'weighted'       // Weighted RGB (accounts for human perception)
  | 'cie76'          // CIE76 Delta E (LAB color space)
  | 'cie94'          // CIE94 Delta E (improved perceptual uniformity)
  | 'ciede2000';     // CIEDE2000 Delta E (most accurate perceptual)

/**
 * Convert RGB to XYZ color space (D65 illuminant)
 */
function rgbToXyz(rgb: RGB): [number, number, number] {
  // Normalize RGB values
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  // Apply gamma correction (sRGB)
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Scale to 0-100
  r *= 100;
  g *= 100;
  b *= 100;

  // Convert to XYZ using sRGB matrix (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

  return [x, y, z];
}

/**
 * Convert XYZ to LAB color space (D65 illuminant)
 */
function xyzToLab(xyz: [number, number, number]): LAB {
  // D65 reference white
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  let x = xyz[0] / refX;
  let y = xyz[1] / refY;
  let z = xyz[2] / refZ;

  // Apply f function
  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  const L = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return [L, a, b];
}

/**
 * Convert RGB to LAB color space
 */
export function rgbToLab(rgb: RGB): LAB {
  return xyzToLab(rgbToXyz(rgb));
}

/**
 * Convert LAB to XYZ color space
 */
function labToXyz(lab: LAB): [number, number, number] {
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  let y = (lab[0] + 16) / 116;
  let x = lab[1] / 500 + y;
  let z = y - lab[2] / 200;

  const epsilon = 0.008856;
  const kappa = 903.3;

  const x3 = x * x * x;
  const z3 = z * z * z;

  x = x3 > epsilon ? x3 : (116 * x - 16) / kappa;
  y = lab[0] > kappa * epsilon ? Math.pow((lab[0] + 16) / 116, 3) : lab[0] / kappa;
  z = z3 > epsilon ? z3 : (116 * z - 16) / kappa;

  return [x * refX, y * refY, z * refZ];
}

/**
 * Convert XYZ to RGB color space
 */
function xyzToRgb(xyz: [number, number, number]): RGB {
  const x = xyz[0] / 100;
  const y = xyz[1] / 100;
  const z = xyz[2] / 100;

  // XYZ to linear RGB
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Apply gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  // Clamp and scale to 0-255
  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255))),
  ];
}

/**
 * Convert LAB to RGB color space
 */
export function labToRgb(lab: LAB): RGB {
  return xyzToRgb(labToXyz(lab));
}

/**
 * Simple Euclidean distance in RGB space
 * Fast but not perceptually uniform
 */
export function euclideanDistance(color1: RGB, color2: RGB): number {
  const dr = color1[0] - color2[0];
  const dg = color1[1] - color2[1];
  const db = color1[2] - color2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Weighted Euclidean distance in RGB space
 * Better approximation of human color perception
 * Based on research by Thiadmer Riemersma
 */
export function weightedRgbDistance(color1: RGB, color2: RGB): number {
  const rmean = (color1[0] + color2[0]) / 2;
  const dr = color1[0] - color2[0];
  const dg = color1[1] - color2[1];
  const db = color1[2] - color2[2];

  // Weights based on red channel mean
  const wr = 2 + rmean / 256;
  const wg = 4;
  const wb = 2 + (255 - rmean) / 256;

  return Math.sqrt(wr * dr * dr + wg * dg * dg + wb * db * db);
}

/**
 * CIE76 Delta E - Euclidean distance in LAB space
 * Good perceptual uniformity, widely used
 */
export function deltaE76(color1: RGB, color2: RGB): number {
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);

  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];

  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * CIE94 Delta E - Improved perceptual uniformity
 * Better than CIE76 for textiles and graphics
 */
export function deltaE94(color1: RGB, color2: RGB, textiles: boolean = true): number {
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);

  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];

  const C1 = Math.sqrt(lab1[1] * lab1[1] + lab1[2] * lab1[2]);
  const C2 = Math.sqrt(lab2[1] * lab2[1] + lab2[2] * lab2[2]);
  const dC = C1 - C2;

  const dH2 = da * da + db * db - dC * dC;
  const dH = dH2 > 0 ? Math.sqrt(dH2) : 0;

  // Weighting factors (textiles vs graphic arts)
  const kL = textiles ? 2 : 1;
  const K1 = textiles ? 0.048 : 0.045;
  const K2 = textiles ? 0.014 : 0.015;

  const SL = 1;
  const SC = 1 + K1 * C1;
  const SH = 1 + K2 * C1;

  const term1 = dL / (kL * SL);
  const term2 = dC / SC;
  const term3 = dH / SH;

  return Math.sqrt(term1 * term1 + term2 * term2 + term3 * term3);
}

/**
 * CIEDE2000 Delta E - Most accurate perceptual color difference
 * Industry standard for color matching applications
 */
export function deltaE2000(color1: RGB, color2: RGB): number {
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);

  const L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
  const L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];

  // Calculate C and h values
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cavg = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cavg, 7) / (Math.pow(Cavg, 7) + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
  const h2p = Math.atan2(b2, a2p) * 180 / Math.PI;

  const h1pn = h1p >= 0 ? h1p : h1p + 360;
  const h2pn = h2p >= 0 ? h2p : h2p + 360;

  // Calculate differences
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2pn - h1pn) <= 180) {
    dhp = h2pn - h1pn;
  } else if (h2pn - h1pn > 180) {
    dhp = h2pn - h1pn - 360;
  } else {
    dhp = h2pn - h1pn + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

  // Calculate averages
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let Hp: number;
  if (C1p * C2p === 0) {
    Hp = h1pn + h2pn;
  } else if (Math.abs(h1pn - h2pn) <= 180) {
    Hp = (h1pn + h2pn) / 2;
  } else if (h1pn + h2pn < 360) {
    Hp = (h1pn + h2pn + 360) / 2;
  } else {
    Hp = (h1pn + h2pn - 360) / 2;
  }

  // Calculate T
  const T = 1 - 0.17 * Math.cos((Hp - 30) * Math.PI / 180) +
            0.24 * Math.cos(2 * Hp * Math.PI / 180) +
            0.32 * Math.cos((3 * Hp + 6) * Math.PI / 180) -
            0.20 * Math.cos((4 * Hp - 63) * Math.PI / 180);

  // Calculate weighting functions
  const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const dTheta = 30 * Math.exp(-Math.pow((Hp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)));
  const RT = -RC * Math.sin(2 * dTheta * Math.PI / 180);

  // Calculate final delta E
  const kL = 1, kC = 1, kH = 1;

  const term1 = dLp / (kL * SL);
  const term2 = dCp / (kC * SC);
  const term3 = dHp / (kH * SH);

  return Math.sqrt(term1 * term1 + term2 * term2 + term3 * term3 + RT * term2 * term3);
}

/**
 * Calculate color distance using the specified algorithm
 */
export function colorDistance(
  color1: RGB,
  color2: RGB,
  algorithm: ColorMatchAlgorithm = 'ciede2000'
): number {
  switch (algorithm) {
    case 'euclidean':
      return euclideanDistance(color1, color2);
    case 'weighted':
      return weightedRgbDistance(color1, color2);
    case 'cie76':
      return deltaE76(color1, color2);
    case 'cie94':
      return deltaE94(color1, color2, true);
    case 'ciede2000':
      return deltaE2000(color1, color2);
    default:
      return deltaE2000(color1, color2);
  }
}

export interface ColorMatch {
  color: RGB;
  colorId: string;
  distance: number;
  name?: string;
}

/**
 * Find the closest matching color from a palette
 */
export function findClosestColor(
  targetColor: RGB,
  palette: Array<{ id: string; rgb: RGB; name?: string }>,
  algorithm: ColorMatchAlgorithm = 'ciede2000'
): ColorMatch | null {
  if (palette.length === 0) return null;

  let bestMatch: ColorMatch | null = null;
  let bestDistance = Infinity;

  for (const paletteColor of palette) {
    const distance = colorDistance(targetColor, paletteColor.rgb, algorithm);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = {
        color: paletteColor.rgb,
        colorId: paletteColor.id,
        distance,
        name: paletteColor.name,
      };
    }
  }

  return bestMatch;
}

/**
 * Find the N closest matching colors from a palette
 */
export function findClosestColors(
  targetColor: RGB,
  palette: Array<{ id: string; rgb: RGB; name?: string }>,
  count: number = 5,
  algorithm: ColorMatchAlgorithm = 'ciede2000'
): ColorMatch[] {
  const matches: ColorMatch[] = palette.map(paletteColor => ({
    color: paletteColor.rgb,
    colorId: paletteColor.id,
    distance: colorDistance(targetColor, paletteColor.rgb, algorithm),
    name: paletteColor.name,
  }));

  // Sort by distance and return top N
  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, count);
}

/**
 * Reduce an array of colors to a limited palette using k-means clustering
 * with perceptual color distance
 */
export function reduceColorPalette(
  colors: RGB[],
  targetCount: number,
  _algorithm: ColorMatchAlgorithm = 'ciede2000',
  maxIterations: number = 20
): RGB[] {
  if (colors.length <= targetCount) {
    return [...colors];
  }

  // Initialize centroids using k-means++
  const centroids: LAB[] = [];
  const labColors = colors.map(rgbToLab);

  // First centroid: random selection
  centroids.push(labColors[Math.floor(Math.random() * labColors.length)]);

  // Subsequent centroids: probability proportional to distance squared
  while (centroids.length < targetCount) {
    const distances = labColors.map(lab => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        const dist = Math.sqrt(
          Math.pow(lab[0] - centroid[0], 2) +
          Math.pow(lab[1] - centroid[1], 2) +
          Math.pow(lab[2] - centroid[2], 2)
        );
        minDist = Math.min(minDist, dist);
      }
      return minDist * minDist;
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let target = Math.random() * totalDist;

    for (let i = 0; i < distances.length; i++) {
      target -= distances[i];
      if (target <= 0) {
        centroids.push(labColors[i]);
        break;
      }
    }
  }

  // K-means iteration
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign colors to nearest centroid
    const clusters: LAB[][] = Array.from({ length: targetCount }, () => []);

    for (const lab of labColors) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < centroids.length; c++) {
        const dist = Math.sqrt(
          Math.pow(lab[0] - centroids[c][0], 2) +
          Math.pow(lab[1] - centroids[c][1], 2) +
          Math.pow(lab[2] - centroids[c][2], 2)
        );
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }

      clusters[bestCluster].push(lab);
    }

    // Update centroids
    let converged = true;
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;

      const newL = clusters[c].reduce((sum, lab) => sum + lab[0], 0) / clusters[c].length;
      const newA = clusters[c].reduce((sum, lab) => sum + lab[1], 0) / clusters[c].length;
      const newB = clusters[c].reduce((sum, lab) => sum + lab[2], 0) / clusters[c].length;

      const moved = Math.abs(newL - centroids[c][0]) > 0.1 ||
                    Math.abs(newA - centroids[c][1]) > 0.1 ||
                    Math.abs(newB - centroids[c][2]) > 0.1;

      if (moved) {
        converged = false;
        centroids[c] = [newL, newA, newB];
      }
    }

    if (converged) break;
  }

  // Convert centroids back to RGB
  return centroids.map(labToRgb);
}

/**
 * Calculate the perceptual difference category
 */
export function getColorDifferenceCategory(deltaE: number): string {
  if (deltaE === 0) return 'exact match';
  if (deltaE < 1) return 'imperceptible';
  if (deltaE < 2) return 'very close';
  if (deltaE < 3.5) return 'close';
  if (deltaE < 5) return 'noticeable';
  if (deltaE < 10) return 'different';
  return 'very different';
}

/**
 * Calculate color harmony score between multiple colors
 * Returns a value from 0 (discordant) to 1 (harmonious)
 */
export function calculateColorHarmony(colors: RGB[]): number {
  if (colors.length < 2) return 1;

  const labColors = colors.map(rgbToLab);

  // Calculate hue angles and chroma values
  const hues: number[] = [];
  const chromas: number[] = [];

  for (const lab of labColors) {
    const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
    chromas.push(chroma);
    if (chroma > 0.1) {
      const hue = Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
      hues.push(hue >= 0 ? hue : hue + 360);
    }
  }

  if (hues.length < 2) {
    // Mostly achromatic colors - check lightness harmony
    const lightnesses = labColors.map(lab => lab[0]);
    const avgL = lightnesses.reduce((a, b) => a + b, 0) / lightnesses.length;
    const variance = lightnesses.reduce((sum, l) => sum + Math.pow(l - avgL, 2), 0) / lightnesses.length;
    return Math.max(0, 1 - variance / 2500);
  }

  // Check for complementary (180°), triadic (120°), or analogous (30°) relationships
  let harmonyScore = 0;
  let comparisons = 0;

  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const hueDiff = Math.abs(hues[i] - hues[j]);
      const normalizedDiff = Math.min(hueDiff, 360 - hueDiff);

      // Score based on harmonic relationships
      let pairScore = 0;
      if (normalizedDiff < 20) pairScore = 0.9;  // Monochromatic
      else if (normalizedDiff < 40) pairScore = 0.8;  // Analogous
      else if (normalizedDiff > 150 && normalizedDiff < 180) pairScore = 0.85;  // Complementary
      else if (normalizedDiff > 110 && normalizedDiff < 130) pairScore = 0.75;  // Triadic
      else if (normalizedDiff > 80 && normalizedDiff < 100) pairScore = 0.7;  // Square
      else pairScore = 0.5;  // Other

      harmonyScore += pairScore;
      comparisons++;
    }
  }

  return comparisons > 0 ? harmonyScore / comparisons : 1;
}
