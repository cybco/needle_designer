import { useState, useRef } from 'react';
import { usePatternStore } from '../stores/patternStore';

interface OverlayImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OverlayImageDialog({ isOpen, onClose }: OverlayImageDialogProps) {
  const { addOverlayImage } = usePatternStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file is too large (max 10MB)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;

        // Load image to get natural dimensions
        const img = new Image();
        img.onload = () => {
          // Use filename (without extension) as the overlay name
          const name = file.name.replace(/\.[^/.]+$/, '');
          addOverlayImage(dataUrl, img.naturalWidth, img.naturalHeight, name);
          setIsLoading(false);
          onClose();
        };
        img.onerror = () => {
          setError('Failed to load image');
          setIsLoading(false);
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setError('Failed to read image file');
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to load image');
      setIsLoading(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[400px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Add Overlay Image</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add a reference image to trace over
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Choose Image'}
            </button>
            {error && (
              <p className="text-sm text-red-500 mt-1">{error}</p>
            )}
          </div>

          {/* Help text */}
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Overlays appear on top of your stitches</li>
              <li>Adjust opacity in the Layers panel</li>
              <li>You can add multiple overlay images</li>
              <li>Use Select tool to move and resize</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
