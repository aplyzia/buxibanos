import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  Send,
  Plus,
  Mic,
  MicOff,
  Image as ImageIcon,
  Camera,
  X,
  Square,
  FileText,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

// expo-audio is mobile-only; conditionally require to avoid web breakage
let AudioModule: any;
let RecordingPresets: any;
let setAudioModeAsync: any;
let requestRecordingPermissionsAsync: any;
let createRecordingOptions: any;
if (Platform.OS !== "web") {
  const expoAudio = require("expo-audio");
  AudioModule = expoAudio.AudioModule;
  RecordingPresets = expoAudio.RecordingPresets;
  setAudioModeAsync = expoAudio.setAudioModeAsync;
  requestRecordingPermissionsAsync = expoAudio.requestRecordingPermissionsAsync;
  createRecordingOptions = require("expo-audio/build/utils/options").createRecordingOptions;
}
import { startSTT, stopSTT, isSttSupported, isSTTActive } from "@/lib/stt";
import type { SttState } from "@/lib/stt";
import { polishTranscription } from "@/lib/polish-text";
import StickerPicker from "./sticker-picker";
import SttVersionPicker from "./stt-version-picker";
import { useTheme } from "@/theme";
import type { ChannelMessage } from "@/types/database";

interface ChatInputBarProps {
  onSendText: (text: string) => Promise<void>;
  onSendImage: (uri: string) => Promise<void>;
  onSendSticker: (sticker: string) => Promise<void>;
  onSendVoice: (uri: string, durationMs: number, mimeType: string) => Promise<void>;
  onSendDocument?: (uri: string, fileName: string, mimeType: string) => Promise<void>;
  isSending: boolean;
  replyingTo?: { message: ChannelMessage; senderName: string } | null;
  onCancelReply?: () => void;
}

const NUM_BARS = 12;
const BAR_MIN = 3;
const BAR_MAX = 28;

export default function ChatInputBar({
  onSendText,
  onSendImage,
  onSendSticker,
  onSendVoice,
  onSendDocument,
  isSending,
  replyingTo,
  onCancelReply,
}: ChatInputBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [sttState, setSttState] = useState<SttState>("idle");
  const [sttPartial, setSttPartial] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice recording refs — platform-adaptive
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const expoRecordingRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Voice Activity Detection (auto-stop after no transcription activity)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechDetectedRef = useRef(false);
  const SILENCE_TIMEOUT_MS = 3000; // 3s of no transcription → auto-stop

  // Audio level visualization
  const [audioLevel, setAudioLevel] = useState(0);
  const barAnims = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(BAR_MIN))
  ).current;

  // Version picker state
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [sttRawResult, setSttRawResult] = useState("");
  const [sttPolishedResult, setSttPolishedResult] = useState<string | null>(null);

  // Track the text that was in the box before STT started
  const preSTTTextRef = useRef("");
  // Track accumulated final results from STT
  const sttAccumulatedRef = useRef("");

  const isListening = sttState === "listening" || sttState === "connecting";
  const isTranscribing = sttState === "transcribing";
  const prevSttStateRef = useRef<SttState>("idle");

  // Animate bars based on audio level
  useEffect(() => {
    if (sttState !== "listening") {
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: BAR_MIN,
          duration: 150,
          useNativeDriver: false,
        }).start();
      });
      return;
    }

    barAnims.forEach((anim, i) => {
      const center = (NUM_BARS - 1) / 2;
      const distFromCenter = Math.abs(i - center) / center;
      const envelope = 1 - distFromCenter * 0.5;
      const jitter = 0.7 + Math.random() * 0.6;
      const target = Math.max(BAR_MIN, audioLevel * BAR_MAX * envelope * jitter);
      Animated.timing(anim, {
        toValue: target,
        duration: 60,
        useNativeDriver: false,
      }).start();
    });
  }, [audioLevel, sttState]);

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Commit STT results: put text in input, show version picker, start polish
  const commitSttResults = useCallback(() => {
    const accumulated = sttAccumulatedRef.current;
    const remaining = sttPartial;
    const fullRaw = (accumulated + (remaining ? " " + remaining : "")).trim();
    setSttPartial("");

    if (fullRaw) {
      const pre = preSTTTextRef.current;
      const finalText = pre ? pre + " " + fullRaw : fullRaw;
      setText(finalText);

      setSttRawResult(fullRaw);
      setSttPolishedResult(null);
      setShowVersionPicker(true);

      polishTranscription(fullRaw).then((polished) => {
        setSttPolishedResult(polished);
      });
    }
  }, [sttPartial]);

  // On mobile: watch for "transcribing" → "idle" transition to commit results
  useEffect(() => {
    if (prevSttStateRef.current === "transcribing" && sttState === "idle") {
      commitSttResults();
    }
    prevSttStateRef.current = sttState;
  }, [sttState, commitSttResults]);

  // Build display text: pre-existing text + accumulated finals + current partial
  const getDisplayText = () => {
    if (!isListening) return text;
    const pre = preSTTTextRef.current;
    const accumulated = sttAccumulatedRef.current;
    const partial = sttPartial;
    const sttText = (accumulated + (partial ? " " + partial : "")).trim();
    return pre ? pre + " " + sttText : sttText;
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText("");
    setSttPartial("");
    sttAccumulatedRef.current = "";
    await onSendText(trimmed);
  };

  const toggleSTT = async () => {
    console.log("[ChatInput] toggleSTT called, sttState:", sttState);

    if (sttState === "listening" || sttState === "connecting") {
      // Stop listening — on web this is immediate, on mobile triggers "transcribing"
      await stopSTT();

      // Clean up VAD
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      speechDetectedRef.current = false;

      // On web: stopSTT sets state to idle immediately, commit results now
      // On mobile: state goes to "transcribing" then "idle" (handled by useEffect)
      if (Platform.OS === "web") {
        setSttState("idle");
        setAudioLevel(0);
        commitSttResults();
      }
      return;
    }

    // Start listening — save whatever's already in the box
    preSTTTextRef.current = text;
    setSttPartial("");
    sttAccumulatedRef.current = "";
    speechDetectedRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setShowAttachMenu(false);
    setShowStickerPicker(false);

    // Auto-stop helper — called from silence timer
    const autoStop = async () => {
      console.log("[ChatInput] VAD auto-stop triggered");
      await stopSTT();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      speechDetectedRef.current = false;
      if (Platform.OS === "web") {
        setSttState("idle");
        setAudioLevel(0);
        commitSttResults();
      }
    };

    try {
      // Helper: restart the silence timer (called on every transcription result)
      const resetSilenceTimer = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        silenceTimerRef.current = setTimeout(autoStop, SILENCE_TIMEOUT_MS);
      };

      await startSTT({
        onPartialResult: (partial) => {
          setSttPartial(partial);
          // Any transcription activity = speech is happening
          speechDetectedRef.current = true;
          resetSilenceTimer();
        },
        onFinalResult: (final_text) => {
          sttAccumulatedRef.current = sttAccumulatedRef.current
            ? sttAccumulatedRef.current + " " + final_text
            : final_text;
          setSttPartial("");
          speechDetectedRef.current = true;
          resetSilenceTimer();
        },
        onError: (err) => {
          console.warn("[ChatInput] STT error:", err);
          setSttState("idle");
          setAudioLevel(0);
        },
        onStateChange: (state) => {
          console.log("[ChatInput] STT state change:", state);
          setSttState(state);
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
      });
    } catch (err) {
      console.error("[ChatInput] startSTT threw:", err);
      setSttState("idle");
      setAudioLevel(0);
    }
  };

  const handleVersionSelect = useCallback(
    async (selected: string) => {
      // Auto-send: combine pre-existing text with selected version and send immediately
      const pre = preSTTTextRef.current;
      const finalText = (pre ? pre + " " + selected : selected).trim();
      setShowVersionPicker(false);
      setSttRawResult("");
      setSttPolishedResult(null);
      setText("");
      sttAccumulatedRef.current = "";
      preSTTTextRef.current = "";
      if (finalText) {
        await onSendText(finalText);
      }
    },
    [onSendText]
  );

  const handleVersionCancel = useCallback(() => {
    setShowVersionPicker(false);
    setSttRawResult("");
    setSttPolishedResult(null);
    // Restore to pre-STT state so mic button reappears
    setText(preSTTTextRef.current);
    sttAccumulatedRef.current = "";
    preSTTTextRef.current = "";
  }, []);

  const startVoiceRecording = async () => {
    try {
      if (Platform.OS === "web") {
        // Web: use MediaRecorder
        console.log("[Voice] Starting web voice recording...");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("[Voice] Got mic stream");

        // Pick a supported mimeType
        const mimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
          "audio/mp4",
        ];
        let chosenMime = "";
        for (const mime of mimeTypes) {
          if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
            chosenMime = mime;
            break;
          }
        }
        console.log("[Voice] Chosen mimeType:", chosenMime || "(default)");

        const recorder = chosenMime
          ? new MediaRecorder(stream, { mimeType: chosenMime })
          : new MediaRecorder(stream);

        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100);
        mediaRecorderRef.current = recorder;
        console.log("[Voice] MediaRecorder started, mimeType:", recorder.mimeType);
      } else {
        // Mobile: use expo-audio
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          console.warn("Microphone permission denied");
          return;
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        const platformOptions = createRecordingOptions({
          ...RecordingPresets.HIGH_QUALITY,
          numberOfChannels: 1,
        });
        const recorder = new AudioModule.AudioRecorder(platformOptions);
        await recorder.prepareToRecordAsync();
        recorder.record();

        expoRecordingRef.current = recorder;
      }

      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      console.warn("Microphone access denied");
    }
  };

  const stopVoiceRecording = async (send: boolean) => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }

    if (Platform.OS === "web") {
      // Web: stop MediaRecorder
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        console.log("[Voice] No active recorder to stop");
        setIsRecording(false);
        return;
      }

      const actualMime = recorder.mimeType || "audio/webm";
      console.log("[Voice] Stopping MediaRecorder, mimeType:", actualMime);

      return new Promise<void>((resolve) => {
        recorder.onstop = async () => {
          recorder.stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);

          if (send && audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: actualMime });
            const blobUrl = URL.createObjectURL(blob);
            const durationMs = recordingDuration * 1000;
            console.log("[Voice] Sending voice, blob size:", blob.size, "duration:", durationMs, "mime:", actualMime);
            await onSendVoice(blobUrl, durationMs, actualMime);
          }

          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          resolve();
        };

        recorder.stop();
      });
    } else {
      // Mobile: stop expo-audio recording
      const recorder = expoRecordingRef.current;
      if (!recorder) {
        setIsRecording(false);
        return;
      }

      try {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        setIsRecording(false);

        if (send) {
          const uri = recorder.getStatus().url;
          if (uri) {
            const durationMs = recordingDuration * 1000;
            await onSendVoice(uri, durationMs, "audio/mp4");
          }
        }
      } catch {
        setIsRecording(false);
      }

      expoRecordingRef.current = null;
    }
  };

  const pickImage = async (useCamera: boolean) => {
    setShowAttachMenu(false);

    const method = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await method({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await onSendImage(result.assets[0].uri);
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    if (!onSendDocument) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await onSendDocument(
          asset.uri,
          asset.name || "document",
          asset.mimeType || "application/octet-stream"
        );
      }
    } catch {
      console.warn("[ChatInput] Document picker failed");
    }
  };

  const handleStickerSelect = async (sticker: string) => {
    setShowStickerPicker(false);
    await onSendSticker(sticker);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const displayText = getDisplayText();
  const hasText = text.trim().length > 0 || sttPartial.length > 0 || sttAccumulatedRef.current.length > 0;

  return (
    <View>
      {/* Reply preview bar */}
      {replyingTo && (
        <View
          className="px-4 py-2 flex-row items-center"
          style={{
            backgroundColor: colors.overlayBg,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceBorder,
            borderLeftWidth: 3,
            borderLeftColor: colors.accentColor,
          }}
        >
          <View className="flex-1 mr-2">
            <Text
              className="text-xs font-semibold"
              style={{ color: colors.accentColor }}
            >
              {t("messageActions.replyingTo", { name: replyingTo.senderName })}
            </Text>
            <Text
              className="text-xs mt-0.5"
              numberOfLines={1}
              style={{ color: colors.textMuted }}
            >
              {replyingTo.message.content || "[media]"}
            </Text>
          </View>
          <Pressable
            onPress={onCancelReply}
            className="w-7 h-7 rounded-full items-center justify-center active:opacity-60"
          >
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Audio visualizer bar — shown above input when listening */}
      {isListening && (
        <View
          className="px-4 py-2 flex-row items-center gap-3"
          style={{
            backgroundColor: colors.listeningBg,
            borderTopWidth: 2,
            borderTopColor: colors.accentColor,
          }}
        >
          {/* Pulsing red dot */}
          <View className="w-2.5 h-2.5 rounded-full bg-red-500" />

          {/* Audio waveform bars */}
          {sttState === "connecting" ? (
            <ActivityIndicator size="small" color={colors.accentColor} />
          ) : (
            <View className="flex-row items-center gap-0.5 flex-1" style={{ height: 32 }}>
              {barAnims.map((anim, i) => (
                <Animated.View
                  key={i}
                  style={{
                    width: 3.5,
                    height: anim,
                    borderRadius: 2,
                    backgroundColor: colors.accentColor,
                  }}
                />
              ))}
            </View>
          )}

          <Text className="text-xs font-medium" style={{ color: colors.accentColor }}>
            {sttState === "connecting"
              ? t("common.loading")
              : t("messages.listening")}
          </Text>
        </View>
      )}

      {/* Transcribing overlay — shown after mobile recording stops */}
      {isTranscribing && (
        <View
          className="px-4 py-3 flex-row items-center gap-3"
          style={{
            backgroundColor: colors.listeningBg,
            borderTopWidth: 2,
            borderTopColor: colors.accentColor,
          }}
        >
          <ActivityIndicator size="small" color={colors.accentColor} />
          <Text className="text-sm font-medium" style={{ color: colors.accentColor }}>
            {t("messages.transcribing")}
          </Text>
        </View>
      )}

      {/* Voice recording overlay */}
      {isRecording && (
        <View
          className="px-4 py-3 flex-row items-center justify-between"
          style={{
            backgroundColor: colors.recordingBg,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceBorder,
          }}
        >
          <View className="flex-row items-center gap-2">
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }] }}
              className="w-3 h-3 rounded-full bg-red-500"
            />
            <Text className="text-sm font-medium" style={{ color: colors.errorText }}>
              {t("messages.recording")} {formatDuration(recordingDuration)}
            </Text>
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => stopVoiceRecording(false)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surfaceBg }}
            >
              <X size={16} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={() => stopVoiceRecording(true)}
              className="w-9 h-9 rounded-full bg-red-500 items-center justify-center active:bg-red-600"
            >
              <Square size={14} color={colors.textPrimary} fill={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Attachment menu */}
      {showAttachMenu && !isRecording && !isListening && (
        <View
          className="px-4 py-3 flex-row gap-6"
          style={[
            {
              backgroundColor: colors.overlayBg,
              borderTopWidth: 1,
              borderTopColor: colors.surfaceBorder,
            },
            Platform.OS === "web"
              ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any
              : {},
          ]}
        >
          <Pressable
            onPress={() => pickImage(true)}
            className="items-center gap-1 active:opacity-60"
          >
            <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.greenTintBg }}>
              <Camera size={22} color="#4ADE80" />
            </View>
            <Text className="text-xs" style={{ color: colors.textTertiary }}>{t("messages.camera")}</Text>
          </Pressable>
          <Pressable
            onPress={() => pickImage(false)}
            className="items-center gap-1 active:opacity-60"
          >
            <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.blueTintBg }}>
              <ImageIcon size={22} color={colors.iconActive} />
            </View>
            <Text className="text-xs" style={{ color: colors.textTertiary }}>{t("messages.photoLibrary")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setShowAttachMenu(false);
              setShowStickerPicker(true);
            }}
            className="items-center gap-1 active:opacity-60"
          >
            <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.yellowTintBg }}>
              <Text className="text-xl">😊</Text>
            </View>
            <Text className="text-xs" style={{ color: colors.textTertiary }}>{t("messages.stickers")}</Text>
          </Pressable>
          {onSendDocument && (
            <Pressable
              onPress={pickDocument}
              className="items-center gap-1 active:opacity-60"
            >
              <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceBg }}>
                <FileText size={22} color={colors.textSecondary} />
              </View>
              <Text className="text-xs" style={{ color: colors.textTertiary }}>{t("fileSharing.attachFile")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Sticker picker */}
      {showStickerPicker && !isRecording && !isListening && (
        <StickerPicker
          onSelect={handleStickerSelect}
          onClose={() => setShowStickerPicker(false)}
        />
      )}

      {/* Version picker — shown after STT stops */}
      {showVersionPicker && !isListening && (
        <SttVersionPicker
          rawText={sttRawResult}
          polishedText={sttPolishedResult}
          onSelect={handleVersionSelect}
          onCancel={handleVersionCancel}
        />
      )}

      {/* Input bar — always visible (except during voice recording) */}
      {!isRecording && (
        <View
          className="px-2 py-2 flex-row items-end gap-1.5"
          style={[
            {
              backgroundColor: colors.overlayBg,
              borderTopWidth: isListening ? 0 : 1,
              borderTopColor: colors.surfaceBorder,
            },
            Platform.OS === "web"
              ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" } as any
              : {},
          ]}
        >
          {/* Plus button — hidden while listening/transcribing */}
          {!isListening && !isTranscribing && (
            <Pressable
              onPress={() => {
                setShowStickerPicker(false);
                setShowAttachMenu(!showAttachMenu);
              }}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Plus
                size={22}
                color={showAttachMenu ? colors.iconActive : colors.iconDefault}
              />
            </Pressable>
          )}

          {/* Text input — shows live STT transcription */}
          <TextInput
            className="flex-1 min-h-[40px] max-h-[100px] rounded-2xl px-4 py-2 text-base"
            style={{
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: isListening ? colors.accentColor : colors.inputBorder,
              color: colors.textPrimary,
            }}
            placeholder={t("messages.replyPlaceholder")}
            placeholderTextColor={colors.placeholderColor}
            value={displayText}
            onChangeText={(val) => {
              if (!isListening) {
                setText(val);
              }
            }}
            editable={!isSending && !isListening && !isTranscribing}
            multiline
          />

          {/* Stop button — shown while listening */}
          {isListening && (
            <Pressable
              onPress={toggleSTT}
              className="w-10 h-10 rounded-full items-center justify-center bg-red-500 active:bg-red-600"
            >
              <MicOff size={18} color="#FFFFFF" />
            </Pressable>
          )}

          {/* Mic button — shown when idle with no text */}
          {!isListening && !isTranscribing && !hasText && (
            <Pressable
              onPress={toggleSTT}
              onLongPress={startVoiceRecording}
              delayLongPress={500}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            >
              <Mic size={20} color={colors.iconDefault} />
            </Pressable>
          )}

          {/* Send button — shown when idle with text */}
          {!isListening && !isTranscribing && hasText && (
            <Pressable
              onPress={handleSend}
              disabled={isSending || !text.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isSending || !text.trim()
                  ? ""
                  : "active:opacity-80"
              }`}
              style={{
                backgroundColor:
                  isSending || !text.trim()
                    ? colors.surfaceBg
                    : colors.accentBg,
              }}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Send size={18} color={!text.trim() ? colors.textMuted : colors.textPrimary} />
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
