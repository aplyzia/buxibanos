import type { Message } from "@/types/database";
import type { ChannelWithPreview } from "@/stores/channels-store";

export type UnifiedInboxItem =
  | { kind: "parent"; data: Message; sortTime: number }
  | { kind: "channel"; data: ChannelWithPreview; sortTime: number };
