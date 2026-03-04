import { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Play, Pause, X, FileText, ExternalLink } from "lucide-react-native";
import { Linking } from "react-native";

interface MediaItem {
  type: "image" | "audio" | "document";
  url: string;
  duration_ms?: number;
  file_name?: string;
}

interface MediaBubbleProps {
  mediaUrls: MediaItem[];
  isSent: boolean;
}

export default function MediaBubble({ mediaUrls, isSent }: MediaBubbleProps) {
  return (
    <View className="gap-1">
      {mediaUrls.map((item, index) => {
        if (item.type === "image") {
          return <ImageBubble key={index} url={item.url} isSent={isSent} />;
        }
        if (item.type === "audio") {
          return (
            <AudioBubble
              key={index}
              url={item.url}
              durationMs={item.duration_ms ?? 0}
              isSent={isSent}
            />
          );
        }
        if (item.type === "document") {
          return (
            <DocumentBubble
              key={index}
              url={item.url}
              fileName={item.file_name}
              isSent={isSent}
            />
          );
        }
        return null;
      })}
    </View>
  );
}

/* ─── Image bubble with full-screen preview ─── */
function ImageBubble({ url, isSent }: { url: string; isSent: boolean }) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <>
      <Pressable onPress={() => setShowFullscreen(true)} className="mb-1">
        <View className="rounded-xl overflow-hidden">
          {loading && (
            <View className="absolute inset-0 items-center justify-center bg-gray-100 rounded-xl" style={{ width: 200, height: 150 }}>
              <ActivityIndicator size="small" color="#9CA3AF" />
            </View>
          )}
          <Image
            source={{ uri: url }}
            className="rounded-xl"
            style={{ width: 200, height: 150 }}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
          />
        </View>
      </Pressable>

      {/* Fullscreen modal */}
      <Modal visible={showFullscreen} transparent animationType="fade">
        <View className="flex-1 bg-black/90 items-center justify-center">
          <Pressable
            onPress={() => setShowFullscreen(false)}
            className="absolute top-14 right-4 z-10 w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>
          <Image
            source={{ uri: url }}
            style={{ width: "90%", height: "70%" }}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </>
  );
}

/* ─── Audio bubble with playback ─── */
function AudioBubble({
  url,
  durationMs,
  isSent,
}: {
  url: string;
  durationMs: number;
  isSent: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatDuration = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = async () => {
    if (Platform.OS !== "web") return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (!audioRef.current) {
      console.log("[AudioBubble] Creating audio element for URL:", url);
      const audio = new Audio(url);

      // Listen for errors
      audio.onerror = () => {
        const err = audio.error;
        console.error("[AudioBubble] Audio error:", err?.code, err?.message, "URL:", url);
      };

      audioRef.current = audio;
    }

    audioRef.current.currentTime = 0;
    setProgress(0);

    try {
      console.log("[AudioBubble] Attempting play...");
      await audioRef.current.play();
      console.log("[AudioBubble] Playing! duration:", audioRef.current.duration);
      setIsPlaying(true);

      const duration = audioRef.current.duration || durationMs / 1000;
      intervalRef.current = setInterval(() => {
        if (!audioRef.current) return;
        const pct = audioRef.current.currentTime / duration;
        setProgress(Math.min(pct, 1));
      }, 100);

      audioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } catch (err) {
      console.error("[AudioBubble] Play failed:", err, "URL:", url);
      setIsPlaying(false);
    }
  };

  return (
    <Pressable
      onPress={togglePlay}
      className={`flex-row items-center gap-2 px-3 py-2 rounded-2xl min-w-[140px] ${
        isSent ? "bg-brand-blue/80" : "bg-gray-100"
      }`}
    >
      <View
        className={`w-8 h-8 rounded-full items-center justify-center ${
          isSent ? "bg-white/20" : "bg-gray-200"
        }`}
      >
        {isPlaying ? (
          <Pause size={14} color={isSent ? "#FFFFFF" : "#374151"} />
        ) : (
          <Play size={14} color={isSent ? "#FFFFFF" : "#374151"} />
        )}
      </View>

      {/* Progress bar */}
      <View className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${isSent ? "bg-white" : "bg-gray-400"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      <Text
        className={`text-xs ${isSent ? "text-white/80" : "text-gray-500"}`}
      >
        {formatDuration(durationMs)}
      </Text>
    </Pressable>
  );
}

/* ─── Document bubble ─── */
function DocumentBubble({
  url,
  fileName,
  isSent,
}: {
  url: string;
  fileName?: string;
  isSent: boolean;
}) {
  const displayName = fileName || url.split("/").pop()?.split("?")[0] || "Document";

  const handleOpen = () => {
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <Pressable
      onPress={handleOpen}
      className={`flex-row items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[180px] mb-1 ${
        isSent ? "bg-brand-blue/80" : "bg-gray-100"
      }`}
    >
      <View
        className={`w-9 h-9 rounded-lg items-center justify-center ${
          isSent ? "bg-white/20" : "bg-gray-200"
        }`}
      >
        <FileText size={18} color={isSent ? "#FFFFFF" : "#374151"} />
      </View>
      <Text
        className={`flex-1 text-sm font-medium ${
          isSent ? "text-white" : "text-gray-800"
        }`}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      <ExternalLink size={14} color={isSent ? "#FFFFFF" : "#9CA3AF"} />
    </Pressable>
  );
}

/* ─── Sticker bubble (large centered emoji) ─── */
export function StickerBubble({ sticker }: { sticker: string }) {
  return (
    <View className="py-1">
      <Text style={{ fontSize: 48, lineHeight: 56 }}>{sticker}</Text>
    </View>
  );
}

/** Parse sticker pattern [sticker:😊] and return the emoji, or null */
export function parseStickerContent(content: string): string | null {
  const match = content.match(/^\[sticker:(.+)\]$/);
  return match ? match[1] : null;
}

/** Parse media_urls JSON field into typed MediaItem array */
export function parseMediaUrls(mediaUrls: unknown): MediaItem[] {
  if (!Array.isArray(mediaUrls)) return [];
  return mediaUrls.filter(
    (item): item is MediaItem =>
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      "url" in item &&
      (item.type === "image" || item.type === "audio" || item.type === "document")
  );
}
