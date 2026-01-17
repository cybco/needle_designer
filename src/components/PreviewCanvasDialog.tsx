import { useEffect, useRef, useState } from 'react';
import { usePatternStore } from '../stores/patternStore';
import { jsPDF } from 'jspdf';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface PreviewCanvasDialogProps {
  onClose: () => void;
}

// Create a pre-rendered overlay for realistic tent stitch 3D "pillow" effect
// This overlay is generated once and reused for all cells (matches PDF export)
function createStitchOverlay(size: number): HTMLCanvasElement {
  const overlay = document.createElement('canvas');
  overlay.width = size;
  overlay.height = size;
  const ctx = overlay.getContext('2d')!;

  // Create radial gradient for 3D pillow effect
  // Light source from top-left, so highlight is offset toward top-left
  const gradient = ctx.createRadialGradient(
    size * 0.35, size * 0.35, 0,          // Inner circle (highlight, offset toward light)
    size * 0.5, size * 0.5, size * 0.7    // Outer circle (shadow at edges)
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');    // Strong highlight center
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.15)'); // Fade highlight
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');          // Transparent middle
  gradient.addColorStop(0.75, 'rgba(0, 0, 0, 0.25)');      // Start shadow
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');          // Strong shadow at edges

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add extra corner shadows for more depth
  const cornerGradient = ctx.createRadialGradient(
    size, size, 0,           // Bottom-right corner
    size, size, size * 1.2
  );
  cornerGradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
  cornerGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
  cornerGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = cornerGradient;
  ctx.fillRect(0, 0, size, size);

  return overlay;
}

export function PreviewCanvasDialog({ onClose }: PreviewCanvasDialogProps) {
  const { pattern } = usePatternStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [baseCellSize, setBaseCellSize] = useState(10);

  // Calculate optimal cell size to fit the canvas in the dialog at 100% zoom
  useEffect(() => {
    if (!pattern || !containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 48; // padding
    const containerHeight = container.clientHeight - 48;

    // Calculate the cell size that makes the pattern fit exactly at 100% zoom
    const maxCellWidth = containerWidth / pattern.canvas.width;
    const maxCellHeight = containerHeight / pattern.canvas.height;
    // Use the smaller of the two to ensure it fits in both dimensions
    const optimalCellSize = Math.min(maxCellWidth, maxCellHeight);

    setBaseCellSize(optimalCellSize);
  }, [pattern]);

  // Render the preview canvas with realistic tent stitch 3D effect
  useEffect(() => {
    if (!pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use integer cell size to avoid sub-pixel gaps that create grid artifacts
    const scaledCellSize = Math.max(1, Math.floor(baseCellSize * zoom));
    const width = pattern.canvas.width * scaledCellSize;
    const height = pattern.canvas.height * scaledCellSize;

    canvas.width = width;
    canvas.height = height;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Create a color lookup map for faster rendering
    const colorMap = new Map<string, [number, number, number]>();
    for (const color of pattern.colorPalette) {
      colorMap.set(color.id, color.rgb);
    }

    // Create the 3D overlay once for this cell size
    const overlay = createStitchOverlay(scaledCellSize);

    // Render all visible layers (bottom to top)
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;

      for (const stitch of layer.stitches) {
        const rgb = colorMap.get(stitch.colorId);
        if (!rgb) continue;

        const x = stitch.x * scaledCellSize;
        const y = stitch.y * scaledCellSize;

        // Draw base color
        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(x, y, scaledCellSize, scaledCellSize);

        // Apply 3D overlay
        ctx.drawImage(overlay, x, y, scaledCellSize, scaledCellSize);
      }
    }
  }, [pattern, baseCellSize, zoom]);

  if (!pattern) {
    return null;
  }

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 4));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

  const handleExport = async () => {
    if (!canvasRef.current || !pattern) return;

    // Detect iOS/iPadOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document && navigator.maxTouchPoints > 1);

    const fileName = pattern.name || 'pattern';
    const safeName = fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const defaultName = `${safeName}_preview.pdf`;

    let filePath: string;

    if (isIOS) {
      filePath = defaultName;
    } else {
      const result = await save({
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
        defaultPath: defaultName,
      });

      if (!result) {
        return; // User cancelled
      }
      filePath = result;
    }

    try {
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL('image/png');

      // Determine page orientation based on canvas aspect ratio
      const aspectRatio = canvas.width / canvas.height;
      const orientation = aspectRatio >= 1 ? 'landscape' : 'portrait';

      const pdf = new jsPDF({
        orientation,
        unit: 'in',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 0.5;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;

      // Scale image to fit within available space while maintaining aspect ratio
      let imgWidth = availableWidth;
      let imgHeight = imgWidth / aspectRatio;

      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * aspectRatio;
      }

      // Center the image on the page
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      // Get PDF as ArrayBuffer
      const pdfData = pdf.output('arraybuffer');

      // Convert ArrayBuffer to base64 for sending to Rust
      const bytes = new Uint8Array(pdfData);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      // Save via Tauri
      await invoke<string>('save_pdf', { path: filePath, data: base64 });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert(`Failed to export PDF: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl flex flex-col mx-4 my-4" style={{ width: '90vw', height: '90vh', maxWidth: '1400px', maxHeight: '900px' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Preview Canvas</h2>
            <p className="text-sm text-gray-500">
              {pattern.canvas.width} x {pattern.canvas.height} stitches
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <button
              onClick={handleZoomOut}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={handleZoomReset}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors min-w-[60px]"
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              title="Zoom In"
            >
              +
            </button>
            <div className="w-px h-6 bg-gray-200 mx-2" />
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas container - grid wrapper enables scrolling to top-left when zoomed while centering when small */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-800 p-6"
          style={{ minHeight: 0 }}
        >
          <div className="grid place-items-center" style={{ minWidth: '100%', minHeight: '100%', width: 'fit-content', height: 'fit-content' }}>
            <div className="shadow-2xl">
              <canvas ref={canvasRef} className="block" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
          >
            Export PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
