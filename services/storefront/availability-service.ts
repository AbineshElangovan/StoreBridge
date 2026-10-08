export type AvailabilityState = 'AVAILABLE' | 'PREORDER' | 'NOTIFY_ME' | 'SOLD_OUT';

export interface ResolveAvailabilityParams {
  inventory: number;
  threshold?: number;
  preorderEnabled?: boolean;
  notifyMeEnabled?: boolean;
}

/**
 * Single source of truth for variant availability resolution across StoreBridge.
 *
 * Rules:
 * 1. IF inventory > threshold: AVAILABLE
 * 2. IF inventory <= threshold AND preorderEnabled: PREORDER
 * 3. IF inventory <= threshold AND !preorderEnabled AND notifyMeEnabled: NOTIFY_ME
 * 4. IF inventory <= threshold AND !preorderEnabled AND !notifyMeEnabled: SOLD_OUT
 */
export function resolveAvailability(params: ResolveAvailabilityParams): AvailabilityState {
  const {
    inventory,
    threshold = 0,
    preorderEnabled = false,
    notifyMeEnabled = false,
  } = params;

  if (inventory > threshold) {
    return 'AVAILABLE';
  }

  if (preorderEnabled) {
    return 'PREORDER';
  }

  if (notifyMeEnabled) {
    return 'NOTIFY_ME';
  }

  return 'SOLD_OUT';
}
