# Product Requirements Document (PRD)
# NeedlePoint Designer Suite

**Version:** 1.1
**Date:** December 29, 2025
**Author:** [Your Name]
**Status:** Draft

---

## 1. Executive Summary

The NeedlePoint Designer Suite consists of **two separate applications** that work together:

### 1.1 Application 1: NeedlePoint Designer (Commercial)
A cross-platform desktop application for designing needlepoint and cross-stitch patterns. Similar to Stitchly, this consumer-facing app targets hobbyists and professional designers who want to create, edit, and export needlepoint patterns. Available on Windows and macOS as a commercial product with a one-time purchase model.

### 1.2 Application 2: WorkBii Canvas Painter (Machine Control)
A dedicated machine control application for the WorkBii Vision Plotter automated canvas painting system. This application imports patterns from NeedlePoint Designer and handles G-code generation, path optimization, and machine communication.

### 1.3 Integration
The two applications communicate through a shared file format (`.ndp` - NeedlePoint Design), allowing seamless handoff from design to production. Users can export from NeedlePoint Designer and import directly into WorkBii Canvas Painter.

---

## 2. Product Vision

### 2.1 Problem Statement

**For NeedlePoint Designer (Commercial):**
Needlepoint enthusiasts need intuitive tools to:
- Convert photographs and images into stitchable patterns
- Design custom patterns with precise color control
- Generate material lists (thread/yarn quantities)
- Export patterns in printable formats

**For WorkBii Canvas Painter (Machine Control):**
The WorkBii Vision Plotter system requires specialized software to:
- Import patterns from the design application
- Map pattern colors to physical pen positions
- Generate optimized G-code for automated canvas painting
- Manage print jobs and monitor machine status

### 2.2 Target Users

**NeedlePoint Designer:**
| User Type | Description | Primary Needs |
|-----------|-------------|---------------|
| **Hobbyist Stitchers** | Home crafters creating personal projects | Easy image conversion, printable patterns |
| **Professional Designers** | Pattern creators selling designs | Advanced editing, multiple export formats |
| **Small Business Owners** | Custom needlepoint shops | Batch processing, professional outputs |

**WorkBii Canvas Painter:**
| User Type | Description | Primary Needs |
|-----------|-------------|---------------|
| **Machine Operators** | WorkBii plotter users | Pattern import, G-code generation, job management |
| **Production Staff** | Canvas painting production | Queue management, status monitoring |

### 2.3 Competitive Reference (NeedlePoint Designer)
- **Stitchly** (iOS/Mac) - One-time purchase, image-to-pattern conversion, progress tracking
- **PC Stitch** (Windows) - Professional features, extensive thread libraries
- **StitchSketch** (iOS) - Mobile-first design tool

---

## 3. NeedlePoint Designer Features (Commercial App)

### 3.1 Pattern Creation

#### 3.1.1 Image Import & Conversion
- **Supported Formats:** PNG, JPG, JPEG, BMP, PDF, SVG
- **Automatic Color Reduction:** Reduce image to target color count (2-256 colors)
- **Dithering Options:** None, Floyd-Steinberg, Ordered, Atkinson
- **Edge Detection:** Optional outline enhancement
- **Background Removal:** Transparent/designated "no-stitch" areas

#### 3.1.2 Manual Design Tools
- **Grid-Based Canvas:** Click-to-place stitches on grid
- **Drawing Tools:** Pencil, line, rectangle, ellipse, fill bucket, eraser
- **Selection Tools:** Rectangle select, lasso, magic wand
- **Layer Support:** Multiple layers for complex designs
- **Undo/Redo:** Unlimited history

#### 3.1.3 Pattern Editing
- **Color Replacement:** Global and selective color swap
- **Resize/Scale:** Maintain or adjust aspect ratio
- **Rotate/Flip:** 90° increments, horizontal/vertical flip
- **Crop:** Trim canvas to selection
- **Merge/Split:** Combine patterns or divide into sections

### 3.2 Canvas Configuration

| Parameter | Options | Default |
|-----------|---------|---------|
| **Mesh Count** | 7, 10, 12, 13, 14, 16, 18, 22, 24 per inch | 18 |
| **Canvas Size** | Custom dimensions (inches/cm/mm) | 12" x 12" |
| **Grid Display** | 5x5, 10x10, custom grouping | 10x10 |
| **Stitch Type** | Tent, Continental, Basketweave, Cross | Tent |

### 3.3 Color Management

#### 3.3.1 Thread/Yarn Libraries
- **Built-in Libraries:**
  - DMC Cotton Floss (500+ colors)
  - Anchor Stranded Cotton
  - Kreinik Metallics
  - Appleton Crewel Wool
  - Paternayan Persian Yarn
  - Custom user libraries

#### 3.3.2 Color Matching
- **Automatic Matching:** Match image colors to nearest thread colors
- **Manual Override:** Select specific threads per color
- **Color Grouping:** Combine similar colors to reduce thread count
- **Preview Mode:** View pattern with actual thread colors

#### 3.3.3 Symbol Assignment
- **Automatic Symbols:** Assign unique symbols to each color
- **Custom Symbols:** User-defined symbol library
- **Symbol Styles:** Geometric, alphanumeric, custom glyphs
- **High-Contrast Mode:** Accessibility-friendly symbols

### 3.4 Progress Tracking
- **Stitch Marking:** Mark individual stitches as complete
- **Section Completion:** Track progress by color or region
- **Statistics:** Percentage complete, estimated time remaining
- **Save/Resume:** Persist progress across sessions

### 3.5 Export Options

#### 3.5.1 Print Export
- **PDF Pattern:** Multi-page pattern with legend
- **Symbol Chart:** Black/white printable chart
- **Color Chart:** Full-color preview
- **Materials List:** Thread quantities, skein counts
- **Instructions Page:** Stitch guide, color key

#### 3.5.2 Digital Export
- **Image Formats:** PNG, JPG, SVG
- **Pattern Formats:** .ndp (native), .pat, .xsd (PC Stitch compatible)
- **Spreadsheet:** CSV/Excel with stitch coordinates

#### 3.5.3 Machine Export
- **NDP Format:** Native `.ndp` file containing full pattern data, color definitions, and canvas settings
- **One-Click Export:** "Send to WorkBii" button opens file in Canvas Painter (if installed)

---

## 4. WorkBii Canvas Painter Features (Machine Control App)

### 4.1 Overview
A dedicated application for controlling the WorkBii Vision Plotter. This is a separate application from NeedlePoint Designer, focused entirely on machine operation.

### 4.2 Pattern Import
- **NDP Import:** Load `.ndp` files from NeedlePoint Designer
- **Direct Image Import:** Basic image-to-pattern conversion for quick jobs
- **Pattern Preview:** Visual display of imported pattern with color breakdown

### 4.3 Pen/Color Mapping
- **Pen Rack Configuration:** Define which paint colors are in slots T0-T11
- **Color Matching:** Map pattern colors to available pen positions
- **Missing Color Alerts:** Warn when pattern requires colors not in rack
- **Color Profiles:** Save and load pen rack configurations

### 4.4 Hardware Specifications

| Component | Specification |
|-----------|--------------|
| **Frame** | WorkBii 750x1000mm CNC kit |
| **Work Area** | 550mm x 770mm (21.6" x 30.3") |
| **Resolution** | 0.1mm (400 steps/mm) |
| **Controller** | ODROID-N2+ (Klipper host) + SKR Pico (MCU) |
| **Pen Changer** | 8-12 position automatic rack |
| **Pen Lift** | MG90D servo (PWM controlled) |

### 4.5 G-code Generation

#### 4.5.1 Canvas Parameters
```
mesh_count: 14/18/22 holes per inch
canvas_width_mm: Physical canvas width
canvas_height_mm: Physical canvas height
origin_x_mm: X offset from machine origin
origin_y_mm: Y offset from machine origin
hole_diameter_mm: Target paint dot size (default 0.8mm)
```

#### 4.5.2 Coordinate Conversion
```
hole_spacing_mm = 25.4 / mesh_count
machine_x = origin_x + (pixel_col × hole_spacing)
machine_y = origin_y + (pixel_row × hole_spacing)
```

#### 4.5.3 Path Optimization
- **Color Grouping:** Minimize tool changes by painting all holes of one color before switching
- **Travel Optimization:** Nearest-neighbor + 2-opt algorithm
- **Scanline Mode:** Row-by-row painting with alternating direction
- **Wet Paint Avoidance:** Configurable skip patterns to avoid smearing

#### 4.5.4 Tool Change Sequence
1. Raise pen to safe Z height
2. Return current pen to rack slot
3. Move to new pen slot
4. Pick up new pen with gripper
5. Resume painting

### 4.6 Machine Communication

#### 4.6.1 Moonraker API Integration
- **File Upload:** `POST /server/files/upload`
- **Job Start:** `POST /printer/print/start`
- **Pause/Resume:** `POST /printer/print/pause`, `/resume`
- **Status Monitoring:** `GET /printer/objects/query`
- **Real-time Updates:** WebSocket connection to `/websocket`

#### 4.6.2 Job Management
- **Queue System:** Multiple jobs in queue
- **Progress Display:** Real-time completion percentage
- **Pause Points:** Automatic pause for pen replacement
- **Error Recovery:** Resume from last completed hole

### 4.7 Phase 2: Vision System (Future)
- **Canvas Alignment:** Automatic pattern-to-canvas registration
- **Hole Detection:** OpenCV blob detection for precise targeting
- **Color Verification:** Confirm correct pen is loaded
- **Coverage Check:** Detect missed or incomplete holes
- **Pen Monitoring:** Detect paint exhaustion

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Tauri + React | Small binary (~10MB), native performance |
| **Backend** | Rust | Fast image processing, type safety |
| **Frontend** | TypeScript + React | Type safety, component-based UI |
| **UI Components** | React + Tailwind CSS | Modern, responsive design |
| **Canvas Rendering** | HTML5 Canvas / WebGL | High-performance graphics |
| **Image Processing** | Rust (image crate) | Native speed image manipulation |
| **State Management** | Zustand | Lightweight, predictable state |
| **File Storage** | File System (JSON) | Simple, portable project files |
| **Machine Comm** | REST + WebSocket | Moonraker API (Canvas Painter only) |

### 5.2 Application Architecture

#### 5.2.1 NeedlePoint Designer (Commercial App)

```
┌─────────────────────────────────────────────────────────────┐
│                    NeedlePoint Designer                     │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                   │
│  ├── PatternEditor      - Main design canvas                │
│  ├── ColorPalette       - Thread/color management           │
│  ├── ToolPanel          - Drawing and editing tools         │
│  ├── LayerPanel         - Layer management                  │
│  ├── ExportDialog       - Export configuration              │
│  └── ImportWizard       - Image-to-pattern conversion       │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                              │
│  ├── PatternParser      - Image import & color extraction   │
│  ├── ColorMapper        - Match colors to thread libraries  │
│  ├── PatternEngine      - Pattern manipulation & rendering  │
│  └── ExportService      - Generate PDF, images, .ndp files  │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├── ProjectStore       - Save/load projects                │
│  ├── ThreadLibrary      - Thread color databases            │
│  └── SettingsStore      - User preferences                  │
└─────────────────────────────────────────────────────────────┘
         │
         │  .ndp file export
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  WorkBii Canvas Painter                     │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                   │
│  ├── PatternViewer      - Display imported pattern          │
│  ├── PenRackConfig      - Configure pen slot colors         │
│  ├── ColorMapper        - Map pattern colors to pens        │
│  ├── JobQueue           - Manage print jobs                 │
│  ├── MachineStatus      - Real-time machine monitoring      │
│  └── ToolpathPreview    - G-code visualization              │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                              │
│  ├── NdpImporter        - Parse .ndp files                  │
│  ├── PenColorMapper     - Map colors to physical pens       │
│  ├── PathOptimizer      - Optimize paint order              │
│  ├── GcodeGenerator     - Generate Klipper G-code           │
│  └── MoonrakerClient    - Machine communication             │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├── PenProfiles        - Saved pen rack configurations     │
│  ├── JobHistory         - Completed job records             │
│  └── MachineSettings    - Connection & calibration data     │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Structures

#### 5.3.1 Shared NDP File Format
The `.ndp` (NeedlePoint Design) file format is the bridge between applications.

```typescript
// NDP File Structure (JSON-based)
interface NdpFile {
  version: string;              // File format version
  metadata: {
    name: string;
    author?: string;
    createdAt: string;
    modifiedAt: string;
    software: string;           // "NeedlePoint Designer v1.0"
  };
  canvas: {
    width: number;              // in stitches/holes
    height: number;             // in stitches/holes
    meshCount: number;          // holes per inch (14, 18, 22, etc.)
    physicalWidth?: number;     // mm (optional, for machine)
    physicalHeight?: number;    // mm (optional, for machine)
  };
  colorPalette: Color[];
  layers: Layer[];
}
```

#### 5.3.2 NeedlePoint Designer Data Types

```typescript
interface Pattern {
  id: string;
  name: string;
  width: number;          // in stitches
  height: number;         // in stitches
  meshCount: number;      // holes per inch
  layers: Layer[];
  colorPalette: Color[];
  metadata: PatternMetadata;
}

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  stitches: Stitch[];
}

interface Stitch {
  x: number;
  y: number;
  colorId: string;
  completed: boolean;
}

interface Color {
  id: string;
  name: string;
  rgb: [number, number, number];
  threadBrand?: string;
  threadCode?: string;
  symbol?: string;
}
```

#### 5.3.3 WorkBii Canvas Painter Data Types

```typescript
interface PenSlot {
  index: number;            // T0-T11
  colorName: string;
  rgb: [number, number, number];
  paintType?: string;       // "acrylic", "fabric", etc.
}

interface PenRackProfile {
  id: string;
  name: string;
  slots: PenSlot[];
}

interface ColorMapping {
  patternColorId: string;
  penSlotIndex: number;
}

interface MachineJob {
  id: string;
  patternName: string;
  ndpFile: string;
  colorMappings: ColorMapping[];
  status: 'pending' | 'printing' | 'paused' | 'completed' | 'error';
  progress: number;
  gcodeFile: string;
  startedAt?: Date;
  completedAt?: Date;
}
```

---

## 6. User Interface

### 6.1 NeedlePoint Designer - Main Window

```
┌─────────────────────────────────────────────────────────────────────┐
│  File  Edit  View  Pattern  Tools  Help                   ─ □ ✕   │
├─────────┬───────────────────────────────────────────┬───────────────┤
│         │                                           │               │
│  Tools  │                                           │    Colors     │
│         │                                           │               │
│  [Pen]  │                                           │  ■ #FF0000    │
│  [Fill] │          Pattern Canvas                   │  ■ #00FF00    │
│  [Line] │                                           │  ■ #0000FF    │
│  [Rect] │        (Zoomable, Pannable)              │  ■ #FFFF00    │
│  [Oval] │                                           │               │
│  [Sel]  │                                           │  [+ Add]      │
│  [Erase]│                                           │  [Library]    │
│         │                                           │               │
├─────────┼───────────────────────────────────────────┼───────────────┤
│ Layers  │                                           │   Properties  │
│ ──────  │                                           │   ──────────  │
│ □ Layer1│                                           │   Size: 100x80│
│ □ Layer2│                                           │   Mesh: 18    │
│ [+][-]  │                                           │   Colors: 12  │
└─────────┴───────────────────────────────────────────┴───────────────┘
│  Ready                              Zoom: 100%    │  100x80 stitches│
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 NeedlePoint Designer - Key Screens

1. **Welcome/Start Screen** - New project, open recent, import image
2. **Pattern Editor** - Main design workspace (above)
3. **Import Wizard** - Step-by-step image conversion
4. **Color Matching** - Map image colors to threads
5. **Export Dialog** - Configure and generate outputs (PDF, .ndp)
6. **Settings** - Preferences, thread libraries

### 6.3 WorkBii Canvas Painter - Main Window

```
┌─────────────────────────────────────────────────────────────────────┐
│  File  Machine  View  Help                                ─ □ ✕   │
├───────────────────────────────────┬─────────────────────────────────┤
│                                   │  Machine Status                 │
│                                   │  ─────────────────────          │
│                                   │  ● Connected: 192.168.1.50     │
│      Pattern Preview              │  State: Idle                    │
│                                   │  Temps: OK                      │
│      [Imported design shown       │                                 │
│       with color overlay]         ├─────────────────────────────────┤
│                                   │  Pen Rack                       │
│                                   │  ─────────────────────          │
│                                   │  T0: ■ Red                     │
│                                   │  T1: ■ Blue                    │
├───────────────────────────────────┤  T2: ■ Green                   │
│  Color Mapping                    │  T3: ■ Yellow                  │
│  ─────────────────────            │  T4: □ Empty                   │
│  Pattern → Pen                    │  ...                            │
│  ■ Red    → T0 ■                 ├─────────────────────────────────┤
│  ■ Blue   → T1 ■                 │  Job Queue                      │
│  ■ Green  → T2 ■                 │  ─────────────────────          │
│  ⚠ Orange → [Select Pen]         │  1. Rose.ndp - Ready            │
│                                   │  2. Sunset.ndp - Pending        │
├───────────────────────────────────┼─────────────────────────────────┤
│  [Import Pattern]  [Start Job]    │  Progress: ████░░░░░░ 45%      │
└───────────────────────────────────┴─────────────────────────────────┘
```

### 6.4 WorkBii Canvas Painter - Key Screens

1. **Main Dashboard** - Pattern preview, machine status, job control (above)
2. **Pattern Import** - Load .ndp files, basic image import
3. **Pen Rack Setup** - Configure which colors are in each slot
4. **Color Mapping** - Map pattern colors to pen slots
5. **Toolpath Preview** - Visualize G-code path before printing
6. **Job History** - View completed jobs and statistics
7. **Machine Settings** - Connection, calibration, parameters

---

## 7. Business Model

### 7.1 NeedlePoint Designer (Commercial App)

#### Pricing Strategy

| Edition | Price | Features |
|---------|-------|----------|
| **Standard** | $29.99 | Full design tools, PDF export, basic thread libraries |
| **Professional** | $49.99 | + All thread libraries, batch processing, advanced exports |
| **Lifetime Updates** | +$19.99 | Free major version upgrades |

#### Revenue Streams
- One-time software purchase (primary)
- Optional thread library packs ($4.99 each)
- Premium pattern packs ($9.99 each)
- Commercial/business licensing

#### Distribution
- Direct download from product website
- Microsoft Store (Windows)
- Mac App Store (macOS)

### 7.2 WorkBii Canvas Painter (Machine Control App)

#### Pricing Strategy
- **Free** - Bundled with WorkBii hardware or available as standalone download
- Not sold commercially (internal use / included with machine)

#### Distribution
- Direct download from product website
- GitHub releases (if open-sourced)

---

## 8. Development Phases

### Application 1: NeedlePoint Designer (Commercial)

#### Phase 1A: Core Designer (MVP)
**Scope:**
- [x] Project setup (Tauri + React + TypeScript)
- [ ] Basic pattern editor with grid canvas
- [ ] Drawing tools (pencil, fill, eraser)
- [ ] Color palette management
- [ ] Image import with color reduction
- [ ] Basic thread library (DMC)
- [ ] PDF pattern export
- [ ] Save/load projects (.ndp format)

#### Phase 2A: Advanced Design Features
**Scope:**
- [ ] Full drawing tool suite (line, shapes, selection)
- [ ] Layer support
- [ ] Advanced color matching algorithms
- [ ] Multiple thread libraries (Anchor, Kreinik, etc.)
- [ ] Symbol assignment and customization
- [ ] Progress tracking
- [ ] Multiple export formats (PNG, SVG, spreadsheet)

#### Phase 3A: Polish & Commercial Launch
**Scope:**
- [ ] UI/UX refinement
- [ ] Performance optimization for large patterns
- [ ] Cross-platform testing (Windows + macOS)
- [ ] Installer/packaging
- [ ] Documentation & tutorials
- [ ] Beta testing program
- [ ] Marketing website
- [ ] App store submissions

---

### Application 2: WorkBii Canvas Painter (Machine Control)

#### Phase 1B: Core Machine Control
**Scope:**
- [x] Project setup (Tauri + React + TypeScript)
- [ ] .ndp file import and parsing
- [ ] Pattern preview display
- [ ] Pen rack configuration UI
- [ ] Color-to-pen mapping interface
- [ ] Basic G-code generation
- [ ] Moonraker API connection
- [ ] Start/pause/stop job controls

#### Phase 2B: Advanced Machine Features
**Scope:**
- [ ] Path optimization algorithms (nearest-neighbor, 2-opt)
- [ ] Toolpath visualization/preview
- [ ] Job queue management
- [ ] Real-time progress monitoring
- [ ] Job history and statistics
- [ ] Pen rack profile saving/loading
- [ ] Error recovery and resume

#### Phase 3B: Vision System (Future)
**Scope:**
- [ ] Camera integration (IMX477)
- [ ] Canvas hole detection (OpenCV)
- [ ] Automatic pattern alignment
- [ ] Color verification
- [ ] Quality/coverage checking
- [ ] Autonomous operation mode

---

## 9. Success Metrics

### NeedlePoint Designer (Commercial)

| Metric | Target |
|--------|--------|
| **App Stability** | < 1 crash per 100 hours of use |
| **Pattern Generation** | < 5 seconds for 500x500 pattern |
| **Image Import** | < 3 seconds for 4K image |
| **User Satisfaction** | > 4.5 star average rating |
| **First-Year Sales** | 1,000+ licenses |

### WorkBii Canvas Painter (Machine Control)

| Metric | Target |
|--------|--------|
| **App Stability** | < 1 crash per 100 hours of use |
| **G-code Generation** | < 10 seconds for 10,000 holes |
| **Machine Connection** | < 2 seconds to connect |
| **Job Success Rate** | > 95% jobs complete without error |

---

## 10. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Cross-platform bugs | High | Medium | Extensive testing on both platforms |
| Performance issues with large patterns | Medium | Medium | WebGL rendering, progressive loading |
| Machine communication failures | High | Low | Robust error handling, offline mode |
| Color matching accuracy | Medium | Medium | Manual override options, user feedback |
| Competition from mobile apps | Medium | High | Focus on professional features, machine integration |

---

## 11. Open Questions

### NeedlePoint Designer
1. Should mobile companion app be considered for progress tracking?
2. Cloud sync for patterns across devices?
3. Community pattern sharing/marketplace?
4. Subscription model vs one-time purchase (market research needed)?

### WorkBii Canvas Painter
5. Should Canvas Painter be open-sourced?
6. Support for other CNC/plotter machines beyond WorkBii?
7. Remote access / web-based interface option?

### Integration
8. Should the apps share any code (monorepo vs separate repos)?
9. Protocol for "Send to WorkBii" feature - file association vs network?
10. Shared NDP file format versioning strategy?

---

## 12. Appendices

### A. Reference Documents
- `WorkBii-Parts-List-Updated.docx` - Hardware specifications and parts list
- `Software-Development-Spec.docx` - Technical G-code and machine interface specs

### B. Competitive Analysis
- Stitchly (https://stitchly.com/) - iOS/Mac, one-time purchase, image conversion
- PC Stitch - Windows, professional features
- StitchSketch - iOS, mobile-first

### C. Technical References
- Klipper Firmware: https://www.klipper3d.org/
- Moonraker API: https://moonraker.readthedocs.io/
- Electron: https://www.electronjs.org/
- React: https://react.dev/

---

*Document Version History:*
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-29 | [Author] | Initial draft |
| 1.1 | 2025-12-29 | [Author] | Split into two separate applications: NeedlePoint Designer (commercial) and WorkBii Canvas Painter (machine control) |
| 1.2 | 2025-12-29 | [Author] | Updated tech stack from Electron to Tauri + Rust; completed project setup |
