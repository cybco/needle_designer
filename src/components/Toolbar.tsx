import { usePatternStore, Tool } from '../stores/patternStore';

interface ToolButtonProps {
  tool: Tool;
  icon: string;
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

interface ToolbarProps {
  onTextToolClick?: () => void;
}

export function Toolbar({ onTextToolClick }: ToolbarProps) {
  const { pattern, activeTool, zoom, showGrid, history, future, setTool, setZoom, toggleGrid, undo, redo } = usePatternStore();

  if (!pattern) {
    return (
      <div className="w-14 bg-white border-r border-gray-300 p-2">
        <div className="space-y-2">
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-14 bg-white border-r border-gray-300 flex flex-col">
      {/* Drawing tools */}
      <div className="p-2 space-y-2 border-b border-gray-200">
        <ToolButton
          tool="pencil"
          icon="✏️"
          label="Pencil (P)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="eraser"
          icon="🧹"
          label="Eraser (E)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="fill"
          icon="🪣"
          label="Fill (G)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="pan"
          icon="✋"
          label="Pan (Space)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="select"
          icon="⬚"
          label="Select (S)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="text"
          icon="T"
          label="Text (T)"
          activeTool={activeTool}
          onClick={() => {
            if (onTextToolClick) {
              onTextToolClick();
            }
          }}
        />
      </div>

      {/* Shape tools */}
      <div className="p-2 space-y-2 border-b border-gray-200">
        <ToolButton
          tool="line"
          icon="╱"
          label="Line (L)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="rectangle"
          icon="▢"
          label="Rectangle (R)"
          activeTool={activeTool}
          onClick={setTool}
        />
        <ToolButton
          tool="ellipse"
          icon="◯"
          label="Ellipse (O)"
          activeTool={activeTool}
          onClick={setTool}
        />
      </div>

      {/* Undo/Redo */}
      <div className="p-2 space-y-2 border-b border-gray-200">
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
      </div>

      {/* View controls */}
      <div className="p-2 space-y-2 border-b border-gray-200">
        <button
          onClick={() => setZoom(zoom + 0.1)}
          className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-lg"
          title="Zoom In (+)"
        >
          🔍+
        </button>
        <button
          onClick={() => setZoom(zoom - 0.1)}
          className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-lg"
          title="Zoom Out (-)"
        >
          🔍-
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-10 h-10 flex items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
          title="Reset Zoom (0)"
        >
          100%
        </button>
      </div>

      {/* Grid toggle */}
      <div className="p-2 space-y-2">
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

      {/* Zoom indicator */}
      <div className="mt-auto p-2 text-center">
        <div className="text-xs text-gray-500">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}
