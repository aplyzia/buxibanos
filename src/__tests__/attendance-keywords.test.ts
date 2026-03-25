/**
 * Unit tests for keyword-based attendance detection.
 *
 * Extracted from detect-attendance.ts — tests the fallback keyword
 * matching for Traditional Chinese attendance messages.
 */

interface DetectionResult {
  detected: boolean;
  status: "absent" | "tardy" | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

const NO_MATCH: DetectionResult = {
  detected: false,
  status: null,
  confidence: "low",
  reasoning: "No attendance patterns detected",
};

function detectWithKeywords(content: string): DetectionResult {
  const text = content.trim();

  const absentHigh = [
    /請假/, /今天不能來/, /今天無法來/, /今天沒辦法來/,
    /不能上課/, /無法上課/, /沒辦法上課/, /不來上課/,
    /缺席/, /不能到/, /無法到/,
  ];

  const absentMedium = [
    /發燒/, /生病/, /感冒/, /不舒服/, /身體不適/,
    /拉肚子/, /看醫生/, /掛急診/, /住院/, /受傷/,
    /家裡有事/, /有事請假/, /頭痛/,
  ];

  const tardyHigh = [
    /遲到/, /會晚到/, /晚一點到/, /晚點到/, /會慢到/,
    /比較晚到/, /來不及/, /趕不上/, /晚一點去/,
  ];

  const tardyMedium = [/塞車/, /在路上/, /快到了/];

  for (const p of absentHigh) {
    if (p.test(text))
      return { detected: true, status: "absent", confidence: "high", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of tardyHigh) {
    if (p.test(text))
      return { detected: true, status: "tardy", confidence: "high", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of absentMedium) {
    if (p.test(text))
      return { detected: true, status: "absent", confidence: "medium", reasoning: `Keyword: ${p.source}` };
  }
  for (const p of tardyMedium) {
    if (p.test(text))
      return { detected: true, status: "tardy", confidence: "medium", reasoning: `Keyword: ${p.source}` };
  }

  return NO_MATCH;
}

describe("Attendance keyword detection", () => {
  describe("absent — high confidence", () => {
    it("detects 請假 (leave request)", () => {
      const result = detectWithKeywords("老師好，小明今天請假");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
      expect(result.confidence).toBe("high");
    });

    it("detects 今天不能來", () => {
      const result = detectWithKeywords("小華今天不能來上學");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
    });

    it("detects 缺席", () => {
      const result = detectWithKeywords("今天要缺席");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
      expect(result.confidence).toBe("high");
    });
  });

  describe("absent — medium confidence", () => {
    it("detects 發燒 (fever)", () => {
      const result = detectWithKeywords("小明發燒了");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
      expect(result.confidence).toBe("medium");
    });

    it("detects 生病", () => {
      const result = detectWithKeywords("孩子生病");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
      expect(result.confidence).toBe("medium");
    });

    it("detects 看醫生", () => {
      const result = detectWithKeywords("下午要去看醫生");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("absent");
      expect(result.confidence).toBe("medium");
    });
  });

  describe("tardy — high confidence", () => {
    it("detects 遲到", () => {
      const result = detectWithKeywords("今天可能會遲到");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("tardy");
      expect(result.confidence).toBe("high");
    });

    it("detects 會晚到", () => {
      const result = detectWithKeywords("小明會晚到十分鐘");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("tardy");
      expect(result.confidence).toBe("high");
    });
  });

  describe("tardy — medium confidence", () => {
    it("detects 塞車 (traffic)", () => {
      const result = detectWithKeywords("路上塞車中");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("tardy");
      expect(result.confidence).toBe("medium");
    });

    it("detects 快到了", () => {
      const result = detectWithKeywords("快到了再等一下");
      expect(result.detected).toBe(true);
      expect(result.status).toBe("tardy");
      expect(result.confidence).toBe("medium");
    });
  });

  describe("no match", () => {
    it("returns no match for unrelated message", () => {
      const result = detectWithKeywords("今天功課寫完了嗎？");
      expect(result.detected).toBe(false);
      expect(result.status).toBeNull();
    });

    it("returns no match for empty string", () => {
      const result = detectWithKeywords("");
      expect(result.detected).toBe(false);
    });

    it("returns no match for greeting", () => {
      const result = detectWithKeywords("老師早安");
      expect(result.detected).toBe(false);
    });
  });

  describe("priority ordering", () => {
    it("absent-high takes precedence over absent-medium when both match", () => {
      // "請假" (high) + "生病" (medium) — should match high first
      const result = detectWithKeywords("因為生病所以請假");
      expect(result.confidence).toBe("high");
      expect(result.status).toBe("absent");
    });
  });
});
