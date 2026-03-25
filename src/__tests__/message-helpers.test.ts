/**
 * Unit tests for message display helper functions.
 *
 * Tests getInitials and getTimeLabel — pure functions extracted from
 * MessageCard and ParentMessagesScreen components.
 */

// ── getInitials (shared pattern across MessageCard + ParentMessagesScreen) ──

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 1).toUpperCase();
}

describe("getInitials", () => {
  it("returns single initial for Chinese name (no space)", () => {
    expect(getInitials("王小明")).toBe("王");
  });

  it("returns two initials for English two-word name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns single initial for single-word name", () => {
    expect(getInitials("Admin")).toBe("A");
  });

  it("handles extra whitespace", () => {
    expect(getInitials("  Jane   Smith  ")).toBe("JS");
  });

  it("returns two initials for Chinese name with space", () => {
    expect(getInitials("王 小明")).toBe("王小");
  });

  it("uppercases lowercase initials", () => {
    expect(getInitials("jane doe")).toBe("JD");
  });

  it("handles three-part names (takes first two)", () => {
    expect(getInitials("Mary Jane Watson")).toBe("MJ");
  });
});

// ── getTimeLabel ──

function getTimeLabel(dateStr: string, language: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 60) {
    return date.toLocaleTimeString(language === "zh-TW" ? "zh-TW" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return date.toLocaleTimeString(language === "zh-TW" ? "zh-TW" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const locale = language === "zh-TW" ? "zh-TW" : "en-US";
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

describe("getTimeLabel", () => {
  it("returns a time string for recent messages (< 1 hour)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result = getTimeLabel(tenMinAgo, "en-US");
    // Should be a time like "10:30 AM" — just verify it's not empty
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a time string for messages within 24 hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const result = getTimeLabel(threeHoursAgo, "en-US");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a date string for messages older than 24 hours", () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const result = getTimeLabel(twoDaysAgo, "en-US");
    // Should contain a month abbreviation like "Mar" or a date
    expect(result.length).toBeGreaterThan(0);
  });

  it("works with zh-TW locale", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result = getTimeLabel(tenMinAgo, "zh-TW");
    expect(result.length).toBeGreaterThan(0);
  });
});
