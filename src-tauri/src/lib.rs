use serde::{Deserialize, Serialize};

// NDP File Format structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NdpFile {
    pub version: String,
    pub metadata: NdpMetadata,
    pub canvas: CanvasConfig,
    pub color_palette: Vec<Color>,
    pub layers: Vec<Layer>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NdpMetadata {
    pub name: String,
    pub author: Option<String>,
    pub created_at: String,
    pub modified_at: String,
    pub software: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CanvasConfig {
    pub width: u32,
    pub height: u32,
    pub mesh_count: u32,
    pub physical_width: Option<f64>,
    pub physical_height: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Color {
    pub id: String,
    pub name: String,
    pub rgb: [u8; 3],
    pub thread_brand: Option<String>,
    pub thread_code: Option<String>,
    pub symbol: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Layer {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub stitches: Vec<Stitch>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Stitch {
    pub x: u32,
    pub y: u32,
    pub color_id: String,
    pub completed: bool,
}

// Tauri commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to NeedlePoint Designer.", name)
}

#[tauri::command]
fn create_new_project(name: String, width: u32, height: u32, mesh_count: u32) -> Result<NdpFile, String> {
    let now = chrono_lite_now();

    Ok(NdpFile {
        version: "1.0".to_string(),
        metadata: NdpMetadata {
            name,
            author: None,
            created_at: now.clone(),
            modified_at: now,
            software: "NeedlePoint Designer v1.0".to_string(),
        },
        canvas: CanvasConfig {
            width,
            height,
            mesh_count,
            physical_width: None,
            physical_height: None,
        },
        color_palette: vec![],
        layers: vec![Layer {
            id: "layer-1".to_string(),
            name: "Layer 1".to_string(),
            visible: true,
            locked: false,
            stitches: vec![],
        }],
    })
}

// Simple timestamp function (no external crate needed)
fn chrono_lite_now() -> String {
    // Returns a placeholder - in production you'd use proper datetime
    "2025-01-01T00:00:00Z".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, create_new_project])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
