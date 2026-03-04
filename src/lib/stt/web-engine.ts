/**
 * Web STT engine — real-time WebSocket streaming to Soniox.
 *
 * Uses Web Audio API (AudioContext + ScriptProcessorNode) to capture raw PCM
 * and streams it to Soniox via WebSocket for live transcription.
 *
 * Bug fix: Uses browser's default sample rate instead of forcing 16kHz,
 * which silently fails on many systems.
 */

import type { SttEngine, SttCallbacks } from "./types";

const SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket";

/** Convert float32 audio samples to int16 PCM bytes (little-endian). */
function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

export class WebSttEngine implements SttEngine {
  private active = false;
  private cleanup: (() => void) | null = null;
  private callbacks: SttCallbacks | null = null;

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      !!navigator?.mediaDevices?.getUserMedia
    );
  }

  isActive(): boolean {
    return this.active;
  }

  async start(callbacks: SttCallbacks): Promise<void> {
    const apiKey = process.env.EXPO_PUBLIC_SONIOX_API_KEY;
    console.log("[STT-Web] start() called, apiKey exists:", !!apiKey);
    if (!apiKey) {
      callbacks.onError("Soniox API key not configured");
      return;
    }

    if (!this.isSupported()) {
      callbacks.onError("Speech-to-text is not supported on this platform");
      return;
    }

    // Clean up any previous session
    if (this.cleanup) {
      console.log("[STT-Web] Cleaning up previous session");
      this.cleanup();
      this.cleanup = null;
    }

    this.callbacks = callbacks;
    callbacks.onStateChange("connecting");
    console.log("[STT-Web] State → connecting");

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let ws: WebSocket | null = null;
    let levelFrameId: number | null = null;
    let analyser: AnalyserNode | null = null;
    let cleaned = false;

    const doCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      this.active = false;
      this.cleanup = null;

      if (levelFrameId !== null) {
        cancelAnimationFrame(levelFrameId);
        levelFrameId = null;
      }
      analyser = null;

      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }

      if (ws) {
        try {
          ws.close();
        } catch {
          /* ok */
        }
        ws = null;
      }
    };

    try {
      // 1. Get microphone — no forced sample rate (browsers ignore or fail on it)
      console.log("[STT-Web] Requesting mic access...");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      console.log("[STT-Web] Mic access granted, tracks:", stream.getAudioTracks().length);

      // 2. Create AudioContext at browser's default rate (usually 44100 or 48000)
      audioCtx = new AudioContext();
      console.log("[STT-Web] AudioContext created, state:", audioCtx.state);
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
        console.log("[STT-Web] AudioContext resumed");
      }

      const actualSampleRate = audioCtx.sampleRate;
      console.log("[STT-Web] AudioContext sample rate:", actualSampleRate);

      const source = audioCtx.createMediaStreamSource(stream);

      // 3. Audio level monitoring
      if (callbacks.onAudioLevel) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const onLevel = callbacks.onAudioLevel;

        const tickLevel = () => {
          if (!analyser || cleaned) return;
          analyser.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < freqData.length; i++) {
            const n = freqData[i] / 255;
            sum += n * n;
          }
          const rms = Math.sqrt(sum / freqData.length);
          onLevel(Math.min(1, rms * 2.5));
          levelFrameId = requestAnimationFrame(tickLevel);
        };
        levelFrameId = requestAnimationFrame(tickLevel);
      }

      // 4. ScriptProcessorNode for raw PCM capture
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const silencer = audioCtx.createGain();
      silencer.gain.value = 0;

      // 5. Connect to Soniox WebSocket
      console.log("[STT-Web] Connecting WebSocket to:", SONIOX_WS_URL);
      ws = new WebSocket(SONIOX_WS_URL);
      ws.binaryType = "arraybuffer";
      this.cleanup = doCleanup;

      ws.onopen = () => {
        console.log("[STT-Web] WebSocket connected!");
        if (cleaned) {
          ws?.close();
          return;
        }

        // Send config with actual sample rate (not hardcoded 16000)
        const config = {
          api_key: apiKey,
          model: "stt-rt-v4",
          audio_format: "pcm_s16le",
          sample_rate: actualSampleRate,
          num_channels: 1,
          language_hints: ["zh"],
        };
        console.log("[STT-Web] Sending config:", { ...config, api_key: "***" });
        ws!.send(JSON.stringify(config));

        this.active = true;
        callbacks.onStateChange("listening");
        console.log("[STT-Web] State → listening");

        let audioFrameCount = 0;
        processor.onaudioprocess = (e) => {
          if (!this.active || !ws || ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm = float32ToInt16(inputData);
          audioFrameCount++;
          if (audioFrameCount <= 3 || audioFrameCount % 50 === 0) {
            // Check if audio data has non-zero values
            let maxVal = 0;
            for (let i = 0; i < inputData.length; i++) {
              maxVal = Math.max(maxVal, Math.abs(inputData[i]));
            }
            console.log(`[STT-Web] Audio frame #${audioFrameCount}, maxAmplitude: ${maxVal.toFixed(4)}, bytes: ${pcm.byteLength}`);
          }
          ws.send(pcm);
        };

        source.connect(processor);
        processor.connect(silencer);
        silencer.connect(audioCtx!.destination);
        console.log("[STT-Web] Audio pipeline connected");
      };

      let msgCount = 0;
      ws.onmessage = (event) => {
        msgCount++;
        try {
          const data = JSON.parse(event.data);
          if (msgCount <= 5) {
            console.log(`[STT-Web] WS message #${msgCount}:`, JSON.stringify(data).substring(0, 200));
          }

          if (data.error_code || data.error_message) {
            console.error("[STT-Web] Soniox API error:", data.error_code, data.error_message);
            callbacks.onError(data.error_message || `Soniox error ${data.error_code}`);
            doCleanup();
            callbacks.onStateChange("idle");
            return;
          }

          if (data.finished) {
            console.log("[STT-Web] Received finished signal");
            return;
          }

          if (data.tokens && data.tokens.length > 0) {
            const finalTokens: string[] = [];
            const partialTokens: string[] = [];

            for (const token of data.tokens) {
              if (token.is_final) {
                finalTokens.push(token.text);
              } else {
                partialTokens.push(token.text);
              }
            }

            if (finalTokens.length > 0) {
              const text = finalTokens.join("");
              console.log("[STT-Web] Final:", text);
              callbacks.onFinalResult(text);
            }
            if (partialTokens.length > 0) {
              const text = partialTokens.join("");
              console.log("[STT-Web] Partial:", text);
              callbacks.onPartialResult(text);
            }
          } else if (data.text) {
            console.log("[STT-Web] Text result:", data.text, "is_final:", data.is_final);
            if (data.is_final) {
              callbacks.onFinalResult(data.text);
            } else {
              callbacks.onPartialResult(data.text);
            }
          }
        } catch (e) {
          console.warn("[STT-Web] Non-JSON message:", typeof event.data, event.data?.toString?.()?.substring(0, 100));
        }
      };

      ws.onerror = (evt) => {
        console.error("[STT-Web] WebSocket error:", evt);
        callbacks.onError("WebSocket connection error");
        doCleanup();
        callbacks.onStateChange("idle");
      };

      ws.onclose = (e) => {
        console.log("[STT-Web] WebSocket closed, code:", e.code, "reason:", e.reason, "active:", this.active);
        if (this.active) {
          callbacks.onStateChange("idle");
          doCleanup();
        }
      };
    } catch (err) {
      console.error("[STT-Web] start() error:", err);
      doCleanup();
      callbacks.onError(
        err instanceof Error ? err.message : "Failed to access microphone"
      );
      callbacks.onStateChange("idle");
    }
  }

  async stop(): Promise<void> {
    console.log("[STT-Web] stop() called, active:", this.active);
    this.active = false;
    if (this.cleanup) {
      const fn = this.cleanup;
      this.cleanup = null;
      fn();
    }
  }
}
