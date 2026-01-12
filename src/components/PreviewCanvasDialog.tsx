import { useEffect, useRef, useState } from 'react';
import { usePatternStore } from '../stores/patternStore';

interface PreviewCanvasDialogProps {
  onClose: () => void;
}

// Helper to draw a realistic cross-stitch on a cell
function drawCrossStitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: [number, number, number]
) {
  const [r, g, b] = rgb;

  // Calculate lighter and darker shades for 3D effect
  const lighterR = Math.min(255, r + 40);
  const lighterG = Math.min(255, g + 40);
  const lighterB = Math.min(255, b + 40);

  const darkerR = Math.max(0, r - 50);
  const darkerG = Math.max(0, g - 50);
  const darkerB = Math.max(0, b - 50);

  const padding = size * 0.08; // Small padding from cell edges
  const threadWidth = size * 0.28; // Width of each thread

  const left = x + padding;
  const right = x + size - padding;
  const top = y + padding;
  const bottom = y + size - padding;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the bottom-left to top-right stroke first (underneath)
  // This creates the "under" part of the X
  ctx.strokeStyle = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
  ctx.lineWidth = threadWidth;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, top);
  ctx.stroke();

  // Add highlight to the first stroke
  ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.lineWidth = threadWidth * 0.6;
  ctx.beginPath();
  ctx.moveTo(left + threadWidth * 0.15, bottom - threadWidth * 0.15);
  ctx.lineTo(right - threadWidth * 0.15, top + threadWidth * 0.15);
  ctx.stroke();

  // Draw the top-left to bottom-right stroke (on top)
  // This creates the "over" part of the X
  ctx.strokeStyle = `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
  ctx.lineWidth = threadWidth;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(right, bottom);
  ctx.stroke();

  // Add highlight to the second stroke (brighter since it's on top)
  ctx.strokeStyle = `rgb(${lighterR}, ${lighterG}, ${lighterB})`;
  ctx.lineWidth = threadWidth * 0.5;
  ctx.beginPath();
  ctx.moveTo(left + threadWidth * 0.2, top + threadWidth * 0.2);
  ctx.lineTo(right - threadWidth * 0.2, bottom - threadWidth * 0.2);
  ctx.stroke();

  // Add a subtle center highlight where threads cross
  ctx.fillStyle = `rgba(${lighterR}, ${lighterG}, ${lighterB}, 0.3)`;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, threadWidth * 0.3, 0, Math.PI * 2);
  ctx.fill();
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

  // Render the preview canvas
  useEffect(() => {
    if (!pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaledCellSize = baseCellSize * zoom;
    const width = pattern.canvas.width * scaledCellSize;
    const height = pattern.canvas.height * scaledCellSize;

    canvas.width = width;
    canvas.height = height;

    // Fill with canvas/fabric background color (white like blank canvas)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Add subtle fabric texture grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= pattern.canvas.width; i++) {
      ctx.beginPath();
      ctx.moveTo(i * scaledCellSize, 0);
      ctx.lineTo(i * scaledCellSize, height);
      ctx.stroke();
    }
    for (let j = 0; j <= pattern.canvas.height; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * scaledCellSize);
      ctx.lineTo(width, j * scaledCellSize);
      ctx.stroke();
    }

    // Create a color lookup map for faster rendering
    const colorMap = new Map<string, [number, number, number]>();
    for (const color of pattern.colorPalette) {
      colorMap.set(color.id, color.rgb);
    }

    // Render all visible layers (bottom to top)
    for (const layer of pattern.layers) {
      if (!layer.visible) continue;

      for (const stitch of layer.stitches) {
        const rgb = colorMap.get(stitch.colorId);
        if (!rgb) continue;

        const x = stitch.x * scaledCellSize;
        const y = stitch.y * scaledCellSize;

        drawCrossStitch(ctx, x, y, scaledCellSize, rgb);
      }
    }
  }, [pattern, baseCellSize, zoom]);

  if (!pattern) {
    return null;
  }

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.25, 4));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

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

        {/* Canvas container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-800 p-6 flex items-center justify-center"
          style={{ minHeight: 0 }}
        >
          <div className="shadow-2xl">
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200">
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
