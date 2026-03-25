/**
 * Unit tests for subscription tier gating logic.
 *
 * Extracted from useTierGate hook — tests the pure comparison logic
 * without React rendering.
 */

type SubscriptionTier = "starter" | "standard" | "premium";

const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  standard: 1,
  premium: 2,
};

function checkTierGate(
  currentTier: SubscriptionTier | null,
  minTier: SubscriptionTier
): boolean {
  if (!currentTier) return false;
  return TIER_ORDER[currentTier] >= TIER_ORDER[minTier];
}

describe("Tier Gate", () => {
  it("denies access when tier is null (not loaded)", () => {
    expect(checkTierGate(null, "starter")).toBe(false);
  });

  it("allows starter to access starter features", () => {
    expect(checkTierGate("starter", "starter")).toBe(true);
  });

  it("denies starter access to standard features", () => {
    expect(checkTierGate("starter", "standard")).toBe(false);
  });

  it("denies starter access to premium features", () => {
    expect(checkTierGate("starter", "premium")).toBe(false);
  });

  it("allows standard to access starter features", () => {
    expect(checkTierGate("standard", "starter")).toBe(true);
  });

  it("allows standard to access standard features", () => {
    expect(checkTierGate("standard", "standard")).toBe(true);
  });

  it("denies standard access to premium features", () => {
    expect(checkTierGate("standard", "premium")).toBe(false);
  });

  it("allows premium to access all tiers", () => {
    expect(checkTierGate("premium", "starter")).toBe(true);
    expect(checkTierGate("premium", "standard")).toBe(true);
    expect(checkTierGate("premium", "premium")).toBe(true);
  });
});
