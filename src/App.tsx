import { useState, useEffect, useCallback, useRef } from 'react';
import { PatternCanvas } from './components/PatternCanvas';
import { ColorPalette } from './components/ColorPalette';
import { Toolbar, ToolVisibility, EraserIcon, FillIcon, PanIcon, CursorIcon, TextIcon, ColorSwapIcon, AreaSelectIcon, PreviewCanvasIcon, SelectionMoveIcon, SelectionDuplicateIcon, SelectionNewLayerIcon, SelectionDuplicateToNewLayerIcon, FlipHorizontalIcon, FlipVerticalIcon, RotateLeftIcon, RotateRightIcon } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { ProgressTrackingPanel } from './components/ProgressTrackingPanel';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ImportImageDialog } from './components/ImportImageDialog';
import { TextEditorDialog } from './components/TextEditorDialog';
import { FontBrowserDialog } from './components/FontBrowserDialog';
import { BitmapFontEditor } from './components/BitmapFontEditor';
import { DeleteLayerDialog } from './components/DeleteLayerDialog';
import { ExportPdfDialog } from './components/ExportPdfDialog';
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog';
import { ColorMatchDialog } from './components/ColorMatchDialog';
import { SymbolAssignmentDialog } from './components/SymbolAssignmentDialog';
import { OverlayImageDialog } from './components/OverlayImageDialog';
import { UploadImageDialog } from './components/UploadImageDialog';
import { PreviewCanvasDialog } from './components/PreviewCanvasDialog';
import { ToggleSwitch } from './components/ToggleSwitch';
import { usePatternStore, Pattern, RulerUnit, Stitch, TextLayerMetadata } from './stores/patternStore';
import { useSessionHistoryStore } from './stores/sessionHistoryStore';
import { loadBundledFonts } from './data/bundledFonts';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

// NDP file format for Tauri
interface NdpOverlayImage {
  id: string;
  name: string;
  data_url: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  natural_width: number;
  natural_height: number;
}

interface NdpFile {
  version: string;
  metadata: {
    file_id?: string; // Unique identifier for session history tracking
    name: string;
    author: string | null;
    created_at: string;
    modified_at: string;
    software: string;
  };
  canvas: {
    width: number;
    height: number;
    mesh_count: number;
    physical_width: number | null;
    physical_height: number | null;
  };
  color_palette: Array<{
    id: string;
    name: string;
    rgb: [number, number, number];
    thread_brand: string | null;
    thread_code: string | null;
    symbol: string | null;
  }>;
  layers: Array<{
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    stitches: Array<{
      x: number;
      y: number;
      color_id: string;
      completed: boolean;
    }>;
    metadata?: {
      type: 'text';
      text: string;
      fontFamily: string;
      fontWeight: number;
      italic: boolean;
      colorId: string;
      boldness: number;
    };
  }>;
  overlays?: NdpOverlayImage[];
  zoom?: number;
  is_progress_mode?: boolean;
  progress_shading_color?: [number, number, number];
  progress_shading_opacity?: number;
}

const RECENT_FILES_KEY = 'needlepoint-recent-files';
const MAX_RECENT_FILES = 10;
const PREFERENCES_KEY = 'needlepoint-preferences';

// Tool visibility row component for the dialog
function ToolVisibilityRow({ checked, onChange, icon, label }: { checked: boolean; onChange: (checked: boolean) => void; icon: React.ReactNode; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`
          relative w-14 h-7 rounded-full flex items-center transition-all duration-200 shrink-0
          ${checked ? 'bg-green-500' : 'bg-gray-400'}
          shadow-inner
        `}
      >
        <span className={`absolute left-1.5 text-[9px] font-bold transition-opacity duration-200 ${checked ? 'opacity-100 text-white' : 'opacity-0'}`}>ON</span>
        <span className={`absolute right-1.5 text-[9px] font-bold transition-opacity duration-200 ${checked ? 'opacity-0' : 'opacity-100 text-white'}`}>OFF</span>
        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ease-in-out ${checked ? 'left-8' : 'left-1'}`} />
      </div>
      <span className="w-10 flex items-center justify-center">{icon}</span>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

interface Preferences {
  autoSaveMinutes: number | null; // null means disabled
  historySize: number;
  rulerUnit: RulerUnit;
  confirmLayerDelete: boolean; // Show confirmation when deleting layers
  showSymbols: boolean; // Show symbols on color swatches
  showCenterMarker: boolean; // Show green X at canvas center
  toolVisibility: ToolVisibility;
}

const DEFAULT_TOOL_VISIBILITY: ToolVisibility = {
  pencil: true,
  eraser: true,
  fill: true,
  colorswap: true,
  pan: true,
  select: true,
  areaselect: true,
  text: true,
  line: true,
  rectangle: true,
  ellipse: true,
  undo: true,
  redo: true,
  zoomIn: true,
  zoomOut: true,
  zoomFit: true,
  grid: true,
  preview: true,
  selectionMove: true,
  selectionDuplicate: true,
  selectionNewLayer: true,
  selectionDuplicateToNewLayer: true,
  selectionFlipHorizontal: true,
  selectionFlipVertical: true,
  selectionRotateLeft: true,
  selectionRotateRight: true,
};

const DEFAULT_PREFERENCES: Preferences = {
  autoSaveMinutes: 1,
  historySize: 50,
  rulerUnit: 'inches',
  confirmLayerDelete: true,
  showSymbols: true,
  showCenterMarker: true,
  toolVisibility: DEFAULT_TOOL_VISIBILITY,
};

function App() {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showPreferencesMenu, setShowPreferencesMenu] = useState(false);
  const [showRecentMenu, setShowRecentMenu] = useState(false);
  const [showToolbarVisibilityDialog, setShowToolbarVisibilityDialog] = useState(false);
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_FILES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  // Text tool state
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showFontBrowser, setShowFontBrowser] = useState(false);
  const [showBitmapFontEditor, setShowBitmapFontEditor] = useState(false);
  const [editingTextLayerId, setEditingTextLayerId] = useState<string | null>(null);
  const [fontBrowserPreviewText, setFontBrowserPreviewText] = useState('');

  // Ref to store the tool before space-bar pan (to restore on release)
  const toolBeforePanRef = useRef<string | null>(null);

  // Helper to close all menus
  const closeAllMenus = useCallback(() => {
    setShowFileMenu(false);
    setShowToolsMenu(false);
    setShowPreferencesMenu(false);
    setShowRecentMenu(false);
  }, []);

  // Helper to toggle a menu (closes others first, then opens clicked one)
  const toggleMenu = useCallback((menuSetter: React.Dispatch<React.SetStateAction<boolean>>, currentValue: boolean) => {
    if (currentValue) {
      // If this menu is already open, just close it
      menuSetter(false);
    } else {
      // Close all menus first, then open this one
      closeAllMenus();
      menuSetter(true);
    }
  }, [closeAllMenus]);
  const [selectedFont, setSelectedFont] = useState('Roboto');
  const [selectedFontWeight, setSelectedFontWeight] = useState(400);

  // Delete confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [layerToDelete, setLayerToDelete] = useState<string | null>(null);

  // Export dialog state
  const [showExportPdfDialog, setShowExportPdfDialog] = useState(false);

  // Color match dialog state
  const [showColorMatchDialog, setShowColorMatchDialog] = useState(false);

  // Symbol assignment dialog state
  const [showSymbolDialog, setShowSymbolDialog] = useState(false);

  // Overlay image dialog state
  const [showOverlayDialog, setShowOverlayDialog] = useState(false);

  // Upload image dialog state (unified entry point)
  const [showUploadImageDialog, setShowUploadImageDialog] = useState(false);

  // Unsaved changes dialog state
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);

  // Preview canvas dialog state
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const {
    pattern,
    zoom,
    activeTool,
    activeLayerId,
    currentFilePath,
    hasUnsavedChanges,
    history,
    selectedColorId,
    selection,
    overlayImages,
    setTool,
    setZoom,
    setPanOffset,
    loadPattern,
    setCurrentFilePath,
    markSaved,
    undo,
    redo,
    setMaxHistorySize,
    setRulerUnit,
    importAsLayer,
    updateLayerWithText,
    getLayerBounds,
    removeLayer,
    clearSelection,
    deleteSelection,
    commitFloatingSelection,
    selectLayerForTransform,
    setOverlayImages,
    isProgressMode,
    toggleProgressMode,
    setProgressMode,
    progressShadingColor,
    progressShadingOpacity,
    setProgressShadingColor,
    setProgressShadingOpacity,
    regenerateFileId,
  } = usePatternStore();

  const { currentSessionId, endSession } = useSessionHistoryStore();

  // Load bundled fonts on app startup
  useEffect(() => {
    loadBundledFonts();
  }, []);

  // Show window after React has mounted (prevents white flash on startup)
  // Only on desktop - mobile doesn't have this API
  useEffect(() => {
    const showWindow = async () => {
      // Skip on mobile/iOS - window API not available
      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isMobile) return;

      try {
        const appWindow = getCurrentWindow();
        await appWindow.show();
      } catch (error) {
        console.error('Failed to show window:', error);
      }
    };
    showWindow();
  }, []);

  // Handle window close with unsaved changes check
  // Only on desktop - mobile doesn't have this API
  useEffect(() => {
    // Skip on mobile/iOS - window API not available
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) return;

    let unlisten: (() => void) | undefined;

    const setupCloseHandler = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          // Get the latest state from the store
          const state = usePatternStore.getState();

          if (state.pattern && state.hasUnsavedChanges) {
            // Prevent the window from closing
            event.preventDefault();
            // Show our custom dialog
            setShowUnsavedChangesDialog(true);
          } else {
            // No unsaved changes or no pattern - exit immediately
            try {
              await exit(0);
            } catch (err) {
              console.error('Failed to exit:', err);
            }
          }
        });
      } catch (error) {
        console.error('Failed to setup close handler:', error);
      }
    };

    setupCloseHandler();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // State for existing file names (fetched from documents directory)
  const [existingFileNames, setExistingFileNames] = useState<string[]>([]);

  // Fetch existing NDP files from documents directory
  const refreshExistingFiles = useCallback(async () => {
    try {
      const files = await invoke<string[]>('list_ndp_files');
      // Decode URI components in case of encoded characters
      const decodedFiles = files.map(f => decodeURIComponent(f));
      setExistingFileNames(decodedFiles);
    } catch (error) {
      console.error('Failed to list NDP files:', error);
      // Fall back to extracting from recent files
      const namesFromRecent = recentFiles.map(filePath => {
        const fileName = filePath.split(/[/\\]/).pop() || '';
        return decodeURIComponent(fileName.replace(/\.ndp$/i, ''));
      });
      setExistingFileNames(namesFromRecent);
    }
  }, [recentFiles]);

  // Get next available pattern name based on existing files in directory
  const getNextPatternName = useCallback(() => {
    const baseName = 'My Pattern';

    // Use existing file names from documents directory
    const existingNames = existingFileNames;

    // Check if base name exists
    if (!existingNames.includes(baseName)) {
      return baseName;
    }

    // Find next available number
    let num = 2;
    while (existingNames.includes(`${baseName} ${num}`)) {
      num++;
    }
    return `${baseName} ${num}`;
  }, [existingFileNames]);

  // Helper to show new project dialog after refreshing file list
  const showNewProject = useCallback(async () => {
    await refreshExistingFiles();
    setShowNewProjectDialog(true);
  }, [refreshExistingFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle Delete key for area selection or layer
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // If there's an area selection with selected stitches, delete those
        if (selection?.selectionType === 'area' && selection.selectedStitches?.length) {
          e.preventDefault();
          deleteSelection();
          return;
        }

        // Otherwise, handle layer deletion
        const layerIdToDelete = selection?.layerId || activeLayerId;

        if (layerIdToDelete && pattern && pattern.layers.length > 1) {
          e.preventDefault();
          // Request layer deletion (will show confirmation if preference is enabled)
          if (preferences.confirmLayerDelete) {
            setLayerToDelete(layerIdToDelete);
            setShowDeleteConfirm(true);
          } else {
            removeLayer(layerIdToDelete);
            if (selection) clearSelection();
          }
          return;
        }
      }

      // Handle Enter key to commit floating selection
      if (e.key === 'Enter') {
        if (selection?.floatingStitches) {
          e.preventDefault();
          commitFloatingSelection();
          return;
        }
      }

      // Handle Escape key to clear selection
      if (e.key === 'Escape') {
        if (selection) {
          e.preventDefault();
          clearSelection();
          return;
        }
      }

      switch (e.key.toLowerCase()) {
        case 'p':
          setTool('pencil');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 'g':
          setTool('fill');
          break;
        case 'c':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('colorswap');
          }
          break;
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('areaselect');
          }
          break;
        case 'v':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('select');
          }
          break;
        case 't':
          if (!e.ctrlKey && !e.metaKey) {
            // Open text dialog when T is pressed (if pattern exists)
            if (pattern) {
              setShowTextEditor(true);
            }
          }
          break;
        case 'l':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('line');
          }
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('rectangle');
          }
          break;
        case 'o':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('ellipse');
          }
          break;
        case ' ':
          e.preventDefault();
          // Save current tool before switching to pan (only if not already panning)
          if (activeTool !== 'pan') {
            toolBeforePanRef.current = activeTool;
            setTool('pan');
          }
          break;
        case '+':
        case '=':
          setZoom(zoom + 0.1);
          break;
        case '-':
          setZoom(zoom - 0.1);
          break;
        case '0':
          setZoom(1);
          break;
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            showNewProject();
          }
          break;
        case 'f':
        case 'F':
          // Ctrl+Shift+F opens bitmap font editor (dev tool)
          if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();
            setShowBitmapFontEditor(true);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && activeTool === 'pan' && toolBeforePanRef.current) {
        setTool(toolBeforePanRef.current as any);
        toolBeforePanRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoom, activeTool, pattern, selection, activeLayerId, preferences.confirmLayerDelete, setTool, setZoom, removeLayer, clearSelection, deleteSelection, commitFloatingSelection, showNewProject]);

  // Add file to recent files list
  const addToRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      // Remove if already exists, then add to front
      const filtered = prev.filter((f) => f !== filePath);
      const updated = [filePath, ...filtered].slice(0, MAX_RECENT_FILES);
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Convert pattern to NDP file format
  const patternToNdp = useCallback((p: Pattern): NdpFile => {
    const now = new Date().toISOString();
    return {
      version: '1.0',
      metadata: {
        file_id: p.fileId,
        name: p.name,
        author: null,
        created_at: now,
        modified_at: now,
        software: 'NeedlePoint Designer v1.0',
      },
      canvas: {
        width: p.canvas.width,
        height: p.canvas.height,
        mesh_count: p.canvas.meshCount,
        physical_width: null,
        physical_height: null,
      },
      color_palette: p.colorPalette.map((c) => ({
        id: c.id,
        name: c.name,
        rgb: c.rgb,
        thread_brand: c.threadBrand ?? null,
        thread_code: c.threadCode ?? null,
        symbol: c.symbol ?? null,
      })),
      layers: p.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        stitches: l.stitches.map((s) => ({
          x: s.x,
          y: s.y,
          color_id: s.colorId,
          completed: s.completed,
        })),
        metadata: l.metadata ? {
          type: l.metadata.type,
          text: l.metadata.text,
          fontFamily: l.metadata.fontFamily,
          fontWeight: l.metadata.fontWeight,
          italic: l.metadata.italic,
          colorId: l.metadata.colorId,
          boldness: l.metadata.boldness,
        } : undefined,
      })),
      overlays: overlayImages.length > 0 ? overlayImages.map((o) => ({
        id: o.id,
        name: o.name,
        data_url: o.dataUrl,
        opacity: o.opacity,
        visible: o.visible,
        locked: o.locked,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        natural_width: o.naturalWidth,
        natural_height: o.naturalHeight,
      })) : undefined,
      zoom,
      is_progress_mode: isProgressMode,
      progress_shading_color: progressShadingColor,
      progress_shading_opacity: progressShadingOpacity,
    };
  }, [overlayImages, zoom, isProgressMode, progressShadingColor, progressShadingOpacity]);

  // Convert NDP file to pattern
  const ndpToPattern = useCallback((ndp: NdpFile): Pattern => {
    return {
      // Use existing fileId or generate a new one for backwards compatibility
      fileId: ndp.metadata.file_id || `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: ndp.metadata.name,
      canvas: {
        width: ndp.canvas.width,
        height: ndp.canvas.height,
        meshCount: ndp.canvas.mesh_count,
      },
      colorPalette: ndp.color_palette.map((c) => ({
        id: c.id,
        name: c.name,
        rgb: c.rgb,
        threadBrand: c.thread_brand ?? undefined,
        threadCode: c.thread_code ?? undefined,
        symbol: c.symbol ?? undefined,
      })),
      layers: ndp.layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        stitches: l.stitches.map((s) => ({
          x: s.x,
          y: s.y,
          colorId: s.color_id,
          completed: s.completed,
        })),
        metadata: l.metadata ? {
          type: l.metadata.type as 'text',
          text: l.metadata.text,
          fontFamily: l.metadata.fontFamily,
          fontWeight: l.metadata.fontWeight,
          italic: l.metadata.italic,
          colorId: l.metadata.colorId,
          boldness: l.metadata.boldness,
        } : undefined,
      })),
    };
  }, []);

  // Open a specific file path (for recent files)
  const openFilePath = useCallback(async (filePath: string) => {
    try {
      const ndpFile = await invoke<NdpFile>('open_project', { path: filePath });
      const loadedPattern = ndpToPattern(ndpFile);
      loadPattern(loadedPattern, filePath);

      // Load overlays if present
      if (ndpFile.overlays && ndpFile.overlays.length > 0) {
        const loadedOverlays = ndpFile.overlays.map((o) => ({
          id: o.id,
          name: o.name,
          dataUrl: o.data_url,
          opacity: o.opacity,
          visible: o.visible,
          locked: o.locked,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          naturalWidth: o.natural_width,
          naturalHeight: o.natural_height,
        }));
        setOverlayImages(loadedOverlays);
      } else {
        setOverlayImages([]);
      }

      // Restore zoom level
      if (ndpFile.zoom !== undefined && ndpFile.zoom !== null) {
        setZoom(ndpFile.zoom);
      }

      // Restore progress tracking settings
      if (ndpFile.is_progress_mode === true) {
        setProgressMode(true);
      } else {
        setProgressMode(false);
      }
      if (ndpFile.progress_shading_color && Array.isArray(ndpFile.progress_shading_color)) {
        setProgressShadingColor(ndpFile.progress_shading_color);
      }
      if (typeof ndpFile.progress_shading_opacity === 'number') {
        setProgressShadingOpacity(ndpFile.progress_shading_opacity);
      }

      addToRecentFiles(filePath);
    } catch (error) {
      console.error('Failed to open:', error);
      // Show a simple, user-friendly error message
      const errorStr = String(error);
      let message = 'File not found';
      if (errorStr.includes('Failed to read file')) {
        message = 'File not found. It may have been moved or deleted.';
      } else if (errorStr.includes('Failed to parse')) {
        message = 'Invalid file format.';
      }
      alert(message);
      // Remove from recent files if it failed to open
      setRecentFiles((prev) => {
        const updated = prev.filter((f) => f !== filePath);
        localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [ndpToPattern, loadPattern, addToRecentFiles, setOverlayImages, setZoom, setProgressMode, setProgressShadingColor, setProgressShadingOpacity]);

  // Save project
  const handleSave = useCallback(async () => {
    if (!pattern) return;

    try {
      let filePath = currentFilePath;

      // If no current file path, show save dialog
      if (!filePath) {
        const result = await save({
          filters: [{ name: 'NeedlePoint Design', extensions: ['ndp'] }],
          defaultPath: `${pattern.name}.ndp`,
        });

        if (!result) return; // User cancelled
        filePath = result;
      }

      const ndpFile = patternToNdp(pattern);
      // save_project returns the actual path where the file was saved (may differ on iOS)
      const savedPath = await invoke<string>('save_project', { path: filePath, project: ndpFile });

      setCurrentFilePath(savedPath);
      markSaved();
      addToRecentFiles(savedPath);
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save project: ${error}`);
    }
  }, [pattern, currentFilePath, patternToNdp, setCurrentFilePath, markSaved, addToRecentFiles]);

  // Save As
  const handleSaveAs = useCallback(async () => {
    if (!pattern) return;

    try {
      const result = await save({
        filters: [{ name: 'NeedlePoint Design', extensions: ['ndp'] }],
        defaultPath: `${pattern.name}.ndp`,
      });

      if (!result) return; // User cancelled

      // End current session if active (it belongs to the old file)
      if (currentSessionId) {
        // End with current stats (duration 0 since we don't have access to timer here)
        endSession(currentSessionId, 0, 0, 0);
      }

      // Generate new fileId for the new file (this is a new file, not the same file)
      const newFileId = regenerateFileId();

      // Create NDP with the new fileId
      const ndpFile = patternToNdp({ ...pattern, fileId: newFileId });
      // save_project returns the actual path where the file was saved (may differ on iOS)
      const savedPath = await invoke<string>('save_project', { path: result, project: ndpFile });

      setCurrentFilePath(savedPath);
      markSaved();
      addToRecentFiles(savedPath);
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save project: ${error}`);
    }
  }, [pattern, patternToNdp, setCurrentFilePath, markSaved, addToRecentFiles, regenerateFileId, currentSessionId, endSession]);

  // Open project
  const handleOpen = useCallback(async () => {
    try {
      const result = await open({
        filters: [{ name: 'NeedlePoint Design', extensions: ['ndp'] }],
        multiple: false,
      });

      if (!result) return; // User cancelled

      const ndpFile = await invoke<NdpFile>('open_project', { path: result });
      const loadedPattern = ndpToPattern(ndpFile);

      loadPattern(loadedPattern, result as string);

      // Load overlays if present
      if (ndpFile.overlays && ndpFile.overlays.length > 0) {
        const loadedOverlays = ndpFile.overlays.map((o) => ({
          id: o.id,
          name: o.name,
          dataUrl: o.data_url,
          opacity: o.opacity,
          visible: o.visible,
          locked: o.locked,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          naturalWidth: o.natural_width,
          naturalHeight: o.natural_height,
        }));
        setOverlayImages(loadedOverlays);
      } else {
        setOverlayImages([]);
      }

      // Restore zoom level
      if (ndpFile.zoom !== undefined && ndpFile.zoom !== null) {
        setZoom(ndpFile.zoom);
      }

      // Restore progress tracking settings
      if (ndpFile.is_progress_mode === true) {
        setProgressMode(true);
      } else {
        setProgressMode(false);
      }
      if (ndpFile.progress_shading_color && Array.isArray(ndpFile.progress_shading_color)) {
        setProgressShadingColor(ndpFile.progress_shading_color);
      }
      if (typeof ndpFile.progress_shading_opacity === 'number') {
        setProgressShadingOpacity(ndpFile.progress_shading_opacity);
      }

      addToRecentFiles(result as string);
    } catch (error) {
      console.error('Failed to open:', error);
      alert(`Failed to open project: ${error}`);
    }
  }, [ndpToPattern, loadPattern, addToRecentFiles, setOverlayImages, setZoom, setProgressMode, setProgressShadingColor, setProgressShadingOpacity]);

  // Save preferences to localStorage
  const updatePreferences = useCallback((newPrefs: Partial<Preferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Confirm delete layer
  const handleConfirmDelete = useCallback((suppressFutureWarnings: boolean) => {
    if (layerToDelete) {
      removeLayer(layerToDelete);
      clearSelection();
      setLayerToDelete(null);
      setShowDeleteConfirm(false);

      if (suppressFutureWarnings) {
        updatePreferences({ confirmLayerDelete: false });
      }
    }
  }, [layerToDelete, removeLayer, clearSelection, updatePreferences]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setLayerToDelete(null);
    setShowDeleteConfirm(false);
  }, []);

  // Handle unsaved changes dialog actions
  const handleUnsavedSave = useCallback(async () => {
    setShowUnsavedChangesDialog(false);
    await handleSave();
    // After saving, exit the application
    try {
      await exit(0);
    } catch (error) {
      console.error('Failed to exit:', error);
    }
  }, [handleSave]);

  const handleUnsavedDontSave = useCallback(async () => {
    setShowUnsavedChangesDialog(false);
    // Exit without saving
    try {
      await exit(0);
    } catch (error) {
      console.error('Failed to exit:', error);
    }
  }, []);

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedChangesDialog(false);
  }, []);

  // Handle File > Exit menu action
  const handleExit = useCallback(async () => {
    const state = usePatternStore.getState();
    if (state.hasUnsavedChanges) {
      setShowUnsavedChangesDialog(true);
    } else {
      try {
        await exit(0);
      } catch (error) {
        console.error('Failed to exit:', error);
      }
    }
  }, []);

  // Move to center - pan the view so the center marker is in the middle of the viewport
  const handleMoveToCenter = useCallback(() => {
    if (!pattern) return;

    // Constants from PatternCanvas
    const CELL_SIZE = 20;
    const RULER_SIZE = 24;

    // Estimate the canvas viewport dimensions
    // Layout: toolbar (48px) + canvas area + right panel (256px)
    // Canvas area includes left ruler (24px) + main canvas + right ruler (24px)
    const canvasWidth = window.innerWidth - 48 - 256 - RULER_SIZE * 2;
    const canvasHeight = window.innerHeight - 40 - 28 - RULER_SIZE; // header, status bar, top ruler

    // Calculate the center cell position in the pattern
    const centerCellX = Math.floor(pattern.canvas.width / 2);
    const centerCellY = Math.floor(pattern.canvas.height / 2);

    // Calculate the cell size at current zoom
    const cellSize = CELL_SIZE * zoom;

    // Calculate the position of the center of the center cell in pattern coordinates
    const patternCenterX = (centerCellX + 0.5) * cellSize;
    const patternCenterY = (centerCellY + 0.5) * cellSize;

    // Calculate the pan offset to center this point in the viewport
    const newPanX = canvasWidth / 2 - patternCenterX;
    const newPanY = canvasHeight / 2 - patternCenterY;

    setPanOffset({ x: newPanX, y: newPanY });
  }, [pattern, zoom, setPanOffset]);

  // Fit the entire canvas to the viewport
  const handleFitToCanvas = useCallback(() => {
    console.log('=== FIT TO CANVAS CLICKED ===');
    if (!pattern) {
      console.log('No pattern, aborting');
      return;
    }

    // Constants from PatternCanvas
    const CELL_SIZE = 20;
    const RULER_SIZE = 24;

    // Try to find the canvas viewport element
    const canvasViewport = document.querySelector('[data-canvas-viewport]') as HTMLElement;

    let viewportWidth: number;
    let viewportHeight: number;

    if (canvasViewport) {
      const rect = canvasViewport.getBoundingClientRect();
      viewportWidth = rect.width - RULER_SIZE * 2;
      viewportHeight = rect.height;
      console.log('Viewport:', { w: viewportWidth, h: viewportHeight });
    } else {
      const toolbarWidth = isProgressMode ? 0 : 56;
      const rightPanelWidth = 256;
      viewportWidth = window.innerWidth - toolbarWidth - rightPanelWidth - RULER_SIZE * 2;
      viewportHeight = window.innerHeight - 40 - 28 - RULER_SIZE;
      console.log('Fallback viewport:', { w: viewportWidth, h: viewportHeight });
    }

    // Pattern size in pixels at zoom 1.0
    const patternWidth = pattern.canvas.width * CELL_SIZE;
    const patternHeight = pattern.canvas.height * CELL_SIZE;
    console.log('Pattern px:', { w: patternWidth, h: patternHeight });

    // Calculate fit zoom
    const zoomX = viewportWidth / patternWidth;
    const zoomY = viewportHeight / patternHeight;
    const fitZoom = Math.min(zoomX, zoomY);

    console.log('Calculated zoom:', { zoomX, zoomY, fitZoom, percent: Math.round(fitZoom * 100) + '%' });

    // Apply zoom and reset pan
    setZoom(fitZoom);
    setPanOffset({ x: 0, y: 0 });
    console.log('=== DONE ===');
  }, [pattern, isProgressMode, setZoom, setPanOffset]);

  // Sync history size with store when preferences change
  useEffect(() => {
    setMaxHistorySize(preferences.historySize);
  }, [preferences.historySize, setMaxHistorySize]);

  // Sync ruler unit with store when preferences change
  useEffect(() => {
    setRulerUnit(preferences.rulerUnit);
  }, [preferences.rulerUnit, setRulerUnit]);

  // Auto-save effect
  useEffect(() => {
    if (!preferences.autoSaveMinutes || !pattern || !currentFilePath || !hasUnsavedChanges) {
      return;
    }

    const intervalMs = preferences.autoSaveMinutes * 60 * 1000;
    const autoSaveTimer = setInterval(() => {
      // Only auto-save if there's a file path and unsaved changes
      if (currentFilePath && hasUnsavedChanges) {
        handleSave();
        console.log('Auto-saved at', new Date().toLocaleTimeString());
      }
    }, intervalMs);

    return () => clearInterval(autoSaveTimer);
  }, [preferences.autoSaveMinutes, pattern, currentFilePath, hasUnsavedChanges, handleSave]);

  // Handle text confirm - create a new layer with the text or update existing text layer
  const handleTextConfirm = useCallback((
    stitches: Stitch[],
    width: number,
    height: number,
    colorToAdd?: { id: string; name: string; rgb: [number, number, number] },
    metadata?: TextLayerMetadata
  ) => {
    if (stitches.length === 0) return;

    // EDIT MODE: Update existing layer in place
    if (editingTextLayerId && metadata) {
      const bounds = getLayerBounds(editingTextLayerId);
      const offsetX = bounds?.x || 0;
      const offsetY = bounds?.y || 0;

      const positionedStitches = stitches.map(s => ({
        ...s,
        x: s.x + offsetX,
        y: s.y + offsetY,
      }));

      updateLayerWithText(editingTextLayerId, positionedStitches, metadata);
      setEditingTextLayerId(null);

      // Re-select the layer to update selection bounds
      selectLayerForTransform(editingTextLayerId);
      return;
    }

    // CREATE MODE: Add new layer
    // Get unique colors from the stitches
    const colorIds = new Set(stitches.map(s => s.colorId));
    let colors = pattern?.colorPalette.filter(c => colorIds.has(c.id)) || [];

    // If a new color needs to be added (e.g., black when palette was empty)
    if (colorToAdd) {
      colors = [...colors, colorToAdd];
    }

    // Create a new layer with the text - position at center of canvas
    const offsetX = pattern ? Math.floor((pattern.canvas.width - width) / 2) : 0;
    const offsetY = pattern ? Math.floor((pattern.canvas.height - height) / 2) : 0;

    const positionedStitches = stitches.map(s => ({
      ...s,
      x: s.x + offsetX,
      y: s.y + offsetY,
    }));

    // Generate a unique layer name
    const layerName = `Text ${new Date().toLocaleTimeString()}`;
    importAsLayer(layerName, colors, positionedStitches, metadata);

    // Switch to select tool and select the new layer for transformation
    setTool('select');

    // Get the newly created layer's ID (importAsLayer sets activeLayerId)
    const newLayerId = usePatternStore.getState().activeLayerId;
    if (newLayerId) {
      selectLayerForTransform(newLayerId);
    }
  }, [pattern, editingTextLayerId, getLayerBounds, updateLayerWithText, importAsLayer, setTool, selectLayerForTransform]);

  // Handle editing an existing text layer
  const handleEditTextLayer = useCallback((layerId: string) => {
    const layer = pattern?.layers.find(l => l.id === layerId);
    if (layer?.metadata?.type === 'text') {
      setEditingTextLayerId(layerId);
      setSelectedFont(layer.metadata.fontFamily);
      setSelectedFontWeight(layer.metadata.fontWeight);
      setShowTextEditor(true);
    }
  }, [pattern]);

  // Handle font selection from browser
  const handleFontSelect = useCallback((fontFamily: string, weight: number) => {
    setSelectedFont(fontFamily);
    setSelectedFontWeight(weight);
  }, []);

  // Add Ctrl+S, Ctrl+O, Ctrl+Z, Ctrl+Shift+Z shortcuts
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAs();
        } else {
          handleSave();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpen();
      }
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [handleSave, handleSaveAs, handleOpen, undo, redo]);

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {/* Title Bar / Menu */}
      <header
        className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between shrink-0"
        onMouseDown={(e) => {
          // Start window drag on blank areas (but not on interactive elements or window controls)
          if ((e.target as HTMLElement).closest('nav, button, a, input, select, [data-window-controls]')) return;
          e.preventDefault();
          getCurrentWindow().startDragging();
        }}
      >
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">NeedlePoint Designer</h1>
          <nav className="flex gap-4 text-sm relative z-50">
            {/* Global backdrop to close menus when clicking outside */}
            {(showFileMenu || showToolsMenu || showPreferencesMenu) && (
              <div
                className="fixed inset-0 z-40"
                onClick={closeAllMenus}
              />
            )}

            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu(setShowFileMenu, showFileMenu)}
                className="hover:text-blue-300 transition-colors relative z-50"
              >
                File
              </button>
              {showFileMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-40 z-50">
                  <button
                    onClick={() => { showNewProject(); setShowFileMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors"
                  >
                    New <span className="text-gray-400 text-xs float-right">Ctrl+N</span>
                  </button>
                  <button
                    onClick={() => { handleOpen(); setShowFileMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors"
                  >
                    Open <span className="text-gray-400 text-xs float-right">Ctrl+O</span>
                  </button>
                  {/* Open Recent Submenu */}
                  <div
                    className="relative"
                    onMouseEnter={() => setShowRecentMenu(true)}
                    onMouseLeave={() => setShowRecentMenu(false)}
                  >
                    <button
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center justify-between ${recentFiles.length === 0 ? 'opacity-50' : ''}`}
                      disabled={recentFiles.length === 0}
                    >
                      Open Recent
                      <span className="text-gray-400">▶</span>
                    </button>
                    {showRecentMenu && recentFiles.length > 0 && (
                      <div className="absolute left-full top-0 ml-1 bg-gray-700 rounded shadow-lg py-1 min-w-[250px] max-w-[400px] z-50">
                        {recentFiles.map((filePath, index) => (
                          <button
                            key={index}
                            onClick={() => { openFilePath(filePath); setShowFileMenu(false); setShowRecentMenu(false); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors truncate"
                            title={decodeURIComponent(filePath)}
                          >
                            {decodeURIComponent(filePath.split(/[/\\]/).pop() || '')}
                            <span className="block text-xs text-gray-400 truncate">{decodeURIComponent(filePath)}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-600 my-1" />
                        <button
                          onClick={() => {
                            setRecentFiles([]);
                            localStorage.removeItem(RECENT_FILES_KEY);
                            setShowRecentMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors text-gray-400"
                        >
                          Clear Recent Files
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { handleSave(); setShowFileMenu(false); }}
                    disabled={!pattern}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Save{hasUnsavedChanges ? ' *' : ''} <span className="text-gray-400 text-xs float-right">Ctrl+S</span>
                  </button>
                  <button
                    onClick={() => { handleSaveAs(); setShowFileMenu(false); }}
                    disabled={!pattern}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Save As <span className="text-gray-400 text-xs float-right">Ctrl+Shift+S</span>
                  </button>
                  <div className="border-t border-gray-600 my-1" />
                  <button
                    onClick={() => {
                      setShowExportPdfDialog(true);
                      setShowFileMenu(false);
                    }}
                    disabled={!pattern}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Export PDF
                  </button>
                  <div className="border-t border-gray-600 my-1" />
                  <button
                    onClick={() => { handleExit(); setShowFileMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors"
                  >
                    Exit <span className="text-gray-400 text-xs float-right">Alt+F4</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tools Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu(setShowToolsMenu, showToolsMenu)}
                className="hover:text-blue-300 transition-colors relative z-50"
              >
                Tools
              </button>
              {showToolsMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-48 z-50">
                    <button
                      onClick={() => { toggleProgressMode(); setShowToolsMenu(false); }}
                      disabled={!pattern}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''} ${isProgressMode ? 'bg-green-700' : ''}`}
                    >
                      {isProgressMode ? 'Exit Progress Tracking' : 'Progress Tracking'}
                    </button>
                    <div className="border-t border-gray-600 my-1" />
                    <button
                      onClick={() => { setShowUploadImageDialog(true); setShowToolsMenu(false); }}
                      disabled={!pattern}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Upload Image
                    </button>
                    <div className="border-t border-gray-600 my-1" />
                    <button
                      onClick={() => { setShowColorMatchDialog(true); setShowToolsMenu(false); }}
                      disabled={!pattern}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Color Matching
                    </button>
                    <button
                      onClick={() => { setShowSymbolDialog(true); setShowToolsMenu(false); }}
                      disabled={!pattern}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Symbol Assignment
                    </button>
                    <div className="border-t border-gray-600 my-1" />
                    <button
                      onClick={() => { handleMoveToCenter(); setShowToolsMenu(false); }}
                      disabled={!pattern}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors ${!pattern ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Move to Center
                    </button>
                    <div className="border-t border-gray-600 my-1" />
                    {/* Advanced Submenu */}
                    <div className="relative group">
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center justify-between"
                      >
                        Advanced
                        <span className="text-gray-400">▶</span>
                      </button>
                      {/* Invisible bridge to prevent gap between menu and submenu */}
                      <div className="absolute left-full top-0 w-2 h-full hidden group-hover:block" />
                      <div className="absolute left-full top-0 ml-1 bg-gray-700 rounded shadow-lg py-1 min-w-[180px] z-50 hidden group-hover:block">
                        <button
                          onClick={() => { setShowBitmapFontEditor(true); setShowToolsMenu(false); }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors"
                        >
                          Font Creator
                          <span className="block text-xs text-gray-400">Ctrl+Shift+F</span>
                        </button>
                      </div>
                    </div>
                </div>
              )}
            </div>

            {/* Preferences Menu */}
            <div className="relative">
              <button
                onClick={() => toggleMenu(setShowPreferencesMenu, showPreferencesMenu)}
                className="hover:text-blue-300 transition-colors relative z-50"
              >
                Preferences
              </button>
              {showPreferencesMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-[280px] z-50">
                    <div className="px-4 py-2">
                      <label className="block text-xs text-gray-400 mb-1">Auto-Save</label>
                      <select
                        value={preferences.autoSaveMinutes ?? 'none'}
                        onChange={(e) => {
                          const value = e.target.value;
                          updatePreferences({
                            autoSaveMinutes: value === 'none' ? null : parseInt(value, 10),
                          });
                        }}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="none">None (disabled)</option>
                        <option value="1">Every 1 minute</option>
                        <option value="2">Every 2 minutes</option>
                        <option value="5">Every 5 minutes</option>
                        <option value="10">Every 10 minutes</option>
                        <option value="15">Every 15 minutes</option>
                        <option value="30">Every 30 minutes</option>
                      </select>
                    </div>
                    <div className="px-4 py-2 border-t border-gray-600">
                      <label className="block text-xs text-gray-400 mb-1">Undo History</label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={preferences.historySize}
                        onChange={(e) => {
                          const value = Math.max(10, Math.min(200, parseInt(e.target.value) || 50));
                          updatePreferences({ historySize: value });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setShowPreferencesMenu(false);
                          }
                        }}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-500 mt-1 block">
                        {history.length} / {preferences.historySize} steps
                      </span>
                    </div>
                    <div className="px-4 py-2 border-t border-gray-600">
                      <label className="block text-xs text-gray-400 mb-1">Ruler Units</label>
                      <select
                        value={preferences.rulerUnit}
                        onChange={(e) => {
                          updatePreferences({ rulerUnit: e.target.value as RulerUnit });
                        }}
                        className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="inches">Inches</option>
                        <option value="mm">Millimeters</option>
                        <option value="squares">Squares</option>
                      </select>
                    </div>
                    <div className="px-4 py-3 border-t border-gray-600">
                      <ToggleSwitch
                        checked={preferences.confirmLayerDelete}
                        onChange={(checked) => updatePreferences({ confirmLayerDelete: checked })}
                        label="Confirm Layer Delete"
                      />
                    </div>
                    <div className="px-4 py-3 border-t border-gray-600">
                      <ToggleSwitch
                        checked={preferences.showSymbols}
                        onChange={(checked) => updatePreferences({ showSymbols: checked })}
                        label="Show Symbols"
                      />
                    </div>
                    <div className="px-4 py-3 border-t border-gray-600">
                      <ToggleSwitch
                        checked={preferences.showCenterMarker}
                        onChange={(checked) => updatePreferences({ showCenterMarker: checked })}
                        label="Show Center Marker"
                      />
                    </div>
                    {/* Toolbar Visibility - opens modal */}
                    <button
                      className="w-full px-4 py-2 text-left hover:bg-gray-600 border-t border-gray-600 flex items-center justify-between"
                      onClick={() => {
                        setShowToolbarVisibilityDialog(true);
                        setShowPreferencesMenu(false);
                      }}
                    >
                      <span>Toolbar Visibility...</span>
                      <span className="text-gray-400">→</span>
                    </button>
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {pattern && (
            <span className="text-sm text-gray-300">
              {currentFilePath
                ? decodeURIComponent(currentFilePath.split(/[/\\]/).pop() || '')
                : pattern.name}
              {hasUnsavedChanges ? ' *' : ''} - {pattern.canvas.width} x {pattern.canvas.height}
            </span>
          )}
          <span className="text-sm text-gray-400">v1.1.1</span>
          {/* Window Controls */}
          <div className="flex items-center gap-1 ml-4" data-window-controls style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Minimize clicked');
                getCurrentWindow().minimize();
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
              title="Minimize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ pointerEvents: 'none' }}>
                <rect y="5" width="12" height="2" />
              </svg>
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Maximize clicked');
                getCurrentWindow().toggleMaximize();
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
              title="Maximize"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ pointerEvents: 'none' }}>
                <rect x="1" y="1" width="10" height="10" />
              </svg>
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close clicked');
                getCurrentWindow().close();
              }}
              className="w-8 h-8 flex items-center justify-center hover:bg-red-600 rounded transition-colors"
              style={{ WebkitAppRegion: 'no-drag', appRegion: 'no-drag' } as React.CSSProperties}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ pointerEvents: 'none' }}>
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {pattern ? (
          <>
            {/* Left Toolbar - hidden in progress mode */}
            {!isProgressMode && (
              <Toolbar onTextToolClick={() => setShowTextEditor(true)} onFitToCanvas={handleFitToCanvas} onPreviewClick={() => setShowPreviewDialog(true)} toolVisibility={preferences.toolVisibility} />
            )}

            {/* Canvas Area */}
            <PatternCanvas showSymbols={preferences.showSymbols} showCenterMarker={preferences.showCenterMarker} />

            {/* Right Panel - either Progress Tracking or Layers/Colors */}
            {isProgressMode ? (
              <ProgressTrackingPanel />
            ) : (
              <div className="w-64 flex flex-col border-l border-gray-300 overflow-hidden">
                <LayerPanel onEditTextLayer={handleEditTextLayer} />
                <ColorPalette showSymbols={preferences.showSymbols} />
              </div>
            )}
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-lg">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Welcome to NeedlePoint Designer
              </h2>
              <p className="text-gray-600 mb-8">
                Create beautiful needlepoint and cross-stitch patterns
              </p>

              <button
                onClick={() => showNewProject()}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
              >
                Create New Pattern
              </button>

              <div className="mt-6 text-sm text-gray-500">
                <p>Press Ctrl+N to create a new pattern</p>
              </div>

              {/* Recent Files */}
              {recentFiles.length > 0 && (
                <div className="mt-8 text-left">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Files</h3>
                  <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {recentFiles.slice(0, 10).map((filePath, index) => (
                      <button
                        key={index}
                        onClick={() => openFilePath(filePath)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {decodeURIComponent(filePath.split(/[/\\]/).pop() || '')}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {decodeURIComponent(filePath)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Status Bar */}
      <footer className={`px-4 py-1 text-sm flex justify-between shrink-0 ${isProgressMode ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
        <div className="flex gap-4">
          {isProgressMode ? (
            <span className="font-medium">Progress Tracking Mode - Click stitches to mark complete</span>
          ) : (
            <span>
              Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}
            </span>
          )}
          {pattern && (
            <>
              <span>|</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
                  className="px-1.5 hover:bg-gray-300 rounded text-base leading-none"
                  title="Zoom Out (-)"
                >
                  −
                </button>
                <button
                  onClick={handleFitToCanvas}
                  className="hover:text-blue-600 hover:underline cursor-pointer min-w-[60px] text-center"
                  title="Click to fit canvas to viewport"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={() => setZoom(Math.min(10, zoom + 0.1))}
                  className="px-1.5 hover:bg-gray-300 rounded text-base leading-none"
                  title="Zoom In (+)"
                >
                  +
                </button>
              </div>
              <span>|</span>
              <span>
                Layer: {pattern.layers.find(l => l.id === activeLayerId)?.name || 'None'}
              </span>
              <span>|</span>
              <span>
                {pattern.layers.reduce((acc, l) => acc + l.stitches.length, 0)} stitches
              </span>
            </>
          )}
        </div>
        <div className="flex gap-4">
          {pattern ? (
            <>
              <span>
                {pattern.canvas.width} x {pattern.canvas.height} ({pattern.canvas.meshCount} count)
              </span>
              <span>|</span>
              <span>{pattern.layers.length} layer{pattern.layers.length !== 1 ? 's' : ''}</span>
              <span>|</span>
              <span>{pattern.colorPalette.length} colors</span>
            </>
          ) : (
            <span>No pattern loaded</span>
          )}
        </div>
      </footer>

      {/* Dialogs */}
      <NewProjectDialog
        isOpen={showNewProjectDialog}
        onClose={() => setShowNewProjectDialog(false)}
        defaultName={getNextPatternName()}
      />
      <ImportImageDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />

      {/* Text Tool Dialogs */}
      <TextEditorDialog
        isOpen={showTextEditor}
        onClose={() => {
          setShowTextEditor(false);
          setEditingTextLayerId(null);
        }}
        onConfirm={handleTextConfirm}
        colorPalette={pattern?.colorPalette || []}
        initialColorId={selectedColorId || 'color-1'}
        onOpenFontBrowser={(previewText) => {
          setFontBrowserPreviewText(previewText);
          setShowFontBrowser(true);
        }}
        selectedFont={selectedFont}
        selectedWeight={selectedFontWeight}
        onWeightChange={setSelectedFontWeight}
        editMode={!!editingTextLayerId}
        initialMetadata={
          editingTextLayerId
            ? pattern?.layers.find(l => l.id === editingTextLayerId)?.metadata as TextLayerMetadata | undefined
            : undefined
        }
        initialHeight={
          editingTextLayerId
            ? getLayerBounds(editingTextLayerId)?.height
            : undefined
        }
      />

      <FontBrowserDialog
        isOpen={showFontBrowser}
        onClose={() => setShowFontBrowser(false)}
        onSelectFont={handleFontSelect}
        currentFont={selectedFont}
        currentWeight={selectedFontWeight}
        onOpenFontCreator={() => setShowBitmapFontEditor(true)}
        previewText={fontBrowserPreviewText}
      />

      {/* Bitmap Font Editor - Dev Tool (Ctrl+Shift+F) */}
      <BitmapFontEditor
        isOpen={showBitmapFontEditor}
        onClose={() => setShowBitmapFontEditor(false)}
      />

      {/* Delete Layer Confirmation Dialog */}
      {showDeleteConfirm && layerToDelete && (
        <DeleteLayerDialog
          layerName={pattern?.layers.find(l => l.id === layerToDelete)?.name || 'Layer'}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* Export PDF Dialog */}
      {pattern && (
        <ExportPdfDialog
          isOpen={showExportPdfDialog}
          onClose={() => setShowExportPdfDialog(false)}
          pattern={pattern}
        />
      )}

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedChangesDialog}
        onSave={handleUnsavedSave}
        onDontSave={handleUnsavedDontSave}
        onCancel={handleUnsavedCancel}
        fileName={currentFilePath ? decodeURIComponent(currentFilePath.split(/[/\\]/).pop() || '') : pattern?.name || 'Untitled'}
      />

      {/* Color Match Dialog */}
      <ColorMatchDialog
        isOpen={showColorMatchDialog}
        onClose={() => setShowColorMatchDialog(false)}
      />

      {/* Symbol Assignment Dialog */}
      <SymbolAssignmentDialog
        isOpen={showSymbolDialog}
        onClose={() => setShowSymbolDialog(false)}
      />

      {/* Overlay Image Dialog */}
      <OverlayImageDialog
        isOpen={showOverlayDialog}
        onClose={() => setShowOverlayDialog(false)}
      />

      {/* Upload Image Dialog (unified entry point) */}
      <UploadImageDialog
        isOpen={showUploadImageDialog}
        onClose={() => setShowUploadImageDialog(false)}
        onSelectConvert={() => setShowImportDialog(true)}
        onSelectOverlay={() => setShowOverlayDialog(true)}
      />

      {/* Preview Canvas Dialog */}
      {showPreviewDialog && (
        <PreviewCanvasDialog onClose={() => setShowPreviewDialog(false)} />
      )}

      {/* Toolbar Visibility Dialog */}
      {showToolbarVisibilityDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Toolbar Visibility</h2>
              <button
                onClick={() => setShowToolbarVisibilityDialog(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ×
              </button>
            </div>

            {/* Content - 2 columns */}
            <div className="p-4 overflow-y-auto grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Drawing Tools</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.pencil} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, pencil: checked } })} icon={<span className="text-lg">✏️</span>} label="Pencil (P)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.eraser} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, eraser: checked } })} icon={<EraserIcon className="w-5 h-5" />} label="Eraser (E)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.fill} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, fill: checked } })} icon={<FillIcon className="w-5 h-5" />} label="Fill (G)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.colorswap} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, colorswap: checked } })} icon={<ColorSwapIcon className="w-5 h-5" />} label="Color Swap (C)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.pan} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, pan: checked } })} icon={<PanIcon className="w-5 h-5" />} label="Pan (Space)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.select} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, select: checked } })} icon={<CursorIcon className="w-5 h-5" />} label="Move (V)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.text} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, text: checked } })} icon={<TextIcon className="w-5 h-5" />} label="Text (T)" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Shape Tools</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.line} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, line: checked } })} icon={<span className="text-lg">╱</span>} label="Line (L)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.rectangle} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, rectangle: checked } })} icon={<span className="text-lg">▢</span>} label="Rectangle (R)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.ellipse} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, ellipse: checked } })} icon={<span className="text-lg">◯</span>} label="Ellipse (O)" />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">History</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.undo} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, undo: checked } })} icon={<span className="text-lg">↩️</span>} label="Undo (Ctrl+Z)" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.redo} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, redo: checked } })} icon={<span className="text-lg">↪️</span>} label="Redo (Ctrl+Y)" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Zoom</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.zoomIn} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, zoomIn: checked } })} icon={<span className="text-sm">🔍+</span>} label="Zoom In" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.zoomOut} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, zoomOut: checked } })} icon={<span className="text-sm">🔍−</span>} label="Zoom Out" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.zoomFit} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, zoomFit: checked } })} icon={<span className="text-xs font-medium">Fit</span>} label="Fit to Window" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">View</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.grid} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, grid: checked } })} icon={<span className="text-lg">#</span>} label="Grid Toggle" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.preview} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, preview: checked } })} icon={<PreviewCanvasIcon className="w-5 h-5" />} label="Preview Canvas" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.areaselect} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, areaselect: checked } })} icon={<AreaSelectIcon className="w-5 h-5" />} label="Area Select (S)" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Selection Actions</h3>
                  <div className="space-y-2">
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionMove} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionMove: checked } })} icon={<SelectionMoveIcon className="w-5 h-5" />} label="Move Selection" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionDuplicate} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionDuplicate: checked } })} icon={<SelectionDuplicateIcon className="w-5 h-5" />} label="Duplicate Selection" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionNewLayer} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionNewLayer: checked } })} icon={<SelectionNewLayerIcon className="w-5 h-5" />} label="Move to New Layer" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionDuplicateToNewLayer} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionDuplicateToNewLayer: checked } })} icon={<SelectionDuplicateToNewLayerIcon className="w-5 h-5" />} label="Duplicate to New Layer" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionFlipHorizontal} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionFlipHorizontal: checked } })} icon={<FlipHorizontalIcon className="w-5 h-5" />} label="Flip Horizontal" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionFlipVertical} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionFlipVertical: checked } })} icon={<FlipVerticalIcon className="w-5 h-5" />} label="Flip Vertical" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionRotateLeft} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionRotateLeft: checked } })} icon={<RotateLeftIcon className="w-5 h-5" />} label="Rotate Left" />
                    <ToolVisibilityRow checked={preferences.toolVisibility.selectionRotateRight} onChange={(checked) => updatePreferences({ toolVisibility: { ...preferences.toolVisibility, selectionRotateRight: checked } })} icon={<RotateRightIcon className="w-5 h-5" />} label="Rotate Right" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowToolbarVisibilityDialog(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
