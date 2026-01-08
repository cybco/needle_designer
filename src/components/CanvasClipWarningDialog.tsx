interface CanvasClipWarningDialogProps {
  clipInfo: {
    stitchesClipped: number;
    layersAffected: string[];
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function CanvasClipWarningDialog({ clipInfo, onConfirm, onCancel }: CanvasClipWarningDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Content Will Be Removed</h2>

        <p className="text-gray-600 mb-4">
          This resize will remove <span className="font-semibold">{clipInfo.stitchesClipped.toLocaleString()}</span> stitch{clipInfo.stitchesClipped !== 1 ? 'es' : ''} from the canvas.
        </p>

        {clipInfo.layersAffected.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">Affected layers:</p>
            <ul className="text-sm text-gray-700 list-disc list-inside pl-2">
              {clipInfo.layersAffected.map((name, idx) => (
                <li key={idx}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6">
          You can undo this action after applying.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white bg-amber-600 rounded hover:bg-amber-700 transition-colors"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
