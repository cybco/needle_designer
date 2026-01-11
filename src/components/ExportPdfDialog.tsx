import { useState } from 'react';
import { Pattern } from '../stores/patternStore';
import { exportPatternToPdf } from '../utils/pdfExport';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useLicenseStore } from '../stores/licenseStore';

interface ExportPdfDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pattern: Pattern;
  currentFilePath: string | null;
}

export function ExportPdfDialog({ isOpen, onClose, pattern, currentFilePath }: ExportPdfDialogProps) {
  // Get actual filename from path, fallback to pattern.name
  const getDisplayName = () => {
    if (currentFilePath) {
      const fileName = currentFilePath.split(/[/\\]/).pop() || '';
      return decodeURIComponent(fileName.replace(/\.stitchalot$/i, ''));
    }
    return pattern.name;
  };
  const displayName = getDisplayName();
  const [includePreviewPage, setIncludePreviewPage] = useState(true);
  const [includeColorLegend, setIncludeColorLegend] = useState(true);
  const [includeStitchCounts, setIncludeStitchCounts] = useState(true);
  const [includeGridNumbers, setIncludeGridNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Get watermark status from license store
  const shouldWatermark = useLicenseStore((state) => state.shouldWatermark());

  if (!isOpen) return null;

  const handleExport = async () => {
    // Show save dialog first
    const defaultName = `${displayName.replace(/[^a-zA-Z0-9]/g, '_')}_pattern.pdf`;
    const filePath = await save({
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      defaultPath: defaultName,
    });

    if (!filePath) {
      return; // User cancelled
    }

    setIsExporting(true);
    try {
      // Generate PDF (with watermark if in trial mode)
      const pdfData = await exportPatternToPdf(pattern, {
        includePreviewPage,
        includeColorLegend,
        includeStitchCounts,
        includeGridNumbers,
        useSymbols,
        shouldWatermark,
        title: displayName,
      });

      // Convert ArrayBuffer to base64 for sending to Rust
      // Using chunked approach to avoid stack overflow with large files
      const bytes = new Uint8Array(pdfData);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      // Save via Tauri
      await invoke('save_pdf', { path: filePath, data: base64 });

      onClose();
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Count colors actually used on the canvas
  const usedColorIds = new Set<string>();
  for (const layer of pattern.layers) {
    if (layer.visible) {
      for (const stitch of layer.stitches) {
        usedColorIds.add(stitch.colorId);
      }
    }
  }
  const usedColorsCount = usedColorIds.size;

  // Calculate page count estimate
  const cellsPerPageX = Math.floor(170 / 3); // ~56 cells
  const cellsPerPageY = Math.floor(222 / 3); // ~74 cells
  const pagesX = Math.ceil(pattern.canvas.width / cellsPerPageX);
  const pagesY = Math.ceil(pattern.canvas.height / cellsPerPageY);
  const gridPages = pagesX * pagesY;
  const legendPages = includeColorLegend ? Math.ceil(usedColorsCount / 20) : 0;
  const previewPages = includePreviewPage ? 1 : 0;
  const totalPages = previewPages + gridPages + legendPages;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Export PDF</h2>

        <div className="space-y-4 mb-6">
          {/* Pattern info */}
          <div className="bg-gray-50 rounded p-3 text-sm text-gray-600">
            <p><strong>Pattern:</strong> {displayName}</p>
            <p><strong>Size:</strong> {pattern.canvas.width} x {pattern.canvas.height} stitches</p>
            <p><strong>Colors used:</strong> {usedColorsCount}</p>
            <p><strong>Estimated pages:</strong> {totalPages}</p>
          </div>

          {/* Trial watermark notice */}
          {shouldWatermark && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
              <p className="font-medium">Trial Version</p>
              <p className="text-xs mt-1">
                PDF will include a watermark. Purchase a license to remove it.
              </p>
            </div>
          )}

          {/* Export options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePreviewPage}
                onChange={(e) => setIncludePreviewPage(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Include preview page</span>
                <p className="text-xs text-gray-500">
                  Adds a cover page with pattern preview, size, and stitch count
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeColorLegend}
                onChange={(e) => setIncludeColorLegend(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include color legend</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStitchCounts}
                onChange={(e) => setIncludeStitchCounts(e.target.checked)}
                disabled={!includeColorLegend}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={`text-sm ${includeColorLegend ? 'text-gray-700' : 'text-gray-400'}`}>
                Include stitch counts per color
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGridNumbers}
                onChange={(e) => setIncludeGridNumbers(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include row/column numbers</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useSymbols}
                onChange={(e) => setUseSymbols(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div>
                <span className="text-sm text-gray-700">Use symbols (for B&W printing)</span>
                <p className="text-xs text-gray-500">
                  Shows symbols instead of colors for better black & white printing
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              'Export PDF'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
