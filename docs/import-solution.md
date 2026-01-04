# Analysis: Dithering Inconsistency on Import

## Problem Statement

When converting images to patterns, the preview sometimes looks clean but the imported result has dithering/scattered pixels. This happens randomly, especially when changing dimensions in inches.

## Root Cause Analysis

The issue likely stems from one or more of these factors:

1. **Timing/State Desync**: React state updates are asynchronous. When user changes settings and quickly clicks buttons, the values read during processing may differ from what was used for preview.

2. **Two-Phase Processing**: Preview generates via `process_image` in Rust, but import does additional color matching in JavaScript (`findClosestColor`). The preview shows raw processed colors, but imported pattern shows thread-matched colors.

3. **Multiple Code Paths**: Preview and "Process Image" are separate async operations that independently read from state, creating opportunities for divergence.

---

## Option 1: Unified Processing Pipeline

**Approach**: Eliminate the separation between preview generation and final processing. Generate the result ONCE and use it for both display and import.

**How it works**:
- Remove separate `generateLivePreview` and `handleProcessImage` functions
- Single `generateResult` function that produces the final importable result
- Store this result in state; display it as preview AND use it for import
- "Process Image" button becomes "Generate" and goes directly to step 3

**Advantages**:
- Zero possibility of preview/import mismatch - they're the same data
- Simpler code - one processing path instead of two
- User sees exactly what they'll get

**Disadvantages**:
- Slower iteration - every setting change requires full regeneration
- Can't have "live preview while typing" experience
- Heavier processing load

---

## Option 2: Atomic Settings Snapshot

**Approach**: Capture all settings as an immutable snapshot at the moment of processing. Never read individual state variables during async operations.

**How it works**:
- Create a `ProcessingConfig` type containing ALL settings
- When preview starts, create snapshot: `const config = { targetWidth, targetHeight, maxColors, ... }`
- Pass this single object through entire pipeline
- Store config alongside result: `{ result: ProcessedImage, config: ProcessingConfig }`
- On "Process Image", compare current settings to stored config
- Only reprocess if settings differ; otherwise reuse stored result

**Advantages**:
- Maintains live preview capability
- Clear audit trail - know exactly what settings produced what result
- Can detect and warn about stale previews
- Minimal architecture change

**Disadvantages**:
- More complex state tracking
- Need to implement deep equality comparison for configs
- Still two code paths (preview vs final), just better synchronized

---

## Option 3: Server-Side Complete Processing

**Approach**: Move ALL processing to Rust, including thread matching. The `preview_base64` returned by Rust shows the exact final result with thread colors applied.

**How it works**:
- Extend `process_image` Rust command to accept thread library and matching algorithm
- Rust does quantization, dithering, AND thread color matching
- Returns `preview_base64` showing actual thread colors
- Import step becomes trivial - just transfers the already-computed data

**Advantages**:
- Single source of truth - Rust produces the final result
- Preview is 100% accurate representation
- Faster import (no JS color matching)
- Better performance (Rust is faster than JS for color math)

**Disadvantages**:
- Requires significant Rust code changes
- Need to serialize/pass thread library to Rust
- Larger data transfer between frontend and backend
- More complex Rust codebase to maintain

---

## Recommendation: Option 2 (Atomic Settings Snapshot)

**Why**:

1. **Lowest risk**: Minimal changes to existing architecture
2. **Preserves features**: Keeps live preview, auto-generate toggle, current UX
3. **Addresses root cause**: Eliminates state desync by using snapshots
4. **Debuggable**: Can log/compare configs to catch mismatches
5. **Incremental**: Can implement without rewriting Rust backend

**Implementation approach**:
- Create `ProcessingConfig` interface with all settings
- Add `lastPreviewConfig` ref to track what settings produced current preview
- In `handleProcessImage`, compare current settings to `lastPreviewConfig`
- If match → use stored preview directly
- If mismatch → reprocess (and this indicates a bug to investigate)
- Add assertion/warning when mismatch detected to help find remaining issues

---

## Current Mitigations Already Attempted

- Removed preview caching (always process fresh)
- Added settings tracking via ref (`livePreviewSettingsRef`)
- Added abort flag for in-flight previews
- Made preview use actual dimensions (not scaled down)
- Added console logging for debugging
- Added `isPreviewStale` indicator
- Added auto-generate toggle to give user control

## Files Involved

- `src/components/ImportImageDialog.tsx` - Main dialog component
- `src/stores/configStore.ts` - Persisted config (auto-generate setting)
- `src-tauri/src/lib.rs` - Rust `process_image` command
- `src/utils/colorMatching.ts` - JS color matching algorithms
