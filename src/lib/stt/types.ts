export type SttState = "idle" | "connecting" | "listening" | "transcribing";

export interface SttCallbacks {
  onPartialResult: (text: string) => void;
  onFinalResult: (text: string) => void;
  onError: (error: string) => void;
  onStateChange: (state: SttState) => void;
  onAudioLevel?: (level: number) => void;
}

export interface SttEngine {
  start(callbacks: SttCallbacks): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  isSupported(): boolean;
}
