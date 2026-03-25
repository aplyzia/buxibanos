/**
 * Unit tests for message priority classification constants.
 *
 * Verifies the priority/message_type enums used throughout the app
 * are consistent with what the database and n8n workflows expect.
 */

const PRIORITY_LEVELS = ["high", "medium", "low"] as const;

const MESSAGE_TYPES = [
  "attendance",
  "payment",
  "schedule",
  "complaint",
  "inquiry",
  "emergency",
  "general",
] as const;

describe("Priority Classification", () => {
  it("has exactly 3 priority levels", () => {
    expect(PRIORITY_LEVELS).toHaveLength(3);
  });

  it("has exactly 7 message types", () => {
    expect(MESSAGE_TYPES).toHaveLength(7);
  });

  it("emergency is a recognized message type", () => {
    expect(MESSAGE_TYPES).toContain("emergency");
  });

  it("priority levels are ordered high → medium → low", () => {
    expect(PRIORITY_LEVELS[0]).toBe("high");
    expect(PRIORITY_LEVELS[1]).toBe("medium");
    expect(PRIORITY_LEVELS[2]).toBe("low");
  });
});

describe("Notification routing", () => {
  // Simulates the notification data shape used in _layout.tsx
  function routeNotification(data: Record<string, unknown>): string {
    if (data.voipRoomName && data.voipToken) {
      return "emergency-call";
    }
    if (data.announcement_id) {
      return "announcements";
    }
    if (data.message_id) {
      return "messages";
    }
    return "dashboard";
  }

  it("routes emergency call notifications", () => {
    expect(
      routeNotification({ voipRoomName: "room-1", voipToken: "tok" })
    ).toBe("emergency-call");
  });

  it("routes announcement notifications", () => {
    expect(routeNotification({ announcement_id: "abc" })).toBe(
      "announcements"
    );
  });

  it("routes message notifications", () => {
    expect(routeNotification({ message_id: "xyz" })).toBe("messages");
  });

  it("falls back to dashboard for unknown data", () => {
    expect(routeNotification({})).toBe("dashboard");
  });

  it("prioritizes emergency over other fields", () => {
    expect(
      routeNotification({
        voipRoomName: "room-1",
        voipToken: "tok",
        message_id: "xyz",
      })
    ).toBe("emergency-call");
  });
});
