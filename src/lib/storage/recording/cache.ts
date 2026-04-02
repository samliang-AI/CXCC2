// 缓存管理模块
import { stat } from 'fs/promises'

// 缓存项类型
type CacheItem = {
  mtimeMs: number
  size: number
  rows: unknown[]
  lastAccess: number
}

// JSON读取缓存
const jsonReadCache = new Map<string, CacheItem>()

// 缓存清理间隔（10分钟）
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000

// 缓存最大条目数
const MAX_CACHE_ENTRIES = 50

// 启动缓存清理定时器
function startCacheCleanupTimer() {
  setInterval(() => {
    const now = Date.now()
    const entries = Array.from(jsonReadCache.entries())
    
    // 按最后访问时间排序，删除最旧的条目
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess)
    
    // 只保留最近使用的MAX_CACHE_ENTRIES个条目
    if (entries.length > MAX_CACHE_ENTRIES) {
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES)
      toRemove.forEach(([key]) => jsonReadCache.delete(key))
    }
  }, CACHE_CLEANUP_INTERVAL)
}

// 启动缓存清理
startCacheCleanupTimer()

/**
 * 检查缓存是否有效
 */
export async function getCachedData<T>(filePath: string): Promise<T[] | null> {
  try {
    const fileStat = await stat(filePath)
    const cached = jsonReadCache.get(filePath)
    
    if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
      // 更新最后访问时间
      cached.lastAccess = Date.now()
      return cached.rows as T[]
    }
    return null
  } catch {
    jsonReadCache.delete(filePath)
    return null
  }
}

/**
 * 设置缓存数据
 */
export async function setCachedData<T>(filePath: string, rows: T[]): Promise<void> {
  try {
    const fileStat = await stat(filePath)
    jsonReadCache.set(filePath, {
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
      rows: rows as unknown[],
      lastAccess: Date.now()
    })
  } catch {
    // 忽略错误
  }
}

/**
 * 清除缓存
 */
export function clearCache(filePath: string): void {
  jsonReadCache.delete(filePath)
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  jsonReadCache.clear()
}

/**
 * 获取缓存状态
 */
export function getCacheStatus(): {
  size: number
  maxSize: number
  entries: string[]
} {
  return {
    size: jsonReadCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    entries: Array.from(jsonReadCache.keys())
  }
}