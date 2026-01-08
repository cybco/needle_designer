interface SelectionContextMenuProps {
  position: { x: number; y: number };
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  onNewLayer: () => void;
}

export function SelectionContextMenu({
  position,
  onDuplicate,
  onMove,
  onDelete,
  onNewLayer,
}: SelectionContextMenuProps) {
  return (
    <div
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[100px]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={onMove}
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <span className="w-4 text-center">✥</span>
        Move
      </button>
      <button
        onClick={onDuplicate}
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <span className="w-4 text-center">📋</span>
        Duplicate
      </button>
      <button
        onClick={onNewLayer}
        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
      >
        <span className="w-4 text-center">📄</span>
        New Layer
      </button>
      <div className="border-t border-gray-200 my-1" />
      <button
        onClick={onDelete}
        className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
      >
        <span className="w-4 text-center">🗑️</span>
        Delete
      </button>
    </div>
  );
}
