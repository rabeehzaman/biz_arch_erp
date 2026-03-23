import type { SubscriptionStatus } from "@/generated/prisma/client";

export type SubscriptionState = {
  isExpired: boolean;
  isWarning: boolean;
  daysRemaining: number | null; // null = no end date set (unlimited)
  status: SubscriptionStatus;
  endDate: Date | null;
};

type SubscriptionInput = {
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndDate: Date | null;
};

/**
 * Compute the runtime subscription state for an organization.
 * - EXPIRED / SUSPENDED status → always expired regardless of dates
 * - TRIAL / ACTIVE with endDate in the past → expired
 * - Null endDate → unlimited (not expired, no warning)
 */
export function getSubscriptionState(org: SubscriptionInput): SubscriptionState {
  const { subscriptionStatus, subscriptionEndDate } = org;

  // Explicitly expired or suspended
  if (
    subscriptionStatus === "EXPIRED" ||
    subscriptionStatus === "SUSPENDED"
  ) {
    const daysRemaining = subscriptionEndDate
      ? getDaysRemaining(subscriptionEndDate)
      : 0;
    return {
      isExpired: true,
      isWarning: false,
      daysRemaining,
      status: subscriptionStatus,
      endDate: subscriptionEndDate,
    };
  }

  // TRIAL or ACTIVE — check end date
  if (!subscriptionEndDate) {
    // No end date = unlimited
    return {
      isExpired: false,
      isWarning: false,
      daysRemaining: null,
      status: subscriptionStatus,
      endDate: null,
    };
  }

  const daysRemaining = getDaysRemaining(subscriptionEndDate);

  return {
    isExpired: daysRemaining < 0,
    isWarning: daysRemaining >= 0 && daysRemaining <= 3,
    daysRemaining,
    status: subscriptionStatus,
    endDate: subscriptionEndDate,
  };
}

export function isSubscriptionExpired(org: SubscriptionInput): boolean {
  return getSubscriptionState(org).isExpired;
}

/**
 * Returns days remaining (floored). 0 = expires today, negative = expired.
 */
function getDaysRemaining(endDate: Date): number {
  const now = new Date();
  // Compare at day granularity (start of day UTC)
  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = endDay.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
