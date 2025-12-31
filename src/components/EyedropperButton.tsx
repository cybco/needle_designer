import { useState, useCallback } from 'react';

// Declare EyeDropper API types (experimental API)
declare global {
  interface EyeDropperConstructor {
    new(): EyeDropperInstance;
  }
  interface EyeDropperInstance {
    open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
  }
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

interface EyedropperButtonProps {
  onColorPicked: (rgb: [number, number, number]) => void;
  className?: string;
}

/**
 * Eyedropper button that uses the browser's native EyeDropper API
 * This allows picking colors from anywhere on the screen, including outside the app
 * Supported in Chromium-based browsers (Chrome, Edge, and Tauri's WebView)
 */
export function EyedropperButton({ onColorPicked, className = '' }: EyedropperButtonProps) {
  const [isPicking, setIsPicking] = useState(false);
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'EyeDropper' in window);

  // Convert hex color to RGB tuple
  const hexToRgb = useCallback((hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ];
    }
    return [0, 0, 0];
  }, []);

  // Start the eyedropper using native browser API
  const startPicking = useCallback(async () => {
    if (!window.EyeDropper) {
      alert('EyeDropper API is not supported in this browser');
      return;
    }

    setIsPicking(true);

    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();

      // Convert the hex color to RGB
      const rgb = hexToRgb(result.sRGBHex);
      onColorPicked(rgb);
    } catch (err) {
      // User cancelled (pressed Escape) or other error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('EyeDropper error:', err);
      }
    } finally {
      setIsPicking(false);
    }
  }, [hexToRgb, onColorPicked]);

  if (!isSupported) {
    return (
      <button
        disabled
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed ${className}`}
        title="EyeDropper not supported in this browser"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m2 22 1-1h3l9-9" />
          <path d="M3 21v-3l9-9" />
          <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
        </svg>
        Eyedropper (N/A)
      </button>
    );
  }

  return (
    <button
      onClick={startPicking}
      disabled={isPicking}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded border transition-colors ${
        isPicking
          ? 'bg-blue-100 border-blue-300 text-blue-700'
          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
      } ${className}`}
      title="Pick color from anywhere on screen"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m2 22 1-1h3l9-9" />
        <path d="M3 21v-3l9-9" />
        <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
      </svg>
      {isPicking ? 'Picking...' : 'Eyedropper'}
    </button>
  );
}
