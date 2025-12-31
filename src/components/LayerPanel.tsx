import { useState } from 'react';
import { usePatternStore } from '../stores/patternStore';

export function LayerPanel() {
  const {
    pattern,
    activeLayerId,
    selection,
    overlayImages,
    selectedOverlayId,
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
    selectOverlay,
    deselectOverlay,
    toggleOverlayVisibility,
    toggleOverlayLock,
    updateOverlayOpacity,
    removeOverlayImage,
    reorderOverlay,
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
    // Deselect overlay when clicking on a layer
    if (selectedOverlayId) {
      deselectOverlay();
    }
  };

  const handleOverlayClick = (overlayId: string) => {
    selectOverlay(overlayId);
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

      {/* Overlay Images Section */}
      {overlayImages.length > 0 && (
        <div className="border-b border-gray-300 bg-amber-50">
          <div className="px-2 py-1 text-[10px] font-medium text-amber-700 border-b border-amber-200">
            Overlays ({overlayImages.length})
          </div>
          {/* Render overlays in reverse order (top overlay first) */}
          {[...overlayImages].reverse().map((overlay, reversedIndex) => {
            const isSelected = selectedOverlayId === overlay.id;
            const realIndex = overlayImages.length - 1 - reversedIndex;
            const canMoveUp = realIndex < overlayImages.length - 1;
            const canMoveDown = realIndex > 0;

            return (
              <div key={overlay.id} className="border-b border-amber-100 last:border-b-0">
                <div
                  onClick={() => handleOverlayClick(overlay.id)}
                  className={`flex items-center gap-1 p-1.5 cursor-pointer hover:bg-amber-100 ${
                    isSelected ? 'bg-amber-100 ring-1 ring-amber-400' : ''
                  }`}
                >
                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOverlayVisibility(overlay.id);
                    }}
                    className={`w-5 h-5 flex items-center justify-center text-xs ${
                      overlay.visible ? 'text-gray-700' : 'text-gray-300'
                    }`}
                    title={overlay.visible ? 'Hide Overlay' : 'Show Overlay'}
                  >
                    {overlay.visible ? '👁' : '👁‍🗨'}
                  </button>

                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOverlayLock(overlay.id);
                    }}
                    className={`w-5 h-5 flex items-center justify-center text-xs ${
                      overlay.locked ? 'text-red-500' : 'text-gray-300'
                    }`}
                    title={overlay.locked ? 'Unlock Overlay' : 'Lock Overlay'}
                  >
                    {overlay.locked ? '🔒' : '🔓'}
                  </button>

                  {/* Overlay Icon */}
                  <span className="w-5 h-5 flex items-center justify-center text-xs">🖼</span>

                  {/* Name */}
                  <span className="flex-1 text-xs font-medium text-amber-800 truncate" title={overlay.name}>
                    {overlay.name}
                  </span>

                  {/* Reorder buttons */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderOverlay(overlay.id, 'up');
                      }}
                      disabled={!canMoveUp}
                      className={`w-4 h-4 flex items-center justify-center text-[10px] ${
                        canMoveUp ? 'text-gray-500 hover:text-gray-700' : 'text-gray-200'
                      }`}
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderOverlay(overlay.id, 'down');
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

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOverlayImage(overlay.id);
                    }}
                    className="w-5 h-5 flex items-center justify-center text-xs text-red-500 hover:text-red-700"
                    title="Remove Overlay"
                  >
                    ✕
                  </button>
                </div>

                {/* Opacity Slider (always visible) */}
                <div className="px-2 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12">Opacity</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={overlay.opacity}
                      onChange={(e) => updateOverlayOpacity(overlay.id, parseInt(e.target.value, 10))}
                      className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] text-gray-600 w-8 text-right">{overlay.opacity}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
