import { useAuthStore, SubscriptionTier } from "@/stores/auth-store";

const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 0,
  standard: 1,
  premium: 2,
};

/**
 * Returns { allowed: true } if the current org's subscription tier meets
 * the minimum tier required. Returns false if tier is not yet loaded.
 */
export function useTierGate(minTier: SubscriptionTier): { allowed: boolean } {
  const subscriptionTier = useAuthStore((s) => s.subscriptionTier);
  if (!subscriptionTier) return { allowed: false };
  return { allowed: TIER_ORDER[subscriptionTier] >= TIER_ORDER[minTier] };
}
