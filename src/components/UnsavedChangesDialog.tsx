interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
  fileName: string;
  actionText?: string; // e.g., "closing", "creating a new file", "opening another file"
}

export function UnsavedChangesDialog({
  isOpen,
  onSave,
  onDontSave,
  onCancel,
  fileName,
  actionText = 'closing',
}: UnsavedChangesDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Unsaved Changes</h2>

        <p className="text-gray-600 mb-6">
          Do you want to save changes to "{fileName}" before {actionText}?
        </p>

        <p className="text-sm text-gray-500 mb-6">
          Your changes will be lost if you don't save them.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDontSave}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Continue
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
