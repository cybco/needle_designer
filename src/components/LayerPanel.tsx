import { useState } from 'react';
import { usePatternStore } from '../stores/patternStore';

export function LayerPanel() {
  const {
    pattern,
    activeLayerId,
    selection,
    setActiveLayer,
    addLayer,
    removeLayer,
    renameLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    reorderLayer,
    mergeLayers,
    duplicateLayer,
    selectLayerForTransform,
  } = usePatternStore();

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!pattern) return null;

  const handleStartRename = (layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setEditingName(currentName);
  };

  const handleFinishRename = () => {
    if (editingLayerId && editingName.trim()) {
      renameLayer(editingLayerId, editingName.trim());
    }
    setEditingLayerId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingLayerId(null);
      setEditingName('');
    }
  };

  const handleLayerClick = (layerId: string) => {
    setActiveLayer(layerId);
    // Also select for transform (shows selection box if layer has stitches)
    selectLayerForTransform(layerId);
  };

  const handleMergeDown = (layerId: string) => {
    const layerIndex = pattern.layers.findIndex(l => l.id === layerId);
    if (layerIndex > 0) {
      const targetLayerId = pattern.layers[layerIndex - 1].id;
      mergeLayers(layerId, targetLayerId);
    }
  };

  // Render layers in reverse order (top layer first in the list)
  const reversedLayers = [...pattern.layers].reverse();

  return (
    <div className="w-56 bg-white border-b border-gray-300 flex flex-col max-h-64">
      {/* Header */}
      <div className="p-2 border-b border-gray-200 flex items-center justify-between">
        <span className="font-medium text-sm text-gray-700">Layers</span>
        <button
          onClick={() => addLayer()}
          className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          title="Add Layer"
        >
          +
        </button>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto">
        {reversedLayers.map((layer, reversedIndex) => {
          const isActive = layer.id === activeLayerId;
          const isSelected = selection?.layerId === layer.id;
          const realIndex = pattern.layers.length - 1 - reversedIndex;
          const canMoveUp = realIndex < pattern.layers.length - 1;
          const canMoveDown = realIndex > 0;

          return (
            <div
              key={layer.id}
              onClick={() => handleLayerClick(layer.id)}
              className={`flex items-center gap-1 p-1.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              } ${isSelected ? 'ring-1 ring-blue-400' : ''}`}
            >
              {/* Visibility Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
                className={`w-5 h-5 flex items-center justify-center text-xs ${
                  layer.visible ? 'text-gray-700' : 'text-gray-300'
                }`}
                title={layer.visible ? 'Hide Layer' : 'Show Layer'}
              >
                {layer.visible ? '👁' : '👁‍🗨'}
              </button>

              {/* Lock Toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLayerLock(layer.id);
                }}
                className={`w-5 h-5 flex items-center justify-center text-xs ${
                  layer.locked ? 'text-red-500' : 'text-gray-300'
                }`}
                title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
              >
                {layer.locked ? '🔒' : '🔓'}
              </button>

              {/* Layer Name */}
              <div className="flex-1 min-w-0">
                {editingLayerId === layer.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => handleStartRename(layer.id, layer.name)}
                    className={`block truncate text-xs ${
                      isActive ? 'font-medium text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    {layer.name}
                  </span>
                )}
              </div>

              {/* Layer Actions */}
              <div className="flex items-center gap-0.5">
                {/* Move Up */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayer(layer.id, 'up');
                  }}
                  disabled={!canMoveUp}
                  className={`w-4 h-4 flex items-center justify-center text-[10px] ${
                    canMoveUp ? 'text-gray-500 hover:text-gray-700' : 'text-gray-200'
                  }`}
                  title="Move Up"
                >
                  ▲
                </button>

                {/* Move Down */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    reorderLayer(layer.id, 'down');
                  }}
                  disabled={!canMoveDown}
                  className={`w-4 h-4 flex items-center justify-center text-[10px] ${
                    canMoveDown ? 'text-gray-500 hover:text-gray-700' : 'text-gray-200'
                  }`}
                  title="Move Down"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="p-1.5 border-t border-gray-200 flex gap-1 flex-wrap">
        <button
          onClick={() => activeLayerId && duplicateLayer(activeLayerId)}
          disabled={!activeLayerId}
          className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          title="Duplicate Layer"
        >
          Duplicate
        </button>
        <button
          onClick={() => {
            if (activeLayerId) {
              const layerIndex = pattern.layers.findIndex(l => l.id === activeLayerId);
              if (layerIndex > 0) {
                handleMergeDown(activeLayerId);
              }
            }
          }}
          disabled={!activeLayerId || pattern.layers.findIndex(l => l.id === activeLayerId) === 0}
          className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          title="Merge with layer below"
        >
          Merge
        </button>
        <button
          onClick={() => activeLayerId && removeLayer(activeLayerId)}
          disabled={!activeLayerId || pattern.layers.length <= 1}
          className="px-2 py-1 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-50"
          title="Delete Layer"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
