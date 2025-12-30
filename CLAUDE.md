# NeedlePoint Designer - Claude Context

## Project Overview

NeedlePoint Designer is a cross-platform desktop application for creating needlepoint and cross-stitch patterns. This is a **commercial product** similar to Stitchly, targeting hobbyists and professional designers.

**Important:** This is part of a **two-application suite**:
1. **NeedlePoint Designer** (this app) - Commercial pattern design tool
2. **WorkBii Canvas Painter** (separate app) - Machine control for automated canvas painting

The apps communicate via a shared `.ndp` file format.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | **Tauri 2.0** (not Electron) |
| Backend | **Rust** |
| Frontend | **React 19 + TypeScript** |
| Styling | **Tailwind CSS v4** |
| State | **Zustand** |
| Build | **Vite 7** |

## Project Structure

```
needle_designer/
├── src/                      # React frontend
│   ├── App.tsx               # Main React component
│   ├── main.tsx              # React entry point
│   ├── index.css             # Tailwind styles (@import "tailwindcss")
│   └── vite-env.d.ts
├── src-tauri/                # Rust backend
│   ├── src/
│   │   ├── lib.rs            # Tauri commands, NDP types
│   │   └── main.rs           # Entry point
│   ├── capabilities/
│   │   └── default.json      # Permissions
│   ├── icons/                # Generated app icons
│   ├── Cargo.toml            # Rust deps
│   └── tauri.conf.json       # Tauri config
├── public/
│   └── favicon.svg
├── PRD.md                    # Full product requirements
├── package.json
├── vite.config.ts
├── tsconfig.json
└── postcss.config.js
```

## Commands

```bash
npm run tauri dev      # Development mode (hot reload)
npm run tauri build    # Production build (~10-15MB binary)
npm run dev            # Vite only (no Tauri window)
```

## Key Files to Know

### Rust Backend (`src-tauri/src/lib.rs`)
- Contains NDP file format structs (`NdpFile`, `Layer`, `Stitch`, `Color`)
- Tauri commands: `greet`, `create_new_project`
- Add new IPC commands here with `#[tauri::command]`

### React Frontend (`src/App.tsx`)
- Currently shows welcome screen
- Uses Tailwind classes for styling

### Configuration (`src-tauri/tauri.conf.json`)
- Window size: 1400x900 (min 1024x768)
- App identifier: `com.needlepoint.designer`
- Dev server port: 1420

## NDP File Format

The `.ndp` format is JSON-based and shared between both apps:

```typescript
interface NdpFile {
  version: string;
  metadata: {
    name: string;
    author?: string;
    created_at: string;
    modified_at: string;
    software: string;
  };
  canvas: {
    width: number;      // stitches
    height: number;     // stitches
    mesh_count: number; // holes per inch (14, 18, 22)
  };
  color_palette: Color[];
  layers: Layer[];
}
```

## Development Phases (from PRD)

### Phase 1A: Core Designer (MVP) - IN PROGRESS
- [x] Project setup (Tauri + React + TypeScript)
- [x] Basic pattern editor with grid canvas
- [ ] Drawing tools (pencil, fill, eraser)
- [ ] Color palette management
- [ ] Image import with color reduction
- [ ] Basic thread library (DMC)
- [ ] PDF pattern export
- [ ] Save/load projects (.ndp format)

### Phase 2A: Advanced Features
- Layer support
- Multiple thread libraries
- Symbol assignment
- Progress tracking

### Phase 3A: Polish & Launch
- Cross-platform testing
- Installer packaging
- App store submission

## Reference Documents

- `PRD.md` - Full product requirements document
- `WorkBii-Parts-List-Updated.docx` - Hardware specs for the painting machine
- `Software-Development-Spec.docx` - G-code generation specs

## Architecture Notes

### Why Tauri over Electron?
- **10x smaller** binary size (~10MB vs ~150MB)
- **Better performance** - Rust backend for image processing
- **Native feel** - Uses system webview
- Same React/TypeScript frontend development experience

### Why Not SQLite?
File-based JSON storage is sufficient:
- Projects are individual `.ndp` files
- Settings in `settings.json`
- Thread libraries are bundled JSON data

## Common Tasks

### Adding a new Tauri command

1. Add to `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    Ok(format!("Result: {}", arg))
}
```

2. Register in `run()`:
```rust
.invoke_handler(tauri::generate_handler![greet, create_new_project, my_command])
```

3. Call from React:
```typescript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('my_command', { arg: 'test' });
```

### Adding a new React component

Create in `src/components/` and import into `App.tsx`.

### Updating permissions

Edit `src-tauri/capabilities/default.json` to add plugin permissions.

## Troubleshooting

### Build fails with icon error
Run: `npm run tauri icon -- "public/favicon.svg"`

### Tailwind classes not working
Ensure `src/index.css` has `@import "tailwindcss";` (not `@tailwind` directives - that's v3 syntax)

### Rust compilation slow
First build downloads ~400 crates. Subsequent builds are fast (~1-10s).
