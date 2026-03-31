type CacheEntry<T> = {
  expiresAt: number
  value: T
}

const routeQueryCache = new Map<string, CacheEntry<unknown>>()

function buildCompositeKey(namespace: string, key: string): string {
  return `${namespace}::${key}`
}

function pruneExpired(now = Date.now()): void {
  for (const [k, v] of routeQueryCache.entries()) {
    if (v.expiresAt <= now) routeQueryCache.delete(k)
  }
}

export function getRouteCacheTtlMs(defaultMs = 15000): number {
  const sec = Number(process.env.ROUTE_QUERY_CACHE_TTL_SECONDS ?? '')
  if (Number.isFinite(sec) && sec > 0) return Math.floor(sec * 1000)
  return defaultMs
}

export async function getCachedQueryResult<T>(
  namespace: string,
  key: string,
  compute: () => Promise<T>,
  ttlMs = getRouteCacheTtlMs()
): Promise<T> {
  const now = Date.now()
  const fullKey = buildCompositeKey(namespace, key)
  const hit = routeQueryCache.get(fullKey) as CacheEntry<T> | undefined
  if (hit && hit.expiresAt > now) return hit.value

  pruneExpired(now)
  const value = await compute()
  routeQueryCache.set(fullKey, {
    expiresAt: now + Math.max(1000, ttlMs),
    value,
  })
  return value
}
