/**
 * Platform-adaptive STT facade.
 *
 * Web:    Real-time WebSocket streaming (partial + final results as you speak)
 * Mobile: expo-audio recording → Soniox batch API (final result after stop)
 *
 * Preserves the same API surface as the old soniox-stt.ts module.
 */

import { Platform } from "react-native";
import type { SttCallbacks, SttState, SttEngine } from "./types";

export type { SttCallbacks, SttState };

let engine: SttEngine | null = null;

async function getEngine(): Promise<SttEngine> {
  if (engine) return engine;

  console.log("[STT] Loading engine for platform:", Platform.OS);

  if (Platform.OS === "web") {
    const mod = await import("./web-engine");
    console.log("[STT] Web engine module loaded:", !!mod.WebSttEngine);
    engine = new mod.WebSttEngine();
  } else {
    const mod = await import("./mobile-engine");
    console.log("[STT] Mobile engine module loaded:", !!mod.MobileSttEngine);
    engine = new mod.MobileSttEngine();
  }

  return engine;
}

export function isSttSupported(): boolean {
  if (Platform.OS === "web") {
    return (
      typeof window !== "undefined" &&
      !!navigator?.mediaDevices?.getUserMedia
    );
  }
  // Mobile: expo-audio available on iOS and Android
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function startSTT(callbacks: SttCallbacks): Promise<void> {
  const e = await getEngine();
  return e.start(callbacks);
}

export async function stopSTT(): Promise<void> {
  const e = await getEngine();
  return e.stop();
}

export function isSTTActive(): boolean {
  return engine?.isActive() ?? false;
}
