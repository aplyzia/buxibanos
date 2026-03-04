export const PRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const MESSAGE_TYPES = [
  "attendance",
  "payment",
  "schedule",
  "complaint",
  "inquiry",
  "emergency",
  "general",
] as const;

export const ENROLLMENT_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  WITHDRAWN: "withdrawn",
} as const;

export const TASK_SOURCE_TYPES = [
  "ai_detected",
  "manual",
  "system",
] as const;

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  TARDY: "tardy",
  EXCUSED: "excused",
} as const;

export const FEE_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  WAIVED: "waived",
} as const;

export const SCHOOL_NAME = "熊老師補習班";
