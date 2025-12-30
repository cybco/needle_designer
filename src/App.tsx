import { useState, useEffect, useCallback } from 'react';
import { PatternCanvas } from './components/PatternCanvas';
import { ColorPalette } from './components/ColorPalette';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { NewProjectDialog } from './components/NewProjectDialog';
import { ImportImageDialog } from './components/ImportImageDialog';
import { TextEditorDialog } from './components/TextEditorDialog';
import { FontBrowserDialog } from './components/FontBrowserDialog';
import { usePatternStore, Pattern, RulerUnit, Stitch } from './stores/patternStore';
import { loadBundledFonts } from './data/bundledFonts';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';

// NDP file format for Tauri
interface NdpFile {
  version: string;
  metadata: {
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
  }>;
}

const RECENT_FILES_KEY = 'needlepoint-recent-files';
const MAX_RECENT_FILES = 10;
const PREFERENCES_KEY = 'needlepoint-preferences';

interface Preferences {
  autoSaveMinutes: number | null; // null means disabled
  historySize: number;
  rulerUnit: RulerUnit;
}

const DEFAULT_PREFERENCES: Preferences = {
  autoSaveMinutes: 1,
  historySize: 50,
  rulerUnit: 'inches',
};

function App() {
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showPreferencesMenu, setShowPreferencesMenu] = useState(false);
  const [showRecentMenu, setShowRecentMenu] = useState(false);
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
  const [textPosition, setTextPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedFont, setSelectedFont] = useState('Roboto');
  const [selectedFontWeight, setSelectedFontWeight] = useState(400);

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
    setTool,
    setZoom,
    loadPattern,
    setCurrentFilePath,
    markSaved,
    undo,
    redo,
    setMaxHistorySize,
    setRulerUnit,
    createFloatingSelection,
    commitFloatingSelection,
    cancelFloatingSelection,
  } = usePatternStore();

  // Load bundled fonts on app startup
  useEffect(() => {
    loadBundledFonts();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Handle floating selection commit/cancel
      if (selection?.floatingStitches) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitFloatingSelection();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelFloatingSelection();
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
        case 's':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('select');
          }
          break;
        case 't':
          if (!e.ctrlKey && !e.metaKey) {
            setTool('text');
          }
          break;
        case ' ':
          e.preventDefault();
          setTool('pan');
          break;
        case '+':
        case '=':
          setZoom(zoom + 0.25);
          break;
        case '-':
          setZoom(zoom - 0.25);
          break;
        case '0':
          setZoom(1);
          break;
        case 'n':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowNewProjectDialog(true);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && activeTool === 'pan') {
        setTool('pencil');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoom, activeTool, selection, setTool, setZoom, commitFloatingSelection, cancelFloatingSelection]);

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
      })),
    };
  }, []);

  // Convert NDP file to pattern
  const ndpToPattern = useCallback((ndp: NdpFile): Pattern => {
    return {
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
      })),
    };
  }, []);

  // Open a specific file path (for recent files)
  const openFilePath = useCallback(async (filePath: string) => {
    try {
      const ndpFile = await invoke<NdpFile>('open_project', { path: filePath });
      const loadedPattern = ndpToPattern(ndpFile);
      loadPattern(loadedPattern, filePath);
      addToRecentFiles(filePath);
    } catch (error) {
      console.error('Failed to open:', error);
      alert(`Failed to open project: ${error}`);
      // Remove from recent files if it failed to open
      setRecentFiles((prev) => {
        const updated = prev.filter((f) => f !== filePath);
        localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [ndpToPattern, loadPattern, addToRecentFiles]);

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
      await invoke('save_project', { path: filePath, project: ndpFile });

      setCurrentFilePath(filePath);
      markSaved();
      addToRecentFiles(filePath);
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

      const ndpFile = patternToNdp(pattern);
      await invoke('save_project', { path: result, project: ndpFile });

      setCurrentFilePath(result);
      markSaved();
      addToRecentFiles(result);
    } catch (error) {
      console.error('Failed to save:', error);
      alert(`Failed to save project: ${error}`);
    }
  }, [pattern, patternToNdp, setCurrentFilePath, markSaved, addToRecentFiles]);

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
      addToRecentFiles(result as string);
    } catch (error) {
      console.error('Failed to open:', error);
      alert(`Failed to open project: ${error}`);
    }
  }, [ndpToPattern, loadPattern, addToRecentFiles]);

  // Save preferences to localStorage
  const updatePreferences = useCallback((newPrefs: Partial<Preferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

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

  // Text tool click handler
  const handleTextToolClick = useCallback((position: { x: number; y: number }) => {
    setTextPosition(position);
    setShowTextEditor(true);
  }, []);

  // Handle text confirm - create floating selection for positioning
  const handleTextConfirm = useCallback((stitches: Stitch[], width: number, height: number) => {
    if (!textPosition || stitches.length === 0) return;

    // Create a floating selection that the user can move before committing
    createFloatingSelection(stitches, width, height, textPosition);

    // Reset text position
    setTextPosition(null);
  }, [textPosition, createFloatingSelection]);

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
    <div className="min-h-screen h-screen flex flex-col bg-gray-100">
      {/* Title Bar / Menu */}
      <header className="bg-gray-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">NeedlePoint Designer</h1>
          <nav className="flex gap-4 text-sm">
            {/* File Menu */}
            <div className="relative">
              <button
                onClick={() => setShowFileMenu(!showFileMenu)}
                onBlur={() => setTimeout(() => setShowFileMenu(false), 150)}
                className="hover:text-blue-300 transition-colors"
              >
                File
              </button>
              {showFileMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-[160px] z-50">
                  <button
                    onClick={() => { setShowNewProjectDialog(true); setShowFileMenu(false); }}
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
                            title={filePath}
                          >
                            {filePath.split(/[/\\]/).pop()}
                            <span className="block text-xs text-gray-400 truncate">{filePath}</span>
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
                    disabled
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors opacity-50 cursor-not-allowed"
                  >
                    Export
                  </button>
                </div>
              )}
            </div>

            {/* Import Menu */}
            <div className="relative">
              <button
                onClick={() => setShowImportMenu(!showImportMenu)}
                onBlur={() => setTimeout(() => setShowImportMenu(false), 150)}
                className="hover:text-blue-300 transition-colors"
              >
                Import
              </button>
              {showImportMenu && (
                <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-[160px] z-50">
                  <button
                    onClick={() => { setShowImportDialog(true); setShowImportMenu(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors"
                  >
                    Import Image
                  </button>
                </div>
              )}
            </div>

            {/* Preferences Menu */}
            <div className="relative">
              <button
                onClick={() => setShowPreferencesMenu(!showPreferencesMenu)}
                className="hover:text-blue-300 transition-colors"
              >
                Preferences
              </button>
              {showPreferencesMenu && (
                <>
                  {/* Backdrop to close menu when clicking outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPreferencesMenu(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg py-1 min-w-[200px] z-50">
                    <div className="px-4 py-2">
                      <label className="block text-xs text-gray-400 mb-1">Auto-save</label>
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
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {pattern && (
            <span className="text-sm text-gray-300">
              {currentFilePath
                ? currentFilePath.split(/[/\\]/).pop()
                : pattern.name}
              {hasUnsavedChanges ? ' *' : ''} - {pattern.canvas.width} x {pattern.canvas.height}
            </span>
          )}
          <span className="text-sm text-gray-400">v1.0.0</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {pattern ? (
          <>
            {/* Left Toolbar */}
            <Toolbar />

            {/* Canvas Area */}
            <PatternCanvas onTextToolClick={handleTextToolClick} />

            {/* Right Panel - Layers and Colors */}
            <div className="flex flex-col border-l border-gray-300">
              <LayerPanel />
              <ColorPalette />
            </div>
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">
                Welcome to NeedlePoint Designer
              </h2>
              <p className="text-gray-600 mb-8">
                Create beautiful needlepoint and cross-stitch patterns
              </p>

              <button
                onClick={() => setShowNewProjectDialog(true)}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
              >
                Create New Pattern
              </button>

              <div className="mt-8 text-sm text-gray-500">
                <p>Press Ctrl+N to create a new pattern</p>
                <p className="mt-2">Powered by Tauri + React + TypeScript</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Status Bar */}
      <footer className="bg-gray-200 px-4 py-1 text-sm text-gray-600 flex justify-between shrink-0">
        <div className="flex gap-4">
          <span>
            Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}
          </span>
          {pattern && (
            <>
              <span>|</span>
              <span>Zoom: {Math.round(zoom * 100)}%</span>
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
          setTextPosition(null);
        }}
        onConfirm={handleTextConfirm}
        colorPalette={pattern?.colorPalette || []}
        initialColorId={selectedColorId || 'color-1'}
        onOpenFontBrowser={() => setShowFontBrowser(true)}
        selectedFont={selectedFont}
        selectedWeight={selectedFontWeight}
      />

      <FontBrowserDialog
        isOpen={showFontBrowser}
        onClose={() => setShowFontBrowser(false)}
        onSelectFont={handleFontSelect}
        currentFont={selectedFont}
        currentWeight={selectedFontWeight}
      />
    </div>
  );
}

export default App;
