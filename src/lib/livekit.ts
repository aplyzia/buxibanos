/**
 * LiveKit SDK initialization and availability check.
 *
 * Uses dynamic require() to gracefully degrade in Expo Go
 * where native WebRTC modules are not available.
 */

let _available: boolean | null = null;

/**
 * Returns true if the LiveKit native module is loaded.
 * Safe to call anywhere — never throws.
 */
export function isLiveKitAvailable(): boolean {
  if (_available !== null) return _available;
  try {
    require("@livekit/react-native");
    _available = true;
  } catch {
    _available = false;
    console.log("[LiveKit] Native module not available (Expo Go?)");
  }
  return _available;
}

/**
 * Call once at app startup (in _layout.tsx).
 * Registers WebRTC globals needed by livekit-client.
 * No-op if native modules are not available.
 */
export function initLiveKit(): void {
  if (!isLiveKitAvailable()) return;
  try {
    const { registerGlobals } = require("@livekit/react-native");
    registerGlobals();
    console.log("[LiveKit] registerGlobals() complete");
  } catch (err) {
    console.warn("[LiveKit] registerGlobals() failed:", err);
    _available = false;
  }
}
