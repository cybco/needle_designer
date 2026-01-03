use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use resvg;
use screenshots::Screen;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::Path;
use tauri::Manager;

// NDP File Format structures
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NdpFile {
    pub version: String,
    pub metadata: NdpMetadata,
    pub canvas: CanvasConfig,
    pub color_palette: Vec<Color>,
    pub layers: Vec<Layer>,
    #[serde(default)]
    pub overlays: Option<Vec<OverlayImage>>,
    #[serde(default = "default_zoom")]
    pub zoom: Option<f64>,
    #[serde(default)]
    pub is_progress_mode: Option<bool>,
    #[serde(default)]
    pub progress_shading_color: Option<[u8; 3]>,
    #[serde(default = "default_shading_opacity")]
    pub progress_shading_opacity: Option<u32>,
}

fn default_zoom() -> Option<f64> {
    Some(1.0)
}

fn default_shading_opacity() -> Option<u32> {
    Some(70)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NdpMetadata {
    #[serde(default)]
    pub file_id: Option<String>, // Unique identifier for session history tracking
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OverlayImage {
    pub id: String,
    pub name: String,
    pub data_url: String,
    pub opacity: u32,
    pub visible: bool,
    pub locked: bool,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub natural_width: u32,
    pub natural_height: u32,
}

// Image processing structures
#[derive(Debug, Serialize, Deserialize)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub preview_base64: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedImage {
    pub width: u32,
    pub height: u32,
    pub colors: Vec<Color>,
    pub pixels: Vec<Vec<String>>, // color_id for each pixel
    pub preview_base64: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum DitherMode {
    None,
    FloydSteinberg,
    Ordered,
    Atkinson,
}

// Tauri commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to NeedlePoint Designer.", name)
}

#[tauri::command]
fn create_new_project(
    name: String,
    width: u32,
    height: u32,
    mesh_count: u32,
) -> Result<NdpFile, String> {
    let now = chrono_lite_now();

    Ok(NdpFile {
        version: "1.0".to_string(),
        metadata: NdpMetadata {
            file_id: None, // Will be set by frontend
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
        overlays: None,
        zoom: Some(1.0),
        is_progress_mode: Some(false),
        progress_shading_color: Some([128, 128, 128]),
        progress_shading_opacity: Some(70),
    })
}

/// Load an SVG file and render it to a DynamicImage
fn load_svg(path: &str) -> Result<DynamicImage, String> {
    let svg_data = fs::read(path).map_err(|e| format!("Failed to read SVG file: {}", e))?;

    let options = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_data(&svg_data, &options)
        .map_err(|e| format!("Failed to parse SVG: {}", e))?;

    let size = tree.size();
    let width = size.width() as u32;
    let height = size.height() as u32;

    if width == 0 || height == 0 {
        return Err("SVG has zero dimensions".to_string());
    }

    // Create a pixmap to render into
    let mut pixmap = resvg::tiny_skia::Pixmap::new(width, height)
        .ok_or("Failed to create pixmap")?;

    // Render the SVG
    resvg::render(&tree, resvg::tiny_skia::Transform::default(), &mut pixmap.as_mut());

    // Convert to RgbaImage
    let rgba_data = pixmap.data();
    let mut img = RgbaImage::new(width, height);

    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            // tiny_skia uses premultiplied alpha, need to unpremultiply
            let a = rgba_data[idx + 3];
            let (r, g, b) = if a > 0 {
                let a_f = a as f32 / 255.0;
                (
                    (rgba_data[idx] as f32 / a_f).min(255.0) as u8,
                    (rgba_data[idx + 1] as f32 / a_f).min(255.0) as u8,
                    (rgba_data[idx + 2] as f32 / a_f).min(255.0) as u8,
                )
            } else {
                (0, 0, 0)
            };
            img.put_pixel(x, y, Rgba([r, g, b, a]));
        }
    }

    Ok(DynamicImage::ImageRgba8(img))
}

/// Check if a path is an SVG file
fn is_svg_file(path: &str) -> bool {
    Path::new(path)
        .extension()
        .map(|ext| ext.to_ascii_lowercase() == "svg")
        .unwrap_or(false)
}

#[tauri::command]
fn load_image(path: String) -> Result<ImageInfo, String> {
    let img = if is_svg_file(&path) {
        load_svg(&path)?
    } else {
        image::open(&path).map_err(|e| format!("Failed to open image: {}", e))?
    };

    let (width, height) = img.dimensions();

    // Create a preview (max 400px)
    let preview = create_preview(&img, 400);
    let preview_base64 = image_to_base64(&preview)?;

    Ok(ImageInfo {
        width,
        height,
        preview_base64,
    })
}

#[tauri::command]
fn process_image(
    path: String,
    target_width: u32,
    target_height: u32,
    max_colors: u32,
    dither_mode: String,
    remove_background: bool,
    background_threshold: u8,
) -> Result<ProcessedImage, String> {
    let img = if is_svg_file(&path) {
        load_svg(&path)?
    } else {
        image::open(&path).map_err(|e| format!("Failed to open image: {}", e))?
    };

    // Resize to target dimensions
    let resized = img.resize_exact(
        target_width,
        target_height,
        image::imageops::FilterType::Lanczos3,
    );

    let rgba = resized.to_rgba8();

    // Extract colors and reduce palette
    let (quantized, palette) =
        quantize_colors(&rgba, max_colors as usize, remove_background, background_threshold);

    // Apply dithering
    let dither = match dither_mode.as_str() {
        "floyd-steinberg" => DitherMode::FloydSteinberg,
        "ordered" => DitherMode::Ordered,
        "atkinson" => DitherMode::Atkinson,
        _ => DitherMode::None,
    };

    let dithered = apply_dithering(&quantized, &palette, &dither);

    // Create color palette with IDs
    let colors: Vec<Color> = palette
        .iter()
        .enumerate()
        .filter(|(_, c)| !is_transparent(c))
        .map(|(i, c)| Color {
            id: format!("color-{}", i + 1),
            name: format!("Color {}", i + 1),
            rgb: [c[0], c[1], c[2]],
            thread_brand: None,
            thread_code: None,
            symbol: None,
        })
        .collect();

    // Create pixel map
    let mut pixels: Vec<Vec<String>> = Vec::with_capacity(target_height as usize);
    for y in 0..target_height {
        let mut row: Vec<String> = Vec::with_capacity(target_width as usize);
        for x in 0..target_width {
            let pixel = dithered.get_pixel(x, y);
            if is_transparent(pixel) || (remove_background && is_background(pixel, background_threshold)) {
                row.push("".to_string()); // Empty = no stitch
            } else {
                // Find matching color in palette
                let color_idx = find_closest_color(pixel, &palette);
                if color_idx < colors.len() {
                    row.push(colors[color_idx].id.clone());
                } else {
                    row.push("".to_string());
                }
            }
        }
        pixels.push(row);
    }

    // Create preview
    let preview_base64 = image_to_base64(&DynamicImage::ImageRgba8(dithered.clone()))?;

    Ok(ProcessedImage {
        width: target_width,
        height: target_height,
        colors,
        pixels,
        preview_base64,
    })
}

#[tauri::command]
fn save_project(path: String, project: NdpFile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn open_project(path: String) -> Result<NdpFile, String> {
    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let project: NdpFile = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    Ok(project)
}

#[tauri::command]
fn save_pdf(path: String, data: String) -> Result<(), String> {
    // Decode base64 data
    let bytes = STANDARD.decode(&data)
        .map_err(|e| format!("Failed to decode PDF data: {}", e))?;

    // Write to file
    fs::write(&path, bytes)
        .map_err(|e| format!("Failed to write PDF file: {}", e))?;

    Ok(())
}

#[tauri::command]
fn get_save_path(default_name: String) -> Result<Option<String>, String> {
    // This is a placeholder - actual file dialog will be handled in frontend
    Ok(Some(format!("{}.ndp", default_name)))
}

/// Get the color of the pixel at the specified screen coordinates
#[tauri::command]
fn pick_screen_color(x: i32, y: i32) -> Result<[u8; 3], String> {
    // Get all screens
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    // Find the screen containing this point
    for screen in screens {
        let info = screen.display_info;
        let screen_x = info.x;
        let screen_y = info.y;
        let screen_width = info.width as i32;
        let screen_height = info.height as i32;

        // Check if the point is within this screen
        if x >= screen_x && x < screen_x + screen_width &&
           y >= screen_y && y < screen_y + screen_height {
            // Capture a small region around the point (1x1 pixel)
            let local_x = (x - screen_x) as u32;
            let local_y = (y - screen_y) as u32;

            // Capture from this screen
            let capture = screen.capture_area(local_x as i32, local_y as i32, 1, 1)
                .map_err(|e| format!("Failed to capture screen: {}", e))?;

            // Get the pixel color from the captured image - use as_raw() to get pixel data
            let raw = capture.as_raw();
            if raw.len() >= 4 {
                // BGRA format on Windows
                return Ok([raw[2], raw[1], raw[0]]);
            }
        }
    }

    Err("Point not found on any screen".to_string())
}

/// Capture the primary screen and return as base64 encoded PNG
#[tauri::command]
fn capture_screen() -> Result<String, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    // Get the primary screen (first one)
    let screen = screens.into_iter().next()
        .ok_or("No screens found")?;

    // Capture the entire screen
    let capture = screen.capture()
        .map_err(|e| format!("Failed to capture screen: {}", e))?;

    // Convert to PNG and base64 encode
    let width = capture.width();
    let height = capture.height();
    let raw = capture.as_raw();

    // Create an RgbaImage from the raw data (BGRA -> RGBA)
    let mut rgba_data = Vec::with_capacity(raw.len());
    for chunk in raw.chunks(4) {
        if chunk.len() >= 4 {
            rgba_data.push(chunk[2]); // R
            rgba_data.push(chunk[1]); // G
            rgba_data.push(chunk[0]); // B
            rgba_data.push(chunk[3]); // A
        }
    }

    let img = RgbaImage::from_raw(width, height, rgba_data)
        .ok_or("Failed to create image from capture")?;

    let dynamic_img = DynamicImage::ImageRgba8(img);

    // Encode to PNG and base64
    let mut bytes: Vec<u8> = Vec::new();
    dynamic_img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;

    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

// Helper functions
fn chrono_lite_now() -> String {
    "2025-01-01T00:00:00Z".to_string()
}

fn create_preview(img: &DynamicImage, max_size: u32) -> DynamicImage {
    let (width, height) = img.dimensions();
    if width <= max_size && height <= max_size {
        return img.clone();
    }

    let ratio = (max_size as f64) / (width.max(height) as f64);
    let new_width = (width as f64 * ratio) as u32;
    let new_height = (height as f64 * ratio) as u32;

    img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3)
}

fn image_to_base64(img: &DynamicImage) -> Result<String, String> {
    let mut bytes: Vec<u8> = Vec::new();
    img.write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|e| format!("Failed to encode image: {}", e))?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

fn is_transparent(pixel: &Rgba<u8>) -> bool {
    pixel[3] < 128
}

fn is_background(pixel: &Rgba<u8>, threshold: u8) -> bool {
    // Consider near-white as background
    pixel[0] > 255 - threshold && pixel[1] > 255 - threshold && pixel[2] > 255 - threshold
}

fn color_distance(c1: &Rgba<u8>, c2: &Rgba<u8>) -> f64 {
    let dr = c1[0] as f64 - c2[0] as f64;
    let dg = c1[1] as f64 - c2[1] as f64;
    let db = c1[2] as f64 - c2[2] as f64;
    (dr * dr + dg * dg + db * db).sqrt()
}

fn find_closest_color(pixel: &Rgba<u8>, palette: &[Rgba<u8>]) -> usize {
    let mut min_dist = f64::MAX;
    let mut closest_idx = 0;

    for (i, color) in palette.iter().enumerate() {
        if is_transparent(color) {
            continue;
        }
        let dist = color_distance(pixel, color);
        if dist < min_dist {
            min_dist = dist;
            closest_idx = i;
        }
    }

    closest_idx
}

// Median cut color quantization
fn quantize_colors(
    img: &RgbaImage,
    max_colors: usize,
    remove_background: bool,
    background_threshold: u8,
) -> (RgbaImage, Vec<Rgba<u8>>) {
    // Collect all non-transparent pixels
    let mut pixels: Vec<Rgba<u8>> = Vec::new();
    for pixel in img.pixels() {
        if !is_transparent(pixel) && !(remove_background && is_background(pixel, background_threshold)) {
            pixels.push(*pixel);
        }
    }

    if pixels.is_empty() {
        return (img.clone(), vec![]);
    }

    // Median cut algorithm
    let palette = median_cut(&pixels, max_colors);

    // Map each pixel to nearest palette color
    let mut result = img.clone();
    for (x, y, pixel) in img.enumerate_pixels() {
        if is_transparent(pixel) || (remove_background && is_background(pixel, background_threshold)) {
            result.put_pixel(x, y, Rgba([0, 0, 0, 0]));
        } else {
            let closest_idx = find_closest_color(pixel, &palette);
            result.put_pixel(x, y, palette[closest_idx]);
        }
    }

    (result, palette)
}

fn median_cut(pixels: &[Rgba<u8>], max_colors: usize) -> Vec<Rgba<u8>> {
    if pixels.is_empty() || max_colors == 0 {
        return vec![];
    }

    let mut buckets: Vec<Vec<Rgba<u8>>> = vec![pixels.to_vec()];

    while buckets.len() < max_colors {
        // Find bucket with largest range
        let mut max_range = 0u8;
        let mut max_bucket_idx = 0;
        let mut split_channel = 0;

        for (i, bucket) in buckets.iter().enumerate() {
            if bucket.len() <= 1 {
                continue;
            }

            for channel in 0..3 {
                let min_val = bucket.iter().map(|p| p[channel]).min().unwrap_or(0);
                let max_val = bucket.iter().map(|p| p[channel]).max().unwrap_or(0);
                let range = max_val - min_val;

                if range > max_range {
                    max_range = range;
                    max_bucket_idx = i;
                    split_channel = channel;
                }
            }
        }

        if max_range == 0 || buckets[max_bucket_idx].len() <= 1 {
            break;
        }

        // Split the bucket
        let mut bucket = buckets.remove(max_bucket_idx);
        bucket.sort_by_key(|p| p[split_channel]);

        let mid = bucket.len() / 2;
        let (left, right) = bucket.split_at(mid);

        if !left.is_empty() {
            buckets.push(left.to_vec());
        }
        if !right.is_empty() {
            buckets.push(right.to_vec());
        }
    }

    // Calculate average color for each bucket
    buckets
        .iter()
        .filter(|b| !b.is_empty())
        .map(|bucket| {
            let mut r_sum: u64 = 0;
            let mut g_sum: u64 = 0;
            let mut b_sum: u64 = 0;
            let count = bucket.len() as u64;

            for pixel in bucket {
                r_sum += pixel[0] as u64;
                g_sum += pixel[1] as u64;
                b_sum += pixel[2] as u64;
            }

            Rgba([
                (r_sum / count) as u8,
                (g_sum / count) as u8,
                (b_sum / count) as u8,
                255,
            ])
        })
        .collect()
}

fn apply_dithering(img: &RgbaImage, palette: &[Rgba<u8>], mode: &DitherMode) -> RgbaImage {
    match mode {
        DitherMode::None => img.clone(),
        DitherMode::FloydSteinberg => floyd_steinberg_dither(img, palette),
        DitherMode::Ordered => ordered_dither(img, palette),
        DitherMode::Atkinson => atkinson_dither(img, palette),
    }
}

fn floyd_steinberg_dither(img: &RgbaImage, palette: &[Rgba<u8>]) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut result = img.clone();
    let mut errors: HashMap<(u32, u32), [f64; 3]> = HashMap::new();

    for y in 0..height {
        for x in 0..width {
            let pixel = result.get_pixel(x, y);
            if is_transparent(pixel) {
                continue;
            }

            // Get accumulated error
            let error = errors.remove(&(x, y)).unwrap_or([0.0, 0.0, 0.0]);

            // Apply error to current pixel
            let corrected = Rgba([
                (pixel[0] as f64 + error[0]).clamp(0.0, 255.0) as u8,
                (pixel[1] as f64 + error[1]).clamp(0.0, 255.0) as u8,
                (pixel[2] as f64 + error[2]).clamp(0.0, 255.0) as u8,
                pixel[3],
            ]);

            // Find closest palette color
            let closest_idx = find_closest_color(&corrected, palette);
            let new_color = palette[closest_idx];
            result.put_pixel(x, y, new_color);

            // Calculate quantization error
            let quant_error = [
                corrected[0] as f64 - new_color[0] as f64,
                corrected[1] as f64 - new_color[1] as f64,
                corrected[2] as f64 - new_color[2] as f64,
            ];

            // Distribute error to neighbors (Floyd-Steinberg pattern)
            let distributions = [
                ((x + 1, y), 7.0 / 16.0),
                ((x.wrapping_sub(1), y + 1), 3.0 / 16.0),
                ((x, y + 1), 5.0 / 16.0),
                ((x + 1, y + 1), 1.0 / 16.0),
            ];

            for ((nx, ny), factor) in distributions {
                if nx < width && ny < height {
                    let entry = errors.entry((nx, ny)).or_insert([0.0, 0.0, 0.0]);
                    entry[0] += quant_error[0] * factor;
                    entry[1] += quant_error[1] * factor;
                    entry[2] += quant_error[2] * factor;
                }
            }
        }
    }

    result
}

fn ordered_dither(img: &RgbaImage, palette: &[Rgba<u8>]) -> RgbaImage {
    // 4x4 Bayer matrix
    const BAYER: [[f64; 4]; 4] = [
        [0.0, 8.0, 2.0, 10.0],
        [12.0, 4.0, 14.0, 6.0],
        [3.0, 11.0, 1.0, 9.0],
        [15.0, 7.0, 13.0, 5.0],
    ];

    let (width, height) = img.dimensions();
    let mut result = img.clone();

    for y in 0..height {
        for x in 0..width {
            let pixel = result.get_pixel(x, y);
            if is_transparent(pixel) {
                continue;
            }

            let threshold = (BAYER[(y % 4) as usize][(x % 4) as usize] / 16.0 - 0.5) * 64.0;

            let adjusted = Rgba([
                (pixel[0] as f64 + threshold).clamp(0.0, 255.0) as u8,
                (pixel[1] as f64 + threshold).clamp(0.0, 255.0) as u8,
                (pixel[2] as f64 + threshold).clamp(0.0, 255.0) as u8,
                pixel[3],
            ]);

            let closest_idx = find_closest_color(&adjusted, palette);
            result.put_pixel(x, y, palette[closest_idx]);
        }
    }

    result
}

fn atkinson_dither(img: &RgbaImage, palette: &[Rgba<u8>]) -> RgbaImage {
    let (width, height) = img.dimensions();
    let mut result = img.clone();
    let mut errors: HashMap<(u32, u32), [f64; 3]> = HashMap::new();

    for y in 0..height {
        for x in 0..width {
            let pixel = result.get_pixel(x, y);
            if is_transparent(pixel) {
                continue;
            }

            let error = errors.remove(&(x, y)).unwrap_or([0.0, 0.0, 0.0]);

            let corrected = Rgba([
                (pixel[0] as f64 + error[0]).clamp(0.0, 255.0) as u8,
                (pixel[1] as f64 + error[1]).clamp(0.0, 255.0) as u8,
                (pixel[2] as f64 + error[2]).clamp(0.0, 255.0) as u8,
                pixel[3],
            ]);

            let closest_idx = find_closest_color(&corrected, palette);
            let new_color = palette[closest_idx];
            result.put_pixel(x, y, new_color);

            // Atkinson spreads 3/4 of error (not all, gives lighter result)
            let quant_error = [
                (corrected[0] as f64 - new_color[0] as f64) / 8.0,
                (corrected[1] as f64 - new_color[1] as f64) / 8.0,
                (corrected[2] as f64 - new_color[2] as f64) / 8.0,
            ];

            // Atkinson pattern
            let distributions = [
                (x + 1, y),
                (x + 2, y),
                (x.wrapping_sub(1), y + 1),
                (x, y + 1),
                (x + 1, y + 1),
                (x, y + 2),
            ];

            for (nx, ny) in distributions {
                if nx < width && ny < height {
                    let entry = errors.entry((nx, ny)).or_insert([0.0, 0.0, 0.0]);
                    entry[0] += quant_error[0];
                    entry[1] += quant_error[1];
                    entry[2] += quant_error[2];
                }
            }
        }
    }

    result
}

// Session History Persistence
const SESSION_HISTORY_FILE: &str = "session-history.json";

fn get_app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))
}

#[tauri::command]
fn save_session_history(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let app_dir = get_app_data_dir(&app)?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let file_path = app_dir.join(SESSION_HISTORY_FILE);
    fs::write(&file_path, data)
        .map_err(|e| format!("Failed to write session history: {}", e))?;

    Ok(())
}

#[tauri::command]
fn load_session_history(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_dir = get_app_data_dir(&app)?;
    let file_path = app_dir.join(SESSION_HISTORY_FILE);

    if !file_path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read session history: {}", e))?;

    Ok(Some(contents))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            create_new_project,
            load_image,
            process_image,
            save_project,
            open_project,
            save_pdf,
            pick_screen_color,
            capture_screen,
            save_session_history,
            load_session_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
