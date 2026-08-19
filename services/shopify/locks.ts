const globalShared: any = global;
globalShared.syncLocks = globalShared.syncLocks || new Set<string>();

// Helper for async locks to prevent race conditions during concurrent execution (e.g. collection creation)
globalShared.asyncLocks = globalShared.asyncLocks || new Map<string, Promise<void>>();
export async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previousLock = globalShared.asyncLocks.get(key);
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => { releaseLock = resolve; });
  const taskPromise = (async () => {
    if (previousLock) await previousLock;
    try { return await task(); }
    finally {
      releaseLock!();
      if (globalShared.asyncLocks.get(key) === newLock) globalShared.asyncLocks.delete(key);
    }
  })();
  globalShared.asyncLocks.set(key, newLock);
  return taskPromise;
}

export function acquireSyncLock(shop: string, id: string, identifier: string): boolean {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanId = id.replace('gid://shopify/Product/', '').trim();
  const key = `${normalizedShop}:${cleanId}:${identifier}`;

  if (globalShared.syncLocks.has(key)) {
    return false;
  }
  globalShared.syncLocks.add(key);
  console.log(`[SyncLock] Acquired lock for key: ${key}`);

  setTimeout(() => {
    if (globalShared.syncLocks.has(key)) {
      globalShared.syncLocks.delete(key);
      console.log(`[SyncLock] Auto-released expired lock for key: ${key}`);
    }
  }, 45000);
  return true;
}

export function hasSyncLock(shop: string, id: string, identifier: string): boolean {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanId = id.replace('gid://shopify/Product/', '').trim();
  const key = `${normalizedShop}:${cleanId}:${identifier}`;
  return globalShared.syncLocks.has(key);
}

export function releaseSyncLock(shop: string, id: string, identifier: string) {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanId = id.replace('gid://shopify/Product/', '').trim();
  const key = `${normalizedShop}:${cleanId}:${identifier}`;
  if (globalShared.syncLocks.has(key)) {
    globalShared.syncLocks.delete(key);
    console.log(`[SyncLock] Explicitly released lock for key: ${key}`);
  }
}

// -----------------------------------------------------------------------------
// RICH 5-TUPLE INVENTORY SYNC LOCK (ECHO PREVENTION)
// (shop, inventoryItemId, expectedQuantity, opType, ttlMs = 30000)
// -----------------------------------------------------------------------------

export function acquireRichSyncLock(
  shop: string,
  inventoryItemId: string,
  expectedQuantity: number,
  opType: string = 'INVENTORY_SYNC',
  ttlMs: number = 30000
): boolean {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanItemId = inventoryItemId.replace('gid://shopify/InventoryItem/', '').trim();
  const key = `rich_sync:${normalizedShop}:${cleanItemId}:${expectedQuantity}:${opType}`;

  if (globalShared.syncLocks.has(key)) {
    return false;
  }
  globalShared.syncLocks.add(key);
  console.log(`[RichSyncLock] Acquired lock for ${key} (TTL: ${ttlMs}ms)`);

  setTimeout(() => {
    if (globalShared.syncLocks.has(key)) {
      globalShared.syncLocks.delete(key);
      console.log(`[RichSyncLock] Auto-released expired lock for ${key}`);
    }
  }, ttlMs);

  return true;
}

export function hasRichSyncLock(
  shop: string,
  inventoryItemId: string,
  expectedQuantity?: number
): boolean {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanItemId = inventoryItemId.replace('gid://shopify/InventoryItem/', '').trim();
  
  if (typeof expectedQuantity === 'number') {
    const key = `rich_sync:${normalizedShop}:${cleanItemId}:${expectedQuantity}:INVENTORY_SYNC`;
    if (globalShared.syncLocks.has(key)) return true;
  }

  // Fallback prefix search if quantity is exact or general
  for (const lockKey of globalShared.syncLocks) {
    if (lockKey.startsWith(`rich_sync:${normalizedShop}:${cleanItemId}:`)) {
      return true;
    }
  }

  return false;
}

export function releaseRichSyncLock(
  shop: string,
  inventoryItemId: string,
  expectedQuantity?: number
) {
  const normalizedShop = shop.replace(/^https?:\/\//, '').trim();
  const cleanItemId = inventoryItemId.replace('gid://shopify/InventoryItem/', '').trim();

  if (typeof expectedQuantity === 'number') {
    const key = `rich_sync:${normalizedShop}:${cleanItemId}:${expectedQuantity}:INVENTORY_SYNC`;
    if (globalShared.syncLocks.has(key)) {
      globalShared.syncLocks.delete(key);
      console.log(`[RichSyncLock] Released lock for ${key}`);
    }
  } else {
    for (const lockKey of globalShared.syncLocks) {
      if (lockKey.startsWith(`rich_sync:${normalizedShop}:${cleanItemId}:`)) {
        globalShared.syncLocks.delete(lockKey);
        console.log(`[RichSyncLock] Released matching lock ${lockKey}`);
      }
    }
  }
}

