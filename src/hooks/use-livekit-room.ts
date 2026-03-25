/**
 * useLiveKitRoom — manages LiveKit room lifecycle for emergency calls.
 *
 * Audio-only. Gracefully degrades when native module isn't available (Expo Go).
 * All LiveKit imports are dynamic require() to avoid Expo Go crashes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { isLiveKitAvailable } from "@/lib/livekit";

export type RoomStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

interface UseLiveKitRoomOptions {
  serverUrl: string;
  token: string;
  autoConnect?: boolean;
}

interface UseLiveKitRoomReturn {
  status: RoomStatus;
  participantCount: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  error: string | null;
}

export function useLiveKitRoom(
  options: UseLiveKitRoomOptions
): UseLiveKitRoomReturn {
  const { serverUrl, token, autoConnect = true } = options;
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [participantCount, setParticipantCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<any>(null);
  const audioSessionStarted = useRef(false);

  const updateCount = useCallback((room: any) => {
    const count = 1 + (room.remoteParticipants?.size ?? 0);
    setParticipantCount(count);
  }, []);

  const connect = useCallback(async () => {
    if (!isLiveKitAvailable()) {
      setError("LiveKit not available (Expo Go)");
      return;
    }

    try {
      setStatus("connecting");
      setError(null);

      const { AudioSession } = require("@livekit/react-native");
      const { Room, RoomEvent } = require("livekit-client");

      // Start audio session (iOS + Android)
      if (!audioSessionStarted.current) {
        await AudioSession.startAudioSession();
        audioSessionStarted.current = true;
      }

      const room = new Room({
        adaptiveStream: false,
        dynacast: false,
      });

      roomRef.current = room;

      room.on(RoomEvent.Connected, () => {
        setStatus("connected");
        updateCount(room);
      });

      room.on(RoomEvent.Reconnecting, () => setStatus("reconnecting"));
      room.on(RoomEvent.Reconnected, () => setStatus("connected"));
      room.on(RoomEvent.Disconnected, () => setStatus("disconnected"));

      room.on(RoomEvent.ParticipantConnected, () => updateCount(room));
      room.on(RoomEvent.ParticipantDisconnected, () => updateCount(room));

      await room.connect(serverUrl, token, { autoSubscribe: true });
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.error("[LiveKit] Connection error:", err);
      setStatus("error");
      setError(String(err));
    }
  }, [serverUrl, token, updateCount]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setStatus("disconnected");

    if (audioSessionStarted.current && isLiveKitAvailable()) {
      try {
        const { AudioSession } = require("@livekit/react-native");
        AudioSession.stopAudioSession();
        audioSessionStarted.current = false;
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    const newMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleSpeaker = useCallback(async () => {
    if (!isLiveKitAvailable()) return;
    try {
      const { AudioSession } = require("@livekit/react-native");
      const newSpeakerOn = !isSpeakerOn;
      await AudioSession.setPreferSpeakerOutput(newSpeakerOn);
      setIsSpeakerOn(newSpeakerOn);
    } catch (err) {
      console.warn("[LiveKit] toggleSpeaker error:", err);
    }
  }, [isSpeakerOn]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && token && serverUrl) {
      connect();
    }

    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (audioSessionStarted.current && isLiveKitAvailable()) {
        try {
          const { AudioSession } = require("@livekit/react-native");
          AudioSession.stopAudioSession();
          audioSessionStarted.current = false;
        } catch {}
      }
    };
  }, []); // connect once on mount

  return {
    status,
    participantCount,
    isMuted,
    isSpeakerOn,
    connect,
    disconnect,
    toggleMute,
    toggleSpeaker,
    error,
  };
}
