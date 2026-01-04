import { ReactNode } from 'react';
import { usePatternStore, Tool } from '../stores/patternStore';
import handMoveIcon from '../assets/hand-move.svg';

export interface ToolVisibility {
  pencil: boolean;
  eraser: boolean;
  fill: boolean;
  pan: boolean;
  select: boolean;
  text: boolean;
  line: boolean;
  rectangle: boolean;
  ellipse: boolean;
  undo: boolean;
  redo: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  zoomFit: boolean;
  grid: boolean;
}

interface ToolButtonProps {
  tool: Tool;
  icon: ReactNode;
  label: string;
  activeTool: Tool;
  onClick: (tool: Tool) => void;
}

function ToolButton({ tool, icon, label, activeTool, onClick }: ToolButtonProps) {
  const isActive = activeTool === tool;
  return (
    <button
      onClick={() => onClick(tool)}
      className={`
        w-10 h-10 flex items-center justify-center rounded
        transition-colors text-lg
        ${isActive
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
      title={label}
    >
      {icon}
    </button>
  );
}

// Cursor/pointer icon SVG for Move tool
export function CursorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
    >
      <path d="M4 4l7 18 2.5-7.5L21 12 4 4z" />
    </svg>
  );
}

// Paint bucket/fill icon SVG (custom with red paint)
export function FillIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      className={className || "w-5 h-5"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Handle */}
      <path d="M9.996,6C8.097,4.101 6.468,2.472 4.996,1" fill="none" stroke="black" strokeWidth="1.5" />
      {/* Fill line */}
      <path d="M17.988,11L1.037,11" fill="none" stroke="black" strokeWidth="1.5" />
      {/* Paint fill inside bucket */}
      <path d="M1.193,13.443C2.023,14.418 8.537,19.127 8.537,19.127L17.001,12.696L18.868,9.875L1.359,9.875C1.359,9.875 0.363,12.468 1.193,13.443Z" fill="#C75B5B" />
      {/* Paint drop */}
      <path d="M20.141,17.38C19.558,16.901 19.154,16.238 18.996,15.5C18.841,16.239 18.436,16.903 17.851,17.38C17.276,17.84 16.996,18.4 16.996,18.975C16.996,18.983 16.996,18.992 16.996,19C16.996,20.097 17.899,21 18.996,21C20.093,21 20.996,20.097 20.996,19C20.996,18.992 20.996,18.983 20.996,18.975C20.996,18.395 20.711,17.845 20.141,17.38" fill="#B84C4C" stroke="#B84C4C" strokeWidth="1.5" />
      {/* Bucket outline */}
      <path d="M7.496,3.5L9.644,1.352C10.111,0.885 10.881,0.885 11.348,1.352L18.644,8.648C19.111,9.115 19.111,9.885 18.644,10.352L11.052,17.944C9.65,19.346 7.342,19.346 5.94,17.944L2.052,14.056C0.65,12.654 0.65,10.346 2.052,8.944L4.666,6.33" fill="none" stroke="black" strokeWidth="1.5" />
    </svg>
  );
}

// Text icon SVG (Lucide type-outline)
export function TextIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" />
    </svg>
  );
}

// Pan/Move icon (hand with arrows)
export function PanIcon({ className }: { className?: string }) {
  return (
    <img
      src={handMoveIcon}
      alt="Pan"
      className={className || "w-7 h-7"}
    />
  );
}

// Eraser icon SVG (colored)
export function EraserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
    >
      {/* Main eraser body (pink/salmon) */}
      <path
        d="M20 20H9L3.5 14.5c-.7-.7-.7-1.8 0-2.5L13 2.5c.7-.7 1.8-.7 2.5 0l6 6c.7.7.7 1.8 0 2.5L12 20"
        fill="#F8A5A5"
        stroke="#333"
        strokeWidth="1.5"
      />
      {/* Eraser tip (darker) */}
      <path
        d="M9 20L3.5 14.5c-.7-.7-.7-1.8 0-2.5L7 8.5l7 7L9 20z"
        fill="#4A90A4"
        stroke="#333"
        strokeWidth="1.5"
      />
      {/* Dividing line */}
      <path
        d="M7 8.5L14 15.5"
        stroke="#333"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const DEFAULT_VISIBILITY: ToolVisibility = {
  pencil: true,
  eraser: true,
  fill: true,
  pan: true,
  select: true,
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
};

interface ToolbarProps {
  onTextToolClick?: () => void;
  onFitToCanvas?: () => void;
  toolVisibility?: ToolVisibility;
}

export function Toolbar({ onTextToolClick, onFitToCanvas, toolVisibility = DEFAULT_VISIBILITY }: ToolbarProps) {
  const { pattern, activeTool, zoom, showGrid, history, future, setTool, setZoom, toggleGrid, undo, redo } = usePatternStore();

  if (!pattern) {
    return (
      <div className="w-14 min-w-14 shrink-0 bg-white border-r border-gray-300 p-2">
        <div className="space-y-2">
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // Check if any tools in a section are visible
  const hasDrawingTools = toolVisibility.pencil || toolVisibility.eraser || toolVisibility.fill || toolVisibility.pan || toolVisibility.select || toolVisibility.text;
  const hasShapeTools = toolVisibility.line || toolVisibility.rectangle || toolVisibility.ellipse;
  const hasHistoryTools = toolVisibility.undo || toolVisibility.redo;
  const hasZoomControls = toolVisibility.zoomIn || toolVisibility.zoomOut || toolVisibility.zoomFit;

  return (
    <div className="shrink-0 bg-white border-r border-gray-300 flex flex-col flex-wrap h-full content-start" style={{ maxHeight: '100%' }}>
      {/* Drawing tools */}
      {hasDrawingTools && (
        <div className="p-2 space-y-2 border-b border-gray-200 w-14">
          {toolVisibility.select && (
            <ToolButton
              tool="select"
              icon={<CursorIcon />}
              label="Move (V)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.pencil && (
            <ToolButton
              tool="pencil"
              icon="✏️"
              label="Pencil (P)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.eraser && (
            <ToolButton
              tool="eraser"
              icon={<EraserIcon />}
              label="Eraser (E)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.fill && (
            <ToolButton
              tool="fill"
              icon={<FillIcon />}
              label="Fill (G)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.pan && (
            <ToolButton
              tool="pan"
              icon={<PanIcon />}
              label="Pan (Space)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.text && (
            <ToolButton
              tool="text"
              icon={<TextIcon />}
              label="Text (T)"
              activeTool={activeTool}
              onClick={() => {
                if (onTextToolClick) {
                  onTextToolClick();
                }
              }}
            />
          )}
        </div>
      )}

      {/* Shape tools */}
      {hasShapeTools && (
        <div className="p-2 space-y-2 border-b border-gray-200 w-14">
          {toolVisibility.line && (
            <ToolButton
              tool="line"
              icon="╱"
              label="Line (L)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.rectangle && (
            <ToolButton
              tool="rectangle"
              icon="▢"
              label="Rectangle (R)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
          {toolVisibility.ellipse && (
            <ToolButton
              tool="ellipse"
              icon="◯"
              label="Ellipse (O)"
              activeTool={activeTool}
              onClick={setTool}
            />
          )}
        </div>
      )}

      {/* Undo/Redo */}
      {hasHistoryTools && (
        <div className="p-2 space-y-2 border-b border-gray-200 w-14">
          {toolVisibility.undo && (
            <button
              onClick={undo}
              disabled={history.length === 0}
              className={`w-10 h-10 flex items-center justify-center rounded text-lg ${
                history.length === 0
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Undo (Ctrl+Z)"
            >
              ↩️
            </button>
          )}
          {toolVisibility.redo && (
            <button
              onClick={redo}
              disabled={future.length === 0}
              className={`w-10 h-10 flex items-center justify-center rounded text-lg ${
                future.length === 0
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↪️
            </button>
          )}
        </div>
      )}

      {/* Zoom controls */}
      {hasZoomControls && (
        <div className="p-2 space-y-2 border-b border-gray-200 w-14">
          {toolVisibility.zoomIn && (
            <button
              onClick={() => setZoom(Math.min(10, zoom + 0.1))}
              className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-lg"
              title="Zoom In (+)"
            >
              🔍+
            </button>
          )}
          {toolVisibility.zoomOut && (
            <button
              onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-lg"
              title="Zoom Out (-)"
            >
              🔍−
            </button>
          )}
          {toolVisibility.zoomFit && (
            <button
              onClick={onFitToCanvas}
              className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium"
              title="Fit to Window (0)"
            >
              Fit
            </button>
          )}
        </div>
      )}

      {/* Grid toggle */}
      {toolVisibility.grid && (
        <div className="p-2 space-y-2 w-14">
          <button
            onClick={toggleGrid}
            className={`
              w-10 h-10 flex items-center justify-center rounded
              transition-colors text-lg
              ${showGrid
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
            title="Toggle Grid (G)"
          >
            #
          </button>
        </div>
      )}

    </div>
  );
}
