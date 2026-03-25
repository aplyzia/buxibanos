/**
 * Unit tests for messages store derived counts and filtering logic.
 *
 * Extracted from useMessagesStore — tests the pure deriveCountsAndFilter
 * function without Zustand or Supabase.
 */

interface MockMessage {
  id: string;
  priority: "high" | "medium" | "low";
  staff_responded: boolean;
  action_required: boolean;
}

type PriorityFilter = "all" | "high" | "medium" | "low";

function deriveCountsAndFilter(messages: MockMessage[], filter: PriorityFilter) {
  const unresponded = messages.filter((m) => !m.staff_responded);
  const highPriorityCount = unresponded.filter(
    (m) => m.priority === "high"
  ).length;
  const actionRequiredCount = unresponded.filter(
    (m) => m.action_required
  ).length;

  const filtered =
    filter === "all"
      ? messages
      : messages.filter((m) => m.priority === filter);

  return { filteredMessages: filtered, highPriorityCount, actionRequiredCount };
}

const MESSAGES: MockMessage[] = [
  { id: "1", priority: "high", staff_responded: false, action_required: true },
  { id: "2", priority: "high", staff_responded: true, action_required: false },
  { id: "3", priority: "medium", staff_responded: false, action_required: true },
  { id: "4", priority: "medium", staff_responded: false, action_required: false },
  { id: "5", priority: "low", staff_responded: false, action_required: false },
  { id: "6", priority: "low", staff_responded: true, action_required: false },
];

describe("deriveCountsAndFilter", () => {
  it("counts only unresponded high-priority messages", () => {
    const result = deriveCountsAndFilter(MESSAGES, "all");
    // id:1 is high+unresponded, id:2 is high but responded
    expect(result.highPriorityCount).toBe(1);
  });

  it("counts action_required only for unresponded messages", () => {
    const result = deriveCountsAndFilter(MESSAGES, "all");
    // id:1 and id:3 are unresponded+action_required
    expect(result.actionRequiredCount).toBe(2);
  });

  it("returns all messages when filter is 'all'", () => {
    const result = deriveCountsAndFilter(MESSAGES, "all");
    expect(result.filteredMessages).toHaveLength(6);
  });

  it("filters to only high priority messages", () => {
    const result = deriveCountsAndFilter(MESSAGES, "high");
    expect(result.filteredMessages).toHaveLength(2);
    expect(result.filteredMessages.every((m) => m.priority === "high")).toBe(true);
  });

  it("filters to only medium priority messages", () => {
    const result = deriveCountsAndFilter(MESSAGES, "medium");
    expect(result.filteredMessages).toHaveLength(2);
  });

  it("filters to only low priority messages", () => {
    const result = deriveCountsAndFilter(MESSAGES, "low");
    expect(result.filteredMessages).toHaveLength(2);
  });

  it("returns zero counts for empty message list", () => {
    const result = deriveCountsAndFilter([], "all");
    expect(result.highPriorityCount).toBe(0);
    expect(result.actionRequiredCount).toBe(0);
    expect(result.filteredMessages).toHaveLength(0);
  });

  it("counts are independent of filter selection", () => {
    const allResult = deriveCountsAndFilter(MESSAGES, "all");
    const highResult = deriveCountsAndFilter(MESSAGES, "high");
    const lowResult = deriveCountsAndFilter(MESSAGES, "low");

    // Counts should be the same regardless of filter
    expect(allResult.highPriorityCount).toBe(highResult.highPriorityCount);
    expect(allResult.actionRequiredCount).toBe(lowResult.actionRequiredCount);
  });
});
