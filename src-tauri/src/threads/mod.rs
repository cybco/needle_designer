// Thread Library Module
// Provides thread color data and color matching algorithms

pub mod color_matching;
pub mod dmc;
pub mod anchor;
pub mod kreinik;

use serde::{Deserialize, Serialize};

/// Unified thread color representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadColor {
    pub code: String,
    pub name: String,
    pub rgb: [u8; 3],
    pub brand: ThreadBrand,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// Supported thread brands
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreadBrand {
    DMC,
    Anchor,
    Kreinik,
}

impl ThreadBrand {
    pub fn as_str(&self) -> &'static str {
        match self {
            ThreadBrand::DMC => "DMC",
            ThreadBrand::Anchor => "Anchor",
            ThreadBrand::Kreinik => "Kreinik",
        }
    }
}

impl std::fmt::Display for ThreadBrand {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Get all threads for a specific brand
pub fn get_threads_by_brand(brand: ThreadBrand) -> Vec<ThreadColor> {
    match brand {
        ThreadBrand::DMC => dmc::get_dmc_threads(),
        ThreadBrand::Anchor => anchor::get_anchor_threads(),
        ThreadBrand::Kreinik => kreinik::get_kreinik_threads(),
    }
}

/// Get all available threads from all brands
pub fn get_all_threads() -> Vec<ThreadColor> {
    let mut threads = Vec::new();
    threads.extend(dmc::get_dmc_threads());
    threads.extend(anchor::get_anchor_threads());
    threads.extend(kreinik::get_kreinik_threads());
    threads
}

/// Thread library metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadLibraryInfo {
    pub brand: ThreadBrand,
    pub name: String,
    pub description: String,
    pub color_count: usize,
}

/// Get available thread libraries
pub fn get_thread_libraries() -> Vec<ThreadLibraryInfo> {
    vec![
        ThreadLibraryInfo {
            brand: ThreadBrand::DMC,
            name: "DMC".to_string(),
            description: "DMC Cotton Embroidery Floss - Industry standard".to_string(),
            color_count: dmc::get_dmc_threads().len(),
        },
        ThreadLibraryInfo {
            brand: ThreadBrand::Anchor,
            name: "Anchor Stranded".to_string(),
            description: "Anchor Stranded Cotton - Popular alternative".to_string(),
            color_count: anchor::get_anchor_threads().len(),
        },
        ThreadLibraryInfo {
            brand: ThreadBrand::Kreinik,
            name: "Kreinik Metallics".to_string(),
            description: "Kreinik Metallic Threads - Premium metallics".to_string(),
            color_count: kreinik::get_kreinik_threads().len(),
        },
    ]
}
