import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { usePatternStore } from '../stores/patternStore';
import { useSessionHistoryStore, formatSessionDate } from '../stores/sessionHistoryStore';

interface ColorProgress {
  colorId: string;
  colorName: string;
  rgb: [number, number, number];
  totalStitches: number;
  completedStitches: number;
  percentage: number;
}

export function ProgressTrackingPanel() {
  const {
    pattern,
    currentFilePath,
    toggleProgressMode,
    progressShadingColor: storeShadingColor,
    progressShadingOpacity: storeShadingOpacity,
    setProgressShadingColor,
    setProgressShadingOpacity,
    activeTool,
    setTool,
  } = usePatternStore();

  const {
    sessions,
    currentSessionId,
    isLoaded,
    loadHistory,
    startSession,
    findActiveSessionByFileId,
    pauseSession,
    resumeSession,
    endSession,
    updateCurrentSession,
    deleteSession,
  } = useSessionHistoryStore();

  // Ensure shading values have defaults
  const progressShadingColor = storeShadingColor ?? [128, 128, 128] as [number, number, number];
  const progressShadingOpacity = storeShadingOpacity ?? 70;

  const isPanning = activeTool === 'pan';

  const togglePan = () => {
    setTool(isPanning ? 'pencil' : 'pan');
  };

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showSessionStats, setShowSessionStats] = useState(true);
  const [showOverallProgress, setShowOverallProgress] = useState(true);
  const [showColorProgress, setShowColorProgress] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [etaUpdateSeconds, setEtaUpdateSeconds] = useState(0); // 0 = realtime
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null); // Session ID pending deletion confirmation

  // Session timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionStartStitches, setSessionStartStitches] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCompletedRef = useRef(0);

  // Throttled ETA display state
  const [displayedEta, setDisplayedEta] = useState<number | null>(null);
  const lastEtaUpdateRef = useRef<number>(0);

  // Load session history on mount
  useEffect(() => {
    if (!isLoaded) {
      loadHistory();
    }
  }, [isLoaded, loadHistory]);

  // Convert RGB to hex for color input
  const rgbToHex = (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  // Convert hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [128, 128, 128];
  };

  // Preset colors for quick selection
  const presetColors: [number, number, number][] = [
    [128, 128, 128], // Grey
    [200, 200, 200], // Light grey
    [80, 80, 80],    // Dark grey
    [100, 149, 237], // Cornflower blue
    [144, 238, 144], // Light green
    [255, 182, 193], // Light pink
  ];

  const progressData = useMemo(() => {
    if (!pattern) return null;

    // Collect all stitches from all visible layers
    const allStitches = pattern.layers
      .filter(layer => layer.visible)
      .flatMap(layer => layer.stitches);

    const totalStitches = allStitches.length;
    const completedStitches = allStitches.filter(s => s.completed).length;
    const overallPercentage = totalStitches > 0 ? (completedStitches / totalStitches) * 100 : 0;

    // Calculate progress by color
    const colorMap = new Map<string, { total: number; completed: number }>();

    for (const stitch of allStitches) {
      const existing = colorMap.get(stitch.colorId) || { total: 0, completed: 0 };
      existing.total++;
      if (stitch.completed) {
        existing.completed++;
      }
      colorMap.set(stitch.colorId, existing);
    }

    // Build color progress array with color info
    const colorProgress: ColorProgress[] = [];
    for (const color of pattern.colorPalette) {
      const progress = colorMap.get(color.id);
      if (progress && progress.total > 0) {
        colorProgress.push({
          colorId: color.id,
          colorName: color.name,
          rgb: color.rgb,
          totalStitches: progress.total,
          completedStitches: progress.completed,
          percentage: (progress.completed / progress.total) * 100,
        });
      }
    }

    // Sort by most stitches first
    colorProgress.sort((a, b) => b.totalStitches - a.totalStitches);

    return {
      totalStitches,
      completedStitches,
      overallPercentage,
      colorProgress,
    };
  }, [pattern]);

  // Track stitches completed this session
  const sessionStitches = useMemo(() => {
    if (!progressData) return 0;
    return Math.max(0, progressData.completedStitches - sessionStartStitches);
  }, [progressData?.completedStitches, sessionStartStitches]);

  // Calculate stitches per minute
  const stitchesPerMinute = useMemo(() => {
    if (elapsedSeconds < 10) return 0; // Need at least 10 seconds for meaningful rate
    return (sessionStitches / elapsedSeconds) * 60;
  }, [sessionStitches, elapsedSeconds]);

  // Calculate estimated time remaining
  const estimatedTimeRemaining = useMemo(() => {
    if (!progressData || stitchesPerMinute <= 0) return null;
    const remaining = progressData.totalStitches - progressData.completedStitches;
    const minutesRemaining = remaining / stitchesPerMinute;
    return minutesRemaining * 60; // in seconds
  }, [progressData, stitchesPerMinute]);

  // Format time as HH:MM:SS
  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Format time remaining as human readable
  const formatTimeRemaining = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // Update current session in store periodically
  useEffect(() => {
    if (currentSessionId && isTimerRunning) {
      updateCurrentSession(elapsedSeconds, sessionStitches, stitchesPerMinute);
    }
  }, [currentSessionId, isTimerRunning, elapsedSeconds, sessionStitches, stitchesPerMinute, updateCurrentSession]);

  // Get display name from file path or pattern name
  const getDisplayFileName = useCallback(() => {
    if (currentFilePath) {
      return currentFilePath.split(/[/\\]/).pop()?.replace('.stitchalot', '') || 'Untitled';
    }
    return pattern?.name || 'Untitled';
  }, [currentFilePath, pattern?.name]);

  // Initialize session start stitches when starting timer
  const handleStartTimer = useCallback(() => {
    if (!isTimerRunning && progressData && pattern) {
      if (currentSessionId) {
        // Resume existing session (paused state)
        resumeSession(currentSessionId);
      } else {
        // Check if there's an existing session for this file
        const existingSession = findActiveSessionByFileId(pattern.fileId);
        if (existingSession) {
          // Resume the existing session for this file
          resumeSession(existingSession.id);
        } else {
          // Fresh start - record current completed stitches and create session record
          setSessionStartStitches(progressData.completedStitches);
          startSession(pattern.fileId, getDisplayFileName());
        }
      }
      setIsTimerRunning(true);
    }
  }, [isTimerRunning, progressData, pattern, currentSessionId, findActiveSessionByFileId, startSession, resumeSession, getDisplayFileName]);

  const handlePauseTimer = useCallback(() => {
    setIsTimerRunning(false);
    if (currentSessionId) {
      pauseSession(currentSessionId);
    }
  }, [currentSessionId, pauseSession]);

  // End the current session and save to history
  const handleEndSession = useCallback(() => {
    if (currentSessionId) {
      endSession(currentSessionId, elapsedSeconds, sessionStitches, stitchesPerMinute);
      setIsTimerRunning(false);
      setElapsedSeconds(0);
      if (progressData) {
        setSessionStartStitches(progressData.completedStitches);
      }
    }
  }, [currentSessionId, elapsedSeconds, sessionStitches, stitchesPerMinute, progressData, endSession]);

  // Track completed stitches for reference
  useEffect(() => {
    if (progressData) {
      lastCompletedRef.current = progressData.completedStitches;
    }
  }, [progressData?.completedStitches]);

  // Update displayed ETA based on throttle setting
  useEffect(() => {
    if (estimatedTimeRemaining === null) {
      setDisplayedEta(null);
      return;
    }

    const now = Date.now();

    // If realtime (0) or never updated, update immediately
    if (etaUpdateSeconds === 0 || lastEtaUpdateRef.current === 0) {
      setDisplayedEta(estimatedTimeRemaining);
      lastEtaUpdateRef.current = now;
      return;
    }

    // Check if enough time has passed since last update
    const timeSinceLastUpdate = (now - lastEtaUpdateRef.current) / 1000;
    if (timeSinceLastUpdate >= etaUpdateSeconds) {
      setDisplayedEta(estimatedTimeRemaining);
      lastEtaUpdateRef.current = now;
    }
  }, [estimatedTimeRemaining, etaUpdateSeconds]);

  if (!pattern || !progressData) {
    return (
      <div className="w-64 bg-white border-l border-gray-300 p-4">
        <p className="text-gray-500">No pattern loaded</p>
      </div>
    );
  }

  return (
    <div className="w-64 bg-white border-l border-gray-300 flex flex-col h-full overflow-hidden">
      {/* Header - fixed at top */}
      <div className="p-3 border-b border-gray-200 bg-green-50 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-green-800">Progress Tracking</h2>
          <button
            onClick={toggleProgressMode}
            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Exit
          </button>
        </div>
        <p className="text-xs text-green-600 mt-1">Click on stitches to mark complete</p>
      </div>

      {/* Main scrollable area - everything else scrolls */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
      {/* Canvas Navigation */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePan}
            className={`flex-1 h-8 flex items-center justify-center gap-2 rounded text-sm ${
              isPanning
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isPanning ? 'Exit Pan Mode' : 'Pan Canvas'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 9l-3 3 3 3" />
              <path d="M9 5l3-3 3 3" />
              <path d="M15 19l-3 3-3-3" />
              <path d="M19 9l3 3-3 3" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            {isPanning ? 'Exit Pan Mode' : 'Move Canvas'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1 text-center">Hold Space to pan temporarily</p>
      </div>

      {/* Overall Progress - Collapsible */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowOverallProgress(!showOverallProgress)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h3 className="text-sm font-medium text-gray-700">Overall Progress</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-600">{progressData.overallPercentage.toFixed(1)}%</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-500 transition-transform ${showOverallProgress ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {showOverallProgress && (
          <div className="px-3 pb-3">
            <div className="mb-2">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progressData.overallPercentage}%` }}
                />
              </div>
            </div>
            <div className="text-sm text-gray-600 mb-2">
              <span className="font-medium text-gray-800">{progressData.completedStitches.toLocaleString()}</span>
              {' / '}
              <span>{progressData.totalStitches.toLocaleString()}</span>
              {' stitches'}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-gray-100 rounded p-2">
                <div className="text-gray-500">Remaining</div>
                <div className="font-medium text-gray-800">
                  {(progressData.totalStitches - progressData.completedStitches).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-2">
                <div className="text-gray-500">Colors</div>
                <div className="font-medium text-gray-800">
                  {progressData.colorProgress.length}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Session Stats - Collapsible */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowSessionStats(!showSessionStats)}
          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <h3 className="text-sm font-medium text-gray-700">Session Stats</h3>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-gray-500 transition-transform ${showSessionStats ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showSessionStats && (
          <div className="px-3 pb-3 space-y-3">
            {/* Timer Display */}
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-gray-800">
                {formatTime(elapsedSeconds)}
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex gap-2">
              {!isTimerRunning ? (
                <button
                  onClick={handleStartTimer}
                  className="flex-1 h-8 flex items-center justify-center gap-1 rounded text-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {elapsedSeconds > 0 ? 'Resume' : 'Start'}
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="flex-1 h-8 flex items-center justify-center gap-1 rounded text-sm bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-gray-100 rounded p-2">
                <div className="text-gray-500">This Session</div>
                <div className="font-medium text-gray-800 text-sm">
                  {sessionStitches.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-100 rounded p-2">
                <div className="text-gray-500">Stitches/Min</div>
                <div className="font-medium text-gray-800 text-sm">
                  {stitchesPerMinute.toFixed(1)}
                </div>
              </div>
            </div>

            {/* ETA */}
            {displayedEta !== null && displayedEta > 0 && (
              <div className="bg-blue-50 rounded p-2 text-center">
                <div className="text-xs text-blue-600">Estimated Time Remaining</div>
                <div className="font-medium text-blue-800">
                  {formatTimeRemaining(displayedEta)}
                </div>
              </div>
            )}

            {/* Session Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex-1 h-8 flex items-center justify-center gap-1 rounded text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                History
              </button>
              <button
                onClick={handleEndSession}
                disabled={!currentSessionId}
                className="flex-1 h-8 flex items-center justify-center gap-1 rounded text-sm bg-red-100 hover:bg-red-200 text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                End Session
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Progress by Color - Collapsible */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setShowColorProgress(!showColorProgress)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h3 className="text-sm font-medium text-gray-700">By Color</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{progressData.colorProgress.length} colors</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-500 transition-transform ${showColorProgress ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {showColorProgress && (
            <div className="p-3">
              {progressData.colorProgress.length === 0 ? (
                <p className="text-sm text-gray-500">No stitches in pattern</p>
              ) : (
                <div className="space-y-3">
                  {progressData.colorProgress.map(cp => (
                    <div key={cp.colorId} className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-4 h-4 rounded border border-gray-300 shrink-0"
                          style={{ backgroundColor: `rgb(${cp.rgb[0]}, ${cp.rgb[1]}, ${cp.rgb[2]})` }}
                        />
                        <span className="text-gray-700 truncate flex-1" title={cp.colorName}>
                          {cp.colorName}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {cp.percentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${cp.percentage}%`,
                            backgroundColor: `rgb(${cp.rgb[0]}, ${cp.rgb[1]}, ${cp.rgb[2]})`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {cp.completedStitches.toLocaleString()} / {cp.totalStitches.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings - Collapsible */}
        <div className="border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <h3 className="text-sm font-medium text-gray-700">Settings</h3>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-500 transition-transform ${showSettings ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showSettings && (
            <div className="px-3 pb-3 space-y-3">
              {/* Completed Shading Color */}
              <div>
                <span className="text-xs text-gray-500 block mb-1">Completed Shading</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-12">Color</span>
                  <div className="relative flex-1">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="w-full h-7 rounded border border-gray-300 flex items-center px-2 gap-2"
                    >
                      <div
                        className="w-5 h-5 rounded border border-gray-400"
                        style={{
                          backgroundColor: `rgb(${progressShadingColor[0]}, ${progressShadingColor[1]}, ${progressShadingColor[2]})`,
                        }}
                      />
                      <span className="text-xs text-gray-600">
                        {rgbToHex(progressShadingColor[0], progressShadingColor[1], progressShadingColor[2]).toUpperCase()}
                      </span>
                    </button>
                    {showColorPicker && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-300 p-2 z-20">
                        <input
                          type="color"
                          value={rgbToHex(progressShadingColor[0], progressShadingColor[1], progressShadingColor[2])}
                          onChange={(e) => {
                            setProgressShadingColor(hexToRgb(e.target.value));
                            setShowColorPicker(false);
                          }}
                          className="w-full h-8 cursor-pointer"
                        />
                        <div className="flex gap-1 mt-2 justify-center">
                          {presetColors.map((color, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setProgressShadingColor(color);
                                setShowColorPicker(false);
                              }}
                              className="w-7 h-7 rounded border border-gray-300 hover:scale-110 transition-transform"
                              style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                              title={`RGB(${color[0]}, ${color[1]}, ${color[2]})`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-12">Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressShadingOpacity}
                  onChange={(e) => setProgressShadingOpacity(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-600 w-8 text-right">{progressShadingOpacity}%</span>
              </div>

              {/* ETA Update Interval */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-600 flex-1">ETA Update</span>
                <select
                  value={etaUpdateSeconds}
                  onChange={(e) => setEtaUpdateSeconds(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="0">Realtime</option>
                  <option value="5">5 sec</option>
                  <option value="10">10 sec</option>
                  <option value="30">30 sec</option>
                  <option value="60">1 min</option>
                  <option value="300">5 min</option>
                  <option value="600">10 min</option>
                  <option value="900">15 min</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>{/* End of main scrollable area */}

      {/* Session History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[450px] max-h-[70vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Session History</h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {sessions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 text-gray-300">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <p>No session history yet</p>
                  <p className="text-sm mt-1">Start a session to begin tracking</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => {
                    const isCurrentSession = session.id === currentSessionId;
                    const statusText = isCurrentSession
                      ? (isTimerRunning ? 'Active' : 'Paused')
                      : session.status === 'completed' ? 'Complete' : 'Paused';
                    const statusColor = isCurrentSession
                      ? (isTimerRunning ? 'text-green-600' : 'text-yellow-600')
                      : session.status === 'completed' ? 'text-gray-500' : 'text-yellow-600';

                    return (
                      <div
                        key={session.id}
                        className={`p-3 rounded-lg border ${
                          isCurrentSession
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        {/* Session Header - New Format */}
                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                          <div className="flex justify-between items-start">
                            <span>File: {session.fileName}</span>
                            <div className="flex items-center gap-2">
                              <span className={statusColor}>Status: {statusText}</span>
                              {!isCurrentSession && sessionToDelete !== session.id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSessionToDelete(session.id);
                                  }}
                                  className="text-gray-400 hover:text-red-500 transition-colors p-0.5 -mr-1"
                                  title="Delete session"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              )}
                              {sessionToDelete === session.id && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSession(session.id);
                                      setSessionToDelete(null);
                                    }}
                                    className="text-xs px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSessionToDelete(null);
                                    }}
                                    className="text-xs px-1.5 py-0.5 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <span>Start: {formatSessionDate(session.startTime)}</span>
                            <span>
                              End: {session.endTime ? formatSessionDate(session.endTime) : '--'}
                            </span>
                          </div>
                        </div>

                        {/* Session Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-white rounded p-2 border border-gray-100">
                            <div className="text-gray-500">Duration</div>
                            <div className="font-medium text-gray-800">
                              {isCurrentSession
                                ? formatTime(elapsedSeconds)
                                : formatTime(session.duration)
                              }
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border border-gray-100">
                            <div className="text-gray-500">Stitches</div>
                            <div className="font-medium text-gray-800">
                              {isCurrentSession
                                ? sessionStitches.toLocaleString()
                                : session.stitchesCompleted.toLocaleString()
                              }
                            </div>
                          </div>
                          <div className="bg-white rounded p-2 border border-gray-100">
                            <div className="text-gray-500">Rate</div>
                            <div className="font-medium text-gray-800">
                              {isCurrentSession
                                ? `${stitchesPerMinute.toFixed(1)}/m`
                                : `${session.stitchesPerMinute.toFixed(1)}/m`
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
