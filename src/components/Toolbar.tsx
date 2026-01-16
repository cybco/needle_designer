import React, { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { usePatternStore, Tool, StitchType } from '../stores/patternStore';
import handMoveIcon from '../assets/hand-move.svg';

// Icons for selection actions
export function SelectionMoveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 9l-3 3 3 3" />
      <path d="M9 5l3-3 3 3" />
      <path d="M15 19l-3 3-3-3" />
      <path d="M19 9l3 3-3 3" />
      <path d="M2 12h20" />
      <path d="M12 2v20" />
    </svg>
  );
}

export function SelectionDuplicateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function SelectionNewLayerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.97 4.08a2 2 0 0 1-1.66 0L2 12.5" />
      <path d="M12 17v5" />
      <path d="M9 22h6" />
    </svg>
  );
}

export function SelectionDuplicateToNewLayerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Duplicate squares */}
      <rect x="10" y="2" width="10" height="10" rx="1" />
      <path d="M6 6H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
      {/* Layer with plus */}
      <path d="M4 18l8 4 8-4" />
      <path d="M12 14v8" />
    </svg>
  );
}

export function FlipHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center vertical line */}
      <path d="M12 3v18" strokeDasharray="2 2" />
      {/* Left arrow */}
      <path d="M8 7L4 12l4 5" />
      <path d="M4 12h5" />
      {/* Right arrow */}
      <path d="M16 7l4 5-4 5" />
      <path d="M20 12h-5" />
    </svg>
  );
}

export function FlipVerticalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center horizontal line */}
      <path d="M3 12h18" strokeDasharray="2 2" />
      {/* Top arrow */}
      <path d="M7 8L12 4l5 4" />
      <path d="M12 4v5" />
      {/* Bottom arrow */}
      <path d="M7 16l5 4 5-4" />
      <path d="M12 20v-5" />
    </svg>
  );
}

export function RotateLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Arrow pointing left */}
      <polyline points="1 4 1 10 7 10" />
      {/* Curved arc */}
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function RotateRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Arrow pointing right */}
      <polyline points="23 4 23 10 17 10" />
      {/* Curved arc */}
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export interface ToolVisibility {
  pencil: boolean;
  eraser: boolean;
  fill: boolean;
  colorswap: boolean;
  pan: boolean;
  select: boolean;
  areaselect: boolean;
  text: boolean;
  line: boolean;
  rectangle: boolean;
  ellipse: boolean;
  undo: boolean;
  redo: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
  zoomFit: boolean;
  grid: boolean;
  preview: boolean;
  // Selection action buttons
  selectionDuplicate: boolean;
  selectionNewLayer: boolean;
  selectionDuplicateToNewLayer: boolean;
  selectionFlipHorizontal: boolean;
  selectionFlipVertical: boolean;
  selectionRotateLeft: boolean;
  selectionRotateRight: boolean;
  selectionCenterHorizontal: boolean;
  selectionCenterVertical: boolean;
}

interface ToolButtonProps {
  tool: Tool;
  icon: ReactNode;
  label: string;
  activeTool: Tool;
  onClick: (tool: Tool) => void;
  showLabel?: boolean;
}

function ToolButton({ tool, icon, label, activeTool, onClick, showLabel = false }: ToolButtonProps) {
  const isActive = activeTool === tool;
  // Extract short label (first word or before parenthesis)
  const shortLabel = label.split(' (')[0].split(' ')[0];

  const handleClick = () => {
    if (isActive && tool !== 'pan') {
      // Clicking on the active tool switches to pan tool
      onClick('pan');
    } else {
      onClick(tool);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center justify-center rounded
        transition-colors
        ${showLabel ? 'w-14 h-14 flex-col gap-0.5' : 'w-10 h-10 text-lg'}
        ${isActive
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
      `}
      title={label}
    >
      <span className={showLabel ? 'text-base' : 'text-lg'}>{icon}</span>
      {showLabel && <span className="text-[9px] leading-none truncate w-full text-center">{shortLabel}</span>}
    </button>
  );
}

// ActionButton for non-tool buttons (undo, redo, zoom, etc.)
interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  showLabel?: boolean;
}

function ActionButton({ icon, label, onClick, disabled = false, active = false, buttonRef, showLabel = false }: ActionButtonProps) {
  const baseClasses = disabled
    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
    : active
      ? 'bg-blue-500 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  // Extract short label (first word or before parenthesis)
  const shortLabel = label.split(' (')[0].split(' ')[0];

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded transition-colors ${showLabel ? 'w-14 h-14 flex-col gap-0.5' : 'w-10 h-10 text-lg'} ${baseClasses}`}
      title={label}
    >
      <span className={showLabel ? 'text-base' : 'text-lg'}>{icon}</span>
      {showLabel && <span className="text-[9px] leading-none truncate w-full text-center">{shortLabel}</span>}
    </button>
  );
}

// Cursor/pointer icon SVG for Move tool
export function CursorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
    >
      <path d="M4 4l7 18 2.5-7.5L21 12 4 4z" />
    </svg>
  );
}

// Paint bucket/fill icon SVG (custom with red paint)
export function FillIcon({ className, variant = 'red' }: { className?: string; variant?: 'red' | 'grey' }) {
  const fillColor = variant === 'grey' ? '#888888' : '#C75B5B';
  const dropColor = variant === 'grey' ? '#666666' : '#B84C4C';
  return (
    <svg
      viewBox="0 0 22 22"
      className={className || "w-5 h-5"}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Handle */}
      <path d="M9.996,6C8.097,4.101 6.468,2.472 4.996,1" fill="none" stroke="black" strokeWidth="1.5" />
      {/* Fill line */}
      <path d="M17.988,11L1.037,11" fill="none" stroke="black" strokeWidth="1.5" />
      {/* Paint fill inside bucket */}
      <path d="M1.193,13.443C2.023,14.418 8.537,19.127 8.537,19.127L17.001,12.696L18.868,9.875L1.359,9.875C1.359,9.875 0.363,12.468 1.193,13.443Z" fill={fillColor} />
      {/* Paint drop */}
      <path d="M20.141,17.38C19.558,16.901 19.154,16.238 18.996,15.5C18.841,16.239 18.436,16.903 17.851,17.38C17.276,17.84 16.996,18.4 16.996,18.975C16.996,18.983 16.996,18.992 16.996,19C16.996,20.097 17.899,21 18.996,21C20.093,21 20.996,20.097 20.996,19C20.996,18.992 20.996,18.983 20.996,18.975C20.996,18.395 20.711,17.845 20.141,17.38" fill={dropColor} stroke={dropColor} strokeWidth="1.5" />
      {/* Bucket outline */}
      <path d="M7.496,3.5L9.644,1.352C10.111,0.885 10.881,0.885 11.348,1.352L18.644,8.648C19.111,9.115 19.111,9.885 18.644,10.352L11.052,17.944C9.65,19.346 7.342,19.346 5.94,17.944L2.052,14.056C0.65,12.654 0.65,10.346 2.052,8.944L4.666,6.33" fill="none" stroke="black" strokeWidth="1.5" />
    </svg>
  );
}

// Text icon SVG (Lucide type-outline)
export function TextIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" />
    </svg>
  );
}

// Pan/Move icon (hand with arrows)
export function PanIcon({ className }: { className?: string }) {
  return (
    <img
      src={handMoveIcon}
      alt="Pan"
      className={className || "w-7 h-7"}
    />
  );
}

// Eraser icon SVG (colored)
export function EraserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
    >
      {/* Main eraser body (pink/salmon) */}
      <path
        d="M20 20H9L3.5 14.5c-.7-.7-.7-1.8 0-2.5L13 2.5c.7-.7 1.8-.7 2.5 0l6 6c.7.7.7 1.8 0 2.5L12 20"
        fill="#F8A5A5"
        stroke="#333"
        strokeWidth="1.5"
      />
      {/* Eraser tip (darker) */}
      <path
        d="M9 20L3.5 14.5c-.7-.7-.7-1.8 0-2.5L7 8.5l7 7L9 20z"
        fill="#4A90A4"
        stroke="#333"
        strokeWidth="1.5"
      />
      {/* Dividing line */}
      <path
        d="M7 8.5L14 15.5"
        stroke="#333"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Color Swap icon SVG (two color squares with swap arrows)
export function ColorSwapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
    >
      {/* First color square (top-left) */}
      <rect x="2" y="2" width="8" height="8" rx="1" fill="#E57373" stroke="#333" strokeWidth="1.5" />
      {/* Second color square (bottom-right) */}
      <rect x="14" y="14" width="8" height="8" rx="1" fill="#64B5F6" stroke="#333" strokeWidth="1.5" />
      {/* Swap arrow (top-right to bottom-left) */}
      <path d="M14 6 L18 6 L18 10" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6 L12 12" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
      {/* Swap arrow (bottom-left to top-right) */}
      <path d="M10 18 L6 18 L6 14" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18 L12 12" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Preview Canvas icon SVG (eye with canvas/grid)
export function PreviewCanvasIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Eye outline */}
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      {/* Pupil with grid pattern */}
      <circle cx="12" cy="12" r="3" />
      {/* Small grid lines inside pupil */}
      <path d="M10.5 12h3" strokeWidth="1" />
      <path d="M12 10.5v3" strokeWidth="1" />
    </svg>
  );
}

// Area Select icon SVG (marquee/selection rectangle with dashed border)
export function AreaSelectIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Dashed selection rectangle */}
      <rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="4 2" />
      {/* Corner handles */}
      <rect x="1" y="1" width="4" height="4" fill="currentColor" stroke="none" />
      <rect x="19" y="1" width="4" height="4" fill="currentColor" stroke="none" />
      <rect x="1" y="19" width="4" height="4" fill="currentColor" stroke="none" />
      <rect x="19" y="19" width="4" height="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Fullscreen/Fit icon SVG (Lucide fullscreen)
export function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect width="10" height="8" x="7" y="8" rx="1" />
    </svg>
  );
}

// Center View icon SVG (crosshair with center point)
export function CenterViewIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer circle */}
      <circle cx="12" cy="12" r="9" />
      {/* Crosshair lines */}
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      {/* Center dot */}
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

// Center Horizontal icon (horizontal line with arrows pointing inward)
export function CenterHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center vertical line */}
      <path d="M12 4v16" />
      {/* Left arrow pointing right */}
      <path d="M4 12h5" />
      <path d="M7 9l3 3-3 3" />
      {/* Right arrow pointing left */}
      <path d="M15 12h5" />
      <path d="M17 9l-3 3 3 3" />
    </svg>
  );
}

// Center Vertical icon (vertical line with arrows pointing inward)
export function CenterVerticalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Center horizontal line */}
      <path d="M4 12h16" />
      {/* Top arrow pointing down */}
      <path d="M12 4v5" />
      <path d="M9 7l3 3 3-3" />
      {/* Bottom arrow pointing up */}
      <path d="M12 15v5" />
      <path d="M9 17l3-3 3 3" />
    </svg>
  );
}

// Square stitch type icon
export function SquareStitchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  );
}

// Circle stitch type icon (small - for positional circles)
export function CircleStitchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="4" />
      <rect x="3" y="3" width="18" height="18" fill="none" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}

// Full circle stitch type icon (fills cell like square)
export function CircleFullIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

// Half-square triangle icons (4 corner types)
export function HalfSquareTLIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Triangle in top-left corner */}
      <polygon points="3,3 21,3 3,21" />
    </svg>
  );
}

export function HalfSquareTRIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Triangle in top-right corner */}
      <polygon points="3,3 21,3 21,21" />
    </svg>
  );
}

export function HalfSquareBLIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Triangle in bottom-left corner */}
      <polygon points="3,3 3,21 21,21" />
    </svg>
  );
}

export function HalfSquareBRIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Triangle in bottom-right corner */}
      <polygon points="21,3 3,21 21,21" />
    </svg>
  );
}

// Half-square rectangle icons (top, bottom, left, right)
export function HalfSquareTopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Top half rectangle */}
      <rect x="3" y="3" width="18" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function HalfSquareBottomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Bottom half rectangle */}
      <rect x="3" y="12" width="18" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function HalfSquareLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Left half rectangle */}
      <rect x="3" y="3" width="9" height="18" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function HalfSquareRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Right half rectangle */}
      <rect x="12" y="3" width="9" height="18" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

// Quarter-square icons (4 corners)
export function QuarterSquareTLIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Top-left quarter */}
      <rect x="3" y="3" width="9" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function QuarterSquareTRIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Top-right quarter */}
      <rect x="12" y="3" width="9" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function QuarterSquareBLIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Bottom-left quarter */}
      <rect x="3" y="12" width="9" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function QuarterSquareBRIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Bottom-right quarter */}
      <rect x="12" y="12" width="9" height="9" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

// Border icons (thin edges)
export function BorderTopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Top border */}
      <rect x="3" y="3" width="18" height="4" rx="2" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function BorderBottomIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Bottom border */}
      <rect x="3" y="17" width="18" height="4" rx="2" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function BorderLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Left border */}
      <rect x="3" y="3" width="4" height="18" rx="2" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

export function BorderRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      {/* Right border */}
      <rect x="17" y="3" width="4" height="18" rx="2" />
      <rect x="3" y="3" width="18" height="18" fill="none" />
    </svg>
  );
}

// Cross line icons (diagonal backstitches)
export function CrossTLBRIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      {/* Diagonal line from top-left to bottom-right */}
      <line x1="3" y1="3" x2="21" y2="21" />
      <rect x="3" y="3" width="18" height="18" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

export function CrossTRBLIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className || "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      {/* Diagonal line from top-right to bottom-left */}
      <line x1="21" y1="3" x2="3" y2="21" />
      <rect x="3" y="3" width="18" height="18" fill="none" strokeWidth="1.5" />
    </svg>
  );
}

const DEFAULT_VISIBILITY: ToolVisibility = {
  pencil: true,
  eraser: true,
  fill: true,
  colorswap: true,
  pan: true,
  select: true,
  areaselect: true,
  text: true,
  line: true,
  rectangle: true,
  ellipse: true,
  undo: true,
  redo: true,
  zoomIn: true,
  zoomOut: true,
  zoomFit: true,
  grid: true,
  preview: true,
  selectionDuplicate: true,
  selectionNewLayer: true,
  selectionDuplicateToNewLayer: true,
  selectionFlipHorizontal: true,
  selectionFlipVertical: true,
  selectionRotateLeft: true,
  selectionRotateRight: true,
  selectionCenterHorizontal: true,
  selectionCenterVertical: true,
};

// Helper to get stitch type display name
function getStitchTypeName(type: StitchType): string {
  switch (type) {
    case 'square': return 'Square';
    case 'circle': return 'Small Circle';
    case 'circle-full': return 'Circle';
    case 'half-tl': return 'Half-Square (Top-Left)';
    case 'half-tr': return 'Half-Square (Top-Right)';
    case 'half-bl': return 'Half-Square (Bottom-Left)';
    case 'half-br': return 'Half-Square (Bottom-Right)';
    case 'half-top': return 'Half-Square (Top)';
    case 'half-bottom': return 'Half-Square (Bottom)';
    case 'half-left': return 'Half-Square (Left)';
    case 'half-right': return 'Half-Square (Right)';
    case 'quarter-tl': return 'Quarter-Square (Top-Left)';
    case 'quarter-tr': return 'Quarter-Square (Top-Right)';
    case 'quarter-bl': return 'Quarter-Square (Bottom-Left)';
    case 'quarter-br': return 'Quarter-Square (Bottom-Right)';
    case 'border-top': return 'Border (Top)';
    case 'border-bottom': return 'Border (Bottom)';
    case 'border-left': return 'Border (Left)';
    case 'border-right': return 'Border (Right)';
    case 'cross-tlbr': return 'Cross (TL-BR)';
    case 'cross-trbl': return 'Cross (TR-BL)';
    default: return 'Square';
  }
}

// Helper to get stitch type icon component
function getStitchTypeIcon(type: StitchType): React.ReactNode {
  switch (type) {
    case 'square': return <SquareStitchIcon />;
    case 'circle': return <CircleStitchIcon />;
    case 'circle-full': return <CircleFullIcon />;
    case 'half-tl': return <HalfSquareTLIcon />;
    case 'half-tr': return <HalfSquareTRIcon />;
    case 'half-bl': return <HalfSquareBLIcon />;
    case 'half-br': return <HalfSquareBRIcon />;
    case 'half-top': return <HalfSquareTopIcon />;
    case 'half-bottom': return <HalfSquareBottomIcon />;
    case 'half-left': return <HalfSquareLeftIcon />;
    case 'half-right': return <HalfSquareRightIcon />;
    case 'quarter-tl': return <QuarterSquareTLIcon />;
    case 'quarter-tr': return <QuarterSquareTRIcon />;
    case 'quarter-bl': return <QuarterSquareBLIcon />;
    case 'quarter-br': return <QuarterSquareBRIcon />;
    case 'border-top': return <BorderTopIcon />;
    case 'border-bottom': return <BorderBottomIcon />;
    case 'border-left': return <BorderLeftIcon />;
    case 'border-right': return <BorderRightIcon />;
    case 'cross-tlbr': return <CrossTLBRIcon />;
    case 'cross-trbl': return <CrossTRBLIcon />;
    default: return <SquareStitchIcon />;
  }
}

interface ToolbarProps {
  onTextToolClick?: () => void;
  onFitToCanvas?: () => void;
  onMoveToCenter?: () => void;
  onPreviewClick?: () => void;
  toolVisibility?: ToolVisibility;
  showLabels?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Toolbar({ onTextToolClick, onFitToCanvas, onMoveToCenter, onPreviewClick, toolVisibility = DEFAULT_VISIBILITY, showLabels = false, collapsed = false, onToggleCollapse }: ToolbarProps) {
  const {
    pattern,
    activeTool,
    zoom,
    showGrid,
    history,
    future,
    selection,
    selectedColorId,
    setTool,
    setZoom,
    toggleGrid,
    undo,
    redo,
    duplicateSelection,
    selectionToNewLayer,
    duplicateSelectionToNewLayer,
    flipSelectionHorizontal,
    flipSelectionVertical,
    rotateSelectionLeft,
    rotateSelectionRight,
    flipLayerHorizontal,
    flipLayerVertical,
    rotateLayerLeft,
    rotateLayerRight,
    centerSelectionHorizontal,
    centerSelectionVertical,
    centerLayerHorizontal,
    centerLayerVertical,
    duplicateLayerToNewLayer,
    duplicateLayer,
    activeStitchType,
    setActiveStitchType,
  } = usePatternStore();

  // Stitch type popup state
  const [showStitchTypePopup, setShowStitchTypePopup] = useState(false);
  const [hoveredStitchSection, setHoveredStitchSection] = useState<string | null>(null);
  const stitchTypeButtonRef = useRef<HTMLButtonElement>(null);
  const stitchTypePopupRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Grid column calculation - must be before any early returns
  // Button sizes change based on whether labels are shown
  const buttonHeight = showLabels ? 56 : 48;
  const buttonWidth = showLabels ? 56 : 48;

  const calculateGridLayout = useCallback((buttonCount: number, height: number) => {
    const gapSize = 8;
    // Each button slot takes buttonHeight + gap (except the last one)
    const slotHeight = buttonHeight + gapSize;
    const buttonsPerColumn = Math.max(1, Math.floor((height + gapSize) / slotHeight));
    const columns = Math.max(1, Math.ceil(buttonCount / buttonsPerColumn));
    return { columns, buttonsPerColumn };
  }, [buttonHeight]);

  const [columns, setColumns] = useState(1);
  const [availableHeight, setAvailableHeight] = useState(window.innerHeight - 150);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track container height using ResizeObserver
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        // Use actual container height minus collapse button (32px) and padding (16px)
        const containerHeight = containerRef.current.clientHeight;
        setAvailableHeight(Math.max(100, containerHeight - 48));
      }
    };

    // Use ResizeObserver for accurate size tracking
    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateHeight();
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [pattern]); // Re-run when pattern changes (container may mount/unmount)

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showStitchTypePopup &&
        stitchTypePopupRef.current &&
        !stitchTypePopupRef.current.contains(event.target as Node) &&
        stitchTypeButtonRef.current &&
        !stitchTypeButtonRef.current.contains(event.target as Node)
      ) {
        setShowStitchTypePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStitchTypePopup]);

  // Helper to check if we have an area selection with stitches
  const hasAreaSelection = selection?.selectionType === 'area' &&
    (selection.selectedStitches?.length || selection.floatingStitches?.length);

  // Helper to check if we have a layer selection
  const hasLayerSelection = selection?.selectionType === 'layer';

  // Combined check: either area selection or layer selection
  const hasTransformableSelection = hasAreaSelection || hasLayerSelection;

  // Collect all tool buttons to render in a grid
  const toolButtons: React.ReactNode[] = [];

  // Pan tool at the top (default tool)
  if (toolVisibility.pan) {
    toolButtons.push(
      <ToolButton key="pan" tool="pan" icon={<PanIcon />} label="Pan (Space)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }

  // Drawing tools
  if (toolVisibility.select) {
    toolButtons.push(
      <ToolButton key="select" tool="select" icon={<CursorIcon />} label="Move (V)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  toolButtons.push(
    <ActionButton key="center" icon={<CenterViewIcon />} label="Center (Move to Center)" onClick={onMoveToCenter || (() => {})} showLabel={showLabels} />
  );
  if (toolVisibility.pencil) {
    toolButtons.push(
      <ToolButton key="pencil" tool="pencil" icon="✏️" label="Pencil (P)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.eraser) {
    toolButtons.push(
      <ToolButton key="eraser" tool="eraser" icon={<EraserIcon />} label="Eraser (E)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.fill) {
    toolButtons.push(
      <ToolButton key="fill" tool="fill" icon={<FillIcon />} label="Fill (G)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.colorswap) {
    toolButtons.push(
      <ToolButton key="colorswap" tool="colorswap" icon={<ColorSwapIcon />} label="Color Swap (C)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.text) {
    toolButtons.push(
      <ToolButton key="text" tool="text" icon={<TextIcon />} label="Text (T)" activeTool={activeTool} onClick={() => { if (onTextToolClick) onTextToolClick(); }} showLabel={showLabels} />
    );
  }

  // Shape tools
  if (toolVisibility.line) {
    toolButtons.push(
      <ToolButton key="line" tool="line" icon="╱" label="Line (L)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.rectangle) {
    toolButtons.push(
      <ToolButton key="rectangle" tool="rectangle" icon="▢" label="Rectangle (R)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }
  if (toolVisibility.ellipse) {
    toolButtons.push(
      <ToolButton key="ellipse" tool="ellipse" icon="◯" label="Circle (O)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }

  // Stitch type button
  toolButtons.push(
    <ActionButton key="stitchtype" icon={getStitchTypeIcon(activeStitchType)} label={`Stitch Type: ${getStitchTypeName(activeStitchType)}`} onClick={() => setShowStitchTypePopup(!showStitchTypePopup)} buttonRef={stitchTypeButtonRef} showLabel={showLabels} />
  );

  // History tools
  if (toolVisibility.undo) {
    toolButtons.push(
      <ActionButton key="undo" icon="↩️" label="Undo (Ctrl+Z)" onClick={undo} disabled={history.length === 0} showLabel={showLabels} />
    );
  }
  if (toolVisibility.redo) {
    toolButtons.push(
      <ActionButton key="redo" icon="↪️" label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={future.length === 0} showLabel={showLabels} />
    );
  }

  // Zoom controls
  if (toolVisibility.zoomIn) {
    toolButtons.push(
      <ActionButton key="zoomin" icon="🔍+" label="Zoom In (+)" onClick={() => setZoom(Math.min(10, zoom + 0.1))} showLabel={showLabels} />
    );
  }
  if (toolVisibility.zoomOut) {
    toolButtons.push(
      <ActionButton key="zoomout" icon="🔍−" label="Zoom Out (-)" onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} showLabel={showLabels} />
    );
  }
  if (toolVisibility.zoomFit) {
    toolButtons.push(
      <ActionButton key="zoomfit" icon={<FullscreenIcon />} label="Fit to Window (0)" onClick={onFitToCanvas || (() => {})} showLabel={showLabels} />
    );
  }

  // Grid toggle
  if (toolVisibility.grid) {
    toolButtons.push(
      <ActionButton key="grid" icon="#" label="Toggle Grid (G)" onClick={toggleGrid} active={!showGrid} showLabel={showLabels} />
    );
  }

  // Preview
  if (toolVisibility.preview) {
    toolButtons.push(
      <ActionButton key="preview" icon={<PreviewCanvasIcon />} label="Preview Canvas" onClick={onPreviewClick || (() => {})} showLabel={showLabels} />
    );
  }

  // Area select
  if (toolVisibility.areaselect) {
    toolButtons.push(
      <ToolButton key="areaselect" tool="areaselect" icon={<AreaSelectIcon />} label="Select (S)" activeTool={activeTool} onClick={setTool} showLabel={showLabels} />
    );
  }

  // Selection actions
  const hasSelectionEnabled = selection && selection.selectionType === 'area' && selection.selectedStitches?.length;
  // Note: Move Selection button removed - area selections are now directly draggable
  if (toolVisibility.selectionDuplicate) {
    // For layer selection, duplicate the entire layer; for area selection, duplicate selected stitches
    const handleDuplicate = () => {
      if (hasLayerSelection && selection?.layerId) {
        duplicateLayer(selection.layerId);
      } else {
        duplicateSelection();
      }
    };
    toolButtons.push(
      <ActionButton key="seldup" icon={<SelectionDuplicateIcon />} label="Duplicate Selection" onClick={handleDuplicate} disabled={!hasSelectionEnabled && !hasLayerSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionNewLayer) {
    toolButtons.push(
      <ActionButton key="selnewlayer" icon={<SelectionNewLayerIcon />} label="-Layer (Move to New Layer)" onClick={selectionToNewLayer} disabled={!hasSelectionEnabled} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionDuplicateToNewLayer) {
    toolButtons.push(
      <ActionButton key="seldupnewlayer" icon={<SelectionDuplicateToNewLayerIcon />} label="+Layer (Duplicate to New Layer)" onClick={() => hasLayerSelection ? duplicateLayerToNewLayer() : duplicateSelectionToNewLayer()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionFlipHorizontal) {
    toolButtons.push(
      <ActionButton key="selfliph" icon={<FlipHorizontalIcon />} label="Flip Horizontal" onClick={() => hasLayerSelection ? flipLayerHorizontal() : flipSelectionHorizontal()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionFlipVertical) {
    toolButtons.push(
      <ActionButton key="selflipv" icon={<FlipVerticalIcon />} label="Flip Vertical" onClick={() => hasLayerSelection ? flipLayerVertical() : flipSelectionVertical()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionRotateLeft) {
    toolButtons.push(
      <ActionButton key="selrotl" icon={<RotateLeftIcon />} label="Rotate Left (90° CCW)" onClick={() => hasLayerSelection ? rotateLayerLeft() : rotateSelectionLeft()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionRotateRight) {
    toolButtons.push(
      <ActionButton key="selrotr" icon={<RotateRightIcon />} label="Rotate Right (90° CW)" onClick={() => hasLayerSelection ? rotateLayerRight() : rotateSelectionRight()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionCenterHorizontal) {
    toolButtons.push(
      <ActionButton key="selcenterh" icon={<CenterHorizontalIcon />} label="Center Horizontal" onClick={() => hasLayerSelection ? centerLayerHorizontal() : centerSelectionHorizontal()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }
  if (toolVisibility.selectionCenterVertical) {
    toolButtons.push(
      <ActionButton key="selcenterv" icon={<CenterVerticalIcon />} label="Center Vertical" onClick={() => hasLayerSelection ? centerLayerVertical() : centerSelectionVertical()} disabled={!hasTransformableSelection} showLabel={showLabels} />
    );
  }

  // Calculate columns based on button count - do this synchronously during render
  const toolButtonCount = toolButtons.length;
  const { columns: calculatedColumns, buttonsPerColumn } = calculateGridLayout(toolButtonCount, availableHeight);

  // Update columns state when calculated value changes
  useEffect(() => {
    if (calculatedColumns !== columns) {
      setColumns(calculatedColumns);
    }
  }, [calculatedColumns, columns]);

  // Use the calculated value directly (not the state) for immediate rendering
  // Width = (columns * buttonWidth) + ((columns - 1) * gap) + padding
  const gapSize = 8;
  const toolbarWidth = (calculatedColumns * buttonWidth) + ((calculatedColumns - 1) * gapSize);

  // Collapsed state
  if (collapsed) {
    return (
      <div className="w-8 shrink-0 bg-white border-r border-gray-300 flex flex-col transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="h-8 flex items-center justify-start pl-2 bg-gray-100 hover:bg-gray-200 border-b border-gray-300 shrink-0"
          title="Expand Toolbar"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // No pattern state
  if (!pattern) {
    return (
      <div className="w-14 min-w-14 shrink-0 bg-white border-r border-gray-300 p-2">
        <div className="space-y-2">
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
          <div className="w-10 h-10 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="shrink-0 bg-white border-r border-gray-300 flex flex-col transition-all duration-200 overflow-visible relative">
      {/* Collapse/Expand Toggle */}
      <button
        onClick={onToggleCollapse}
        className="h-8 flex items-center justify-start pl-2 bg-gray-100 hover:bg-gray-200 border-b border-gray-300 shrink-0"
        title="Collapse Toolbar"
      >
        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Toolbar grid */}
      <div
        ref={toolbarRef}
        className="p-2 flex-1"
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${buttonsPerColumn}, ${buttonHeight}px)`,
          gridAutoFlow: 'column',
          gridAutoColumns: `${buttonWidth}px`,
          gap: '8px',
          alignContent: 'start',
          width: toolbarWidth + 16, // Add padding for p-2 (8px each side)
          minWidth: toolbarWidth + 16,
        }}
      >
        {toolButtons}
      </div>

      {/* Stitch Type Popup - positioned outside the grid */}
        {showStitchTypePopup && (
          <div
            ref={stitchTypePopupRef}
            className="absolute left-full ml-2 bottom-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 w-64 max-h-[80vh] overflow-y-auto"
            onMouseLeave={() => setHoveredStitchSection(null)}
          >
            <div className="text-sm font-semibold text-gray-700 mb-2">Stitch Type</div>

            {/* Warning if no color selected */}
            {!selectedColorId && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
                Please select a color from the palette before drawing.
              </p>
            )}

            {/* Basic stitch type options - square and circle-full */}
            <div
              className="grid grid-cols-3 gap-2 mb-3"
              onMouseEnter={() => setHoveredStitchSection('basic')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('square');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'square'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Square"
              >
                <SquareStitchIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('circle-full');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'circle-full'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Circle"
              >
                <CircleFullIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('circle');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'circle'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Small Circle"
                onMouseEnter={() => setHoveredStitchSection('circle-positional')}
              >
                <CircleStitchIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Half-square triangle options */}
            <div
              className="grid grid-cols-4 gap-2 mb-2"
              onMouseEnter={() => setHoveredStitchSection('half-square')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('half-tl');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-tl'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top-Left"
              >
                <HalfSquareTLIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-tr');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-tr'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top-Right"
              >
                <HalfSquareTRIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-bl');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-bl'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom-Left"
              >
                <HalfSquareBLIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-br');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-br'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom-Right"
              >
                <HalfSquareBRIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Half-square rectangle options */}
            <div
              className="grid grid-cols-4 gap-2 mb-2"
              onMouseEnter={() => setHoveredStitchSection('half-square')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('half-top');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-top'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top"
              >
                <HalfSquareTopIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-bottom');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-bottom'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom"
              >
                <HalfSquareBottomIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-left');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-left'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Left"
              >
                <HalfSquareLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('half-right');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'half-right'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Right"
              >
                <HalfSquareRightIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Quarter-square options */}
            <div
              className="grid grid-cols-4 gap-2 mb-2"
              onMouseEnter={() => setHoveredStitchSection('quarter')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('quarter-tl');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'quarter-tl'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top-Left"
              >
                <QuarterSquareTLIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('quarter-tr');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'quarter-tr'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top-Right"
              >
                <QuarterSquareTRIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('quarter-bl');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'quarter-bl'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom-Left"
              >
                <QuarterSquareBLIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('quarter-br');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'quarter-br'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom-Right"
              >
                <QuarterSquareBRIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Border options */}
            <div
              className="grid grid-cols-4 gap-2 mb-2"
              onMouseEnter={() => setHoveredStitchSection('border')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('border-top');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'border-top'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Top Border"
              >
                <BorderTopIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('border-bottom');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'border-bottom'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Bottom Border"
              >
                <BorderBottomIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('border-left');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'border-left'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Left Border"
              >
                <BorderLeftIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('border-right');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'border-right'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Right Border"
              >
                <BorderRightIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Cross line options */}
            <div
              className="grid grid-cols-2 gap-2 mb-2"
              onMouseEnter={() => setHoveredStitchSection('cross')}
            >
              <button
                onClick={() => {
                  setActiveStitchType('cross-tlbr');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'cross-tlbr'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Cross Line (Top-Left to Bottom-Right)"
              >
                <CrossTLBRIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setActiveStitchType('cross-trbl');
                  setShowStitchTypePopup(false);
                }}
                className={`flex items-center justify-center p-2 rounded border ${
                  activeStitchType === 'cross-trbl'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title="Cross Line (Top-Right to Bottom-Left)"
              >
                <CrossTRBLIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Contextual help text based on hovered section */}
            <div className="h-10 overflow-hidden">
              <p className="text-xs text-gray-500">
                {hoveredStitchSection === 'basic' && 'Fills entire cell.'}
                {hoveredStitchSection === 'circle-positional' && 'Place on any one of nine cell areas.'}
                {hoveredStitchSection === 'half-square' && 'Only one partial-square per cell. Different types overwrite each other.'}
                {hoveredStitchSection === 'quarter' && 'Quarter squares fill one corner. Only one partial-square per cell.'}
                {hoveredStitchSection === 'border' && 'Multiple borders can be added per cell (top, bottom, left, right).'}
                {hoveredStitchSection === 'cross' && 'Cross lines can stack - both diagonals can be placed in the same cell.'}
                {!hoveredStitchSection && '\u00A0'}
              </p>
            </div>
          </div>
        )}
    </div>
  );
}
