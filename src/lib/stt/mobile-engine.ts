/**
 * Mobile STT engine — expo-audio recording + Soniox batch REST API.
 *
 * Records audio using expo-audio (M4A/AAC format, works on both iOS and Android),
 * then uploads to Soniox batch API for transcription.
 *
 * Audio level visualization comes from expo-audio's metering (dBFS).
 */

import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { createRecordingOptions } from "expo-audio/build/utils/options";
import type { SttEngine, SttCallbacks } from "./types";
import { transcribeAudioFile } from "./soniox-batch";

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
  numberOfChannels: 1,
};

/** Convert dBFS metering (-160..0) to linear level (0..1). */
function dbToLinear(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

export class MobileSttEngine implements SttEngine {
  private recorder: any = null;
  private callbacks: SttCallbacks | null = null;
  private active = false;
  private statusSubscription: { remove: () => void } | null = null;

  isSupported(): boolean {
    return true; // expo-audio works on iOS and Android
  }

  isActive(): boolean {
    return this.active;
  }

  async start(callbacks: SttCallbacks): Promise<void> {
    this.callbacks = callbacks;

    // Clean up any previous session
    if (this.recorder) {
      try {
        await this.recorder.stop();
      } catch {
        /* ok */
      }
      this.recorder = null;
    }
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }

    try {
      // Request mic permission
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        callbacks.onError("micPermissionDenied");
        callbacks.onStateChange("idle");
        return;
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Create recorder imperatively (matches useAudioRecorder hook internals)
      const platformOptions = createRecordingOptions(RECORDING_OPTIONS);
      const recorder = new AudioModule.AudioRecorder(platformOptions);

      // Add status listener for metering
      this.statusSubscription = recorder.addListener(
        "recordingStatusUpdate",
        (status: any) => {
          if (
            status.isRecording &&
            status.metering !== undefined &&
            callbacks.onAudioLevel
          ) {
            callbacks.onAudioLevel(dbToLinear(status.metering));
          }
        }
      );

      await recorder.prepareToRecordAsync();
      recorder.record();

      this.recorder = recorder;
      this.active = true;
      callbacks.onStateChange("listening");
    } catch (err) {
      this.active = false;
      callbacks.onError(
        err instanceof Error ? err.message : "Failed to start recording"
      );
      callbacks.onStateChange("idle");
    }
  }

  async stop(): Promise<void> {
    if (!this.recorder || !this.callbacks) {
      this.active = false;
      return;
    }

    const callbacks = this.callbacks;
    const recorder = this.recorder;
    this.active = false;
    this.recorder = null;

    // Clean up status listener
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }

    callbacks.onStateChange("transcribing");
    callbacks.onAudioLevel?.(0);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.getStatus().url;
      if (!uri) {
        throw new Error("No recording file produced");
      }

      // Transcribe via Soniox batch API
      const transcript = await transcribeAudioFile(uri);

      if (transcript.trim()) {
        callbacks.onFinalResult(transcript.trim());
      } else {
        callbacks.onError("No speech detected");
      }
    } catch (err) {
      console.warn("STT transcription error:", err);
      callbacks.onError(
        err instanceof Error ? err.message : "Transcription failed"
      );
    } finally {
      callbacks.onStateChange("idle");
    }
  }
}
