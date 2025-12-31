import { useState } from 'react';

interface DeleteLayerDialogProps {
  layerName: string;
  onConfirm: (suppressFutureWarnings: boolean) => void;
  onCancel: () => void;
}

export function DeleteLayerDialog({ layerName, onConfirm, onCancel }: DeleteLayerDialogProps) {
  const [suppressWarnings, setSuppressWarnings] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Delete Layer</h2>

        <p className="text-gray-600 mb-4">
          Are you sure you want to delete "{layerName}"? This action cannot be undone.
        </p>

        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={suppressWarnings}
            onChange={(e) => setSuppressWarnings(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Don't ask me again</span>
        </label>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(suppressWarnings)}
            className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
