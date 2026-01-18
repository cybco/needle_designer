import { open } from '@tauri-apps/plugin-shell';

// Detect iOS/iPadOS where shell plugin doesn't work
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Opens a URL in the default browser.
 * Uses Tauri shell plugin on desktop, falls back to window.open on iOS.
 */
export async function openUrl(url: string): Promise<void> {
  if (isIOS) {
    // iOS doesn't support shell plugin, use window.open
    window.open(url, '_blank');
  } else {
    // Desktop (macOS, Windows, Linux) - use Tauri shell plugin
    await open(url);
  }
}
