interface UploadImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConvert: () => void;
  onSelectOverlay: () => void;
}

export function UploadImageDialog({
  isOpen,
  onClose,
  onSelectConvert,
  onSelectOverlay,
}: UploadImageDialogProps) {
  const handleSelectConvert = () => {
    onSelectConvert();
    onClose();
  };

  const handleSelectOverlay = () => {
    onSelectOverlay();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[500px] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Upload Image</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose how you want to use the image
          </p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600 mb-2">Click an option to continue:</p>

          {/* Option 1: Convert Image */}
          <button
            onClick={handleSelectConvert}
            className="w-full p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-blue-400 hover:bg-blue-50 group"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-blue-700">Convert to Pattern</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Transform an image into a needlepoint pattern with automatic color reduction and thread matching.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Converts pixels to stitches
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Matches colors to thread libraries (DMC, Anchor, etc.)
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Adjustable size, dithering, and color count
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Can add as new layer or replace pattern
                  </li>
                </ul>
              </div>
              <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </button>

          {/* Option 2: Overlay Image */}
          <button
            onClick={handleSelectOverlay}
            className="w-full p-4 rounded-lg border-2 text-left transition-all border-gray-200 hover:border-purple-400 hover:bg-purple-50 group"
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                  <rect x="8" y="8" width="13" height="13" rx="2" />
                  <rect x="3" y="3" width="13" height="13" rx="2" fill="none" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800 mb-1 group-hover:text-purple-700">Reference Overlay</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Add an image as a semi-transparent overlay to trace or use as a reference while designing.
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Image appears on top of the canvas
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Adjustable opacity for easy tracing
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Move, resize, and position freely
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-green-500">&#10003;</span>
                    Multiple overlays supported
                  </li>
                </ul>
              </div>
              <div className="text-gray-300 group-hover:text-purple-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </div>
          </button>
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
