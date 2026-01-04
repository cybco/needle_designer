// Advanced Color Matching Algorithms
// Implements various color distance algorithms for thread matching

use serde::{Deserialize, Serialize};

/// Color matching algorithm types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColorMatchAlgorithm {
    Euclidean,
    Weighted,
    #[serde(rename = "cie76")]
    Cie76,
    #[serde(rename = "cie94")]
    Cie94,
    #[serde(rename = "ciede2000")]
    Ciede2000,
}

impl Default for ColorMatchAlgorithm {
    fn default() -> Self {
        ColorMatchAlgorithm::Ciede2000
    }
}

/// LAB color space representation
#[derive(Debug, Clone, Copy)]
pub struct Lab {
    pub l: f64,
    pub a: f64,
    pub b: f64,
}

/// Convert RGB to XYZ color space (D65 illuminant)
fn rgb_to_xyz(rgb: [u8; 3]) -> (f64, f64, f64) {
    // Normalize RGB values
    let mut r = rgb[0] as f64 / 255.0;
    let mut g = rgb[1] as f64 / 255.0;
    let mut b = rgb[2] as f64 / 255.0;

    // Apply gamma correction (sRGB)
    r = if r > 0.04045 {
        ((r + 0.055) / 1.055).powf(2.4)
    } else {
        r / 12.92
    };
    g = if g > 0.04045 {
        ((g + 0.055) / 1.055).powf(2.4)
    } else {
        g / 12.92
    };
    b = if b > 0.04045 {
        ((b + 0.055) / 1.055).powf(2.4)
    } else {
        b / 12.92
    };

    // Scale to 0-100
    r *= 100.0;
    g *= 100.0;
    b *= 100.0;

    // Convert to XYZ using sRGB matrix (D65)
    let x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    let y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    let z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;

    (x, y, z)
}

/// Convert XYZ to LAB color space (D65 illuminant)
fn xyz_to_lab(xyz: (f64, f64, f64)) -> Lab {
    // D65 reference white
    const REF_X: f64 = 95.047;
    const REF_Y: f64 = 100.000;
    const REF_Z: f64 = 108.883;

    let mut x = xyz.0 / REF_X;
    let mut y = xyz.1 / REF_Y;
    let mut z = xyz.2 / REF_Z;

    // Apply f function
    const EPSILON: f64 = 0.008856;
    const KAPPA: f64 = 903.3;

    x = if x > EPSILON {
        x.cbrt()
    } else {
        (KAPPA * x + 16.0) / 116.0
    };
    y = if y > EPSILON {
        y.cbrt()
    } else {
        (KAPPA * y + 16.0) / 116.0
    };
    z = if z > EPSILON {
        z.cbrt()
    } else {
        (KAPPA * z + 16.0) / 116.0
    };

    Lab {
        l: 116.0 * y - 16.0,
        a: 500.0 * (x - y),
        b: 200.0 * (y - z),
    }
}

/// Convert RGB to LAB color space
pub fn rgb_to_lab(rgb: [u8; 3]) -> Lab {
    xyz_to_lab(rgb_to_xyz(rgb))
}

/// Simple Euclidean distance in RGB space
pub fn euclidean_distance(c1: [u8; 3], c2: [u8; 3]) -> f64 {
    let dr = c1[0] as f64 - c2[0] as f64;
    let dg = c1[1] as f64 - c2[1] as f64;
    let db = c1[2] as f64 - c2[2] as f64;
    (dr * dr + dg * dg + db * db).sqrt()
}

/// Weighted Euclidean distance in RGB space
/// Better approximation of human color perception
pub fn weighted_rgb_distance(c1: [u8; 3], c2: [u8; 3]) -> f64 {
    let rmean = (c1[0] as f64 + c2[0] as f64) / 2.0;
    let dr = c1[0] as f64 - c2[0] as f64;
    let dg = c1[1] as f64 - c2[1] as f64;
    let db = c1[2] as f64 - c2[2] as f64;

    // Weights based on red channel mean
    let wr = 2.0 + rmean / 256.0;
    let wg = 4.0;
    let wb = 2.0 + (255.0 - rmean) / 256.0;

    (wr * dr * dr + wg * dg * dg + wb * db * db).sqrt()
}

/// CIE76 Delta E - Euclidean distance in LAB space
pub fn delta_e76(c1: [u8; 3], c2: [u8; 3]) -> f64 {
    let lab1 = rgb_to_lab(c1);
    let lab2 = rgb_to_lab(c2);

    let dl = lab1.l - lab2.l;
    let da = lab1.a - lab2.a;
    let db = lab1.b - lab2.b;

    (dl * dl + da * da + db * db).sqrt()
}

/// CIE94 Delta E - Improved perceptual uniformity
/// Better than CIE76 for textiles and graphics
pub fn delta_e94(c1: [u8; 3], c2: [u8; 3]) -> f64 {
    let lab1 = rgb_to_lab(c1);
    let lab2 = rgb_to_lab(c2);

    let dl = lab1.l - lab2.l;
    let da = lab1.a - lab2.a;
    let db = lab1.b - lab2.b;

    let c1_chroma = (lab1.a * lab1.a + lab1.b * lab1.b).sqrt();
    let c2_chroma = (lab2.a * lab2.a + lab2.b * lab2.b).sqrt();
    let dc = c1_chroma - c2_chroma;

    let dh2 = da * da + db * db - dc * dc;
    let dh = if dh2 > 0.0 { dh2.sqrt() } else { 0.0 };

    // Weighting factors for textiles
    let kl = 2.0;
    let k1 = 0.048;
    let k2 = 0.014;

    let sl = 1.0;
    let sc = 1.0 + k1 * c1_chroma;
    let sh = 1.0 + k2 * c1_chroma;

    let term1 = dl / (kl * sl);
    let term2 = dc / sc;
    let term3 = dh / sh;

    (term1 * term1 + term2 * term2 + term3 * term3).sqrt()
}

/// CIEDE2000 Delta E - Most accurate perceptual color difference
/// Industry standard for color matching applications
pub fn delta_e2000(c1: [u8; 3], c2: [u8; 3]) -> f64 {
    let lab1 = rgb_to_lab(c1);
    let lab2 = rgb_to_lab(c2);

    let l1 = lab1.l;
    let a1 = lab1.a;
    let b1 = lab1.b;
    let l2 = lab2.l;
    let a2 = lab2.a;
    let b2 = lab2.b;

    // Calculate C and h values
    let c1_chroma = (a1 * a1 + b1 * b1).sqrt();
    let c2_chroma = (a2 * a2 + b2 * b2).sqrt();
    let c_avg = (c1_chroma + c2_chroma) / 2.0;

    let c_avg_pow7 = c_avg.powi(7);
    let g = 0.5 * (1.0 - (c_avg_pow7 / (c_avg_pow7 + 25.0_f64.powi(7))).sqrt());

    let a1p = a1 * (1.0 + g);
    let a2p = a2 * (1.0 + g);

    let c1p = (a1p * a1p + b1 * b1).sqrt();
    let c2p = (a2p * a2p + b2 * b2).sqrt();

    let h1p = b1.atan2(a1p).to_degrees();
    let h2p = b2.atan2(a2p).to_degrees();

    let h1pn = if h1p >= 0.0 { h1p } else { h1p + 360.0 };
    let h2pn = if h2p >= 0.0 { h2p } else { h2p + 360.0 };

    // Calculate differences
    let dl_p = l2 - l1;
    let dc_p = c2p - c1p;

    let dhp = if c1p * c2p == 0.0 {
        0.0
    } else if (h2pn - h1pn).abs() <= 180.0 {
        h2pn - h1pn
    } else if h2pn - h1pn > 180.0 {
        h2pn - h1pn - 360.0
    } else {
        h2pn - h1pn + 360.0
    };

    let dh_p = 2.0 * (c1p * c2p).sqrt() * (dhp.to_radians() / 2.0).sin();

    // Calculate averages
    let lp = (l1 + l2) / 2.0;
    let cp = (c1p + c2p) / 2.0;

    let hp = if c1p * c2p == 0.0 {
        h1pn + h2pn
    } else if (h1pn - h2pn).abs() <= 180.0 {
        (h1pn + h2pn) / 2.0
    } else if h1pn + h2pn < 360.0 {
        (h1pn + h2pn + 360.0) / 2.0
    } else {
        (h1pn + h2pn - 360.0) / 2.0
    };

    // Calculate T
    let t = 1.0
        - 0.17 * (hp - 30.0).to_radians().cos()
        + 0.24 * (2.0 * hp).to_radians().cos()
        + 0.32 * (3.0 * hp + 6.0).to_radians().cos()
        - 0.20 * (4.0 * hp - 63.0).to_radians().cos();

    // Calculate weighting functions
    let lp_minus_50_sq = (lp - 50.0).powi(2);
    let sl = 1.0 + (0.015 * lp_minus_50_sq) / (20.0 + lp_minus_50_sq).sqrt();
    let sc = 1.0 + 0.045 * cp;
    let sh = 1.0 + 0.015 * cp * t;

    let d_theta = 30.0 * (-((hp - 275.0) / 25.0).powi(2)).exp();
    let cp_pow7 = cp.powi(7);
    let rc = 2.0 * (cp_pow7 / (cp_pow7 + 25.0_f64.powi(7))).sqrt();
    let rt = -rc * (2.0 * d_theta).to_radians().sin();

    // Calculate final delta E
    let kl = 1.0;
    let kc = 1.0;
    let kh = 1.0;

    let term1 = dl_p / (kl * sl);
    let term2 = dc_p / (kc * sc);
    let term3 = dh_p / (kh * sh);

    (term1 * term1 + term2 * term2 + term3 * term3 + rt * term2 * term3).sqrt()
}

/// Calculate color distance using the specified algorithm
pub fn color_distance(c1: [u8; 3], c2: [u8; 3], algorithm: ColorMatchAlgorithm) -> f64 {
    match algorithm {
        ColorMatchAlgorithm::Euclidean => euclidean_distance(c1, c2),
        ColorMatchAlgorithm::Weighted => weighted_rgb_distance(c1, c2),
        ColorMatchAlgorithm::Cie76 => delta_e76(c1, c2),
        ColorMatchAlgorithm::Cie94 => delta_e94(c1, c2),
        ColorMatchAlgorithm::Ciede2000 => delta_e2000(c1, c2),
    }
}

/// Result of finding the closest color match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorMatch {
    pub color: [u8; 3],
    pub color_id: String,
    pub distance: f64,
    pub name: String,
}

/// Find the closest matching color from a palette
pub fn find_closest_color(
    target: [u8; 3],
    palette: &[(String, [u8; 3], String)], // (id, rgb, name)
    algorithm: ColorMatchAlgorithm,
) -> Option<ColorMatch> {
    if palette.is_empty() {
        return None;
    }

    let mut best_match: Option<ColorMatch> = None;
    let mut best_distance = f64::MAX;

    for (id, rgb, name) in palette {
        let distance = color_distance(target, *rgb, algorithm);
        if distance < best_distance {
            best_distance = distance;
            best_match = Some(ColorMatch {
                color: *rgb,
                color_id: id.clone(),
                distance,
                name: name.clone(),
            });
        }
    }

    best_match
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgb_to_lab() {
        // Test white
        let lab = rgb_to_lab([255, 255, 255]);
        assert!((lab.l - 100.0).abs() < 0.1);
        assert!(lab.a.abs() < 0.1);
        assert!(lab.b.abs() < 0.1);

        // Test black
        let lab = rgb_to_lab([0, 0, 0]);
        assert!(lab.l.abs() < 0.1);
    }

    #[test]
    fn test_delta_e2000() {
        // Same color should have distance 0
        let dist = delta_e2000([128, 128, 128], [128, 128, 128]);
        assert!(dist.abs() < 0.001);

        // Very different colors should have large distance
        let dist = delta_e2000([255, 0, 0], [0, 255, 0]);
        assert!(dist > 50.0);
    }
}
