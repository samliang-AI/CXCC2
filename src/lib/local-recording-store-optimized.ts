/**
 * 本地录音存储优化版本
 * 支持按日期分文件存储，提升性能
 * 
 * 文件命名规则:
 * - qms_recording_list_YYYY-MM-DD.json (按日期存储)
 * - qms_recording_list.json (兼容旧版，自动迁移)
 */

import { mkdir, readFile, rename, stat, writeFile, readdir } from 'fs/promises'
import path from 'path'

export type LocalRecordingRow = {
  uuid: string
  company_id: number | null
  project_id: number | null
  task_id: number | null
  agent: string | null
  agent_name: string | null
  calling_phone: string | null
  called_phone: string | null
  start_time: string | null
  end_time: string | null
  answer_duration: number | null
  play_url: string | null
  status: number | null
  status_name: string | null
  quality_status: number | null
  sync_time: string
  updated_at: string
}

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_FILE = path.join(DATA_DIR, 'qms_recording_list_2026-03-22.json')

let recordingWriteQueue: Promise<void> = Promise.resolve()
const jsonReadCache = new Map<
  string,
  {
    mtimeMs: number
    size: number
    rows: unknown[]
    lastAccess: number
  }
>()

// 缓存清理间隔（10分钟）
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000

// 缓存最大条目数
const MAX_CACHE_ENTRIES = 50

// 启动缓存清理定时器
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

/**
 * 从录音时间提取日期部分 (YYYY-MM-DD)
 */
function extractDateFromStartTime(startTime: string | null): string | null {
  if (!startTime) return null
  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 获取指定日期的文件路径
 */
function getRecordingFilePath(date: string | null): string {
  if (!date) {
    return RECORDING_FILE
  }
  return path.join(DATA_DIR, `qms_recording_list_${date}.json`)
}

/**
 * 获取所有录音文件列表
 */
async function getAllRecordingFiles(): Promise<string[]> {
  try {
    const files = await readdir(DATA_DIR)
    return files
      .filter(f => f.startsWith('qms_recording_list_') && f.endsWith('.json'))
      .map(f => path.join(DATA_DIR, f))
      .sort()
      .reverse() // 最新的在前
  } catch {
    return []
  }
}

async function ensureDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJsonArray<T>(filePath: string, strict = false): Promise<T[]> {
  const maxRetries = strict ? 5 : 2
  let lastError: unknown = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fileStat = await stat(filePath)
      const cached = jsonReadCache.get(filePath)
      
      if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
        // 更新最后访问时间
        cached.lastAccess = Date.now()
        return cached.rows as T[]
      }
      
      const raw = await readFile(filePath, 'utf-8')
      if (!raw.trim()) return []
      
      const { rows } = parseJsonArraySafely<T>(raw)
      
      jsonReadCache.set(filePath, {
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
        rows: rows as unknown[],
        lastAccess: Date.now()
      })
      
      return rows
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        jsonReadCache.delete(filePath)
        return []
      }
      
      lastError = error
      await sleep(50)
    }
  }
  
  if (strict) {
    throw lastError instanceof Error ? lastError : new Error('读取本地 JSON 失败')
  }
  return []
}

async function writeJsonArray<T>(filePath: string, rows: T[]): Promise<void> {
  await ensureDir()
  const tmpPath = `${filePath}.tmp`
  await writeFile(tmpPath, JSON.stringify(rows, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
  jsonReadCache.delete(filePath)
}

async function withQueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = recordingWriteQueue.then(fn, fn)
  const cleanup = task.then(
    () => undefined,
    () => undefined
  )
  recordingWriteQueue = cleanup
  return task
}

/**
 * 按日期分组录音数据
 */
function groupByDate(rows: LocalRecordingRow[]): Map<string, LocalRecordingRow[]> {
  const grouped = new Map<string, LocalRecordingRow[]>()
  
  for (const row of rows) {
    const date = extractDateFromStartTime(row.start_time)
    if (!date) continue
    
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(row)
  }
  
  return grouped
}

/**
 * 从所有文件中读取录音数据
 * 支持日期范围过滤
 */
export async function readAllLocalRecordings(options?: {
  startDate?: string
  endDate?: string
  batchSize?: number
}): Promise<{ rows: LocalRecordingRow[]; files: string[] }> {
  const { startDate, endDate, batchSize = 10000 } = options || {}
  const loadedFiles: string[] = []
  
  // 如果有日期范围，只读取相关文件
  if (startDate || endDate) {
    const allRows: LocalRecordingRow[] = []
    
    // 生成日期范围内的所有日期
    const datesInRange: string[] = []
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const current = new Date(start)
      
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0]
        datesInRange.push(dateStr)
        current.setDate(current.getDate() + 1)
      }
    } else if (startDate) {
      // 只有开始日期，只处理当天
      datesInRange.push(startDate)
    } else if (endDate) {
      // 只有结束日期，只处理当天
      datesInRange.push(endDate)
    }
    
    // 检查每个日期的文件是否存在，不存在则创建空白文件
    for (const date of datesInRange) {
      const filePath = getRecordingFilePath(date)
      try {
        await stat(filePath)
        // 文件存在，读取数据
        loadedFiles.push(filePath)
        const rows = await readJsonArray<LocalRecordingRow>(filePath, false)
        // 分批处理，避免一次性加载过多数据
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          allRows.push(...batch)
          // 释放内存
          batch.length = 0
        }
      } catch {
        // 文件不存在，创建空白文件
        await writeJsonArray(filePath, [])
        loadedFiles.push(filePath)
        // 空白文件，无需读取数据
      }
    }
    
    // 排序时使用稳定的比较函数
    const sortedRows = allRows.sort((a, b) => {
      const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
      const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
      return t2 - t1
    })
    
    return { rows: sortedRows, files: loadedFiles }
  }
  
  // 无日期范围，读取所有文件
  const files = await getAllRecordingFiles()
  const allRows: LocalRecordingRow[] = []
  
  for (const file of files) {
    loadedFiles.push(file)
    const rows = await readJsonArray<LocalRecordingRow>(file, false)
    // 分批处理，避免一次性加载过多数据
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      allRows.push(...batch)
      // 释放内存
      batch.length = 0
    }
  }
  
  // 兼容旧版：读取旧文件
  try {
    const oldRows = await readJsonArray<LocalRecordingRow>(RECORDING_FILE, false)
    // 分批处理，避免一次性加载过多数据
    for (let i = 0; i < oldRows.length; i += batchSize) {
      const batch = oldRows.slice(i, i + batchSize)
      allRows.push(...batch)
      // 释放内存
      batch.length = 0
    }
  } catch {
    // 忽略旧文件不存在的错误
  }
  
  // 排序时使用稳定的比较函数
  const sortedRows = allRows.sort((a, b) => {
    const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
    const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
    return t2 - t1
  })
  
  return { rows: sortedRows, files: loadedFiles }
}

/**
 * 读取指定日期范围的录音清单数据
 */
export async function readLocalRecordingsByDateRange(options?: {
  startDate?: string
  endDate?: string
  batchSize?: number
}): Promise<LocalRecordingRow[]> {
  const { startDate, endDate, batchSize = 10000 } = options || {}
  const files = await getAllRecordingFiles()
  const allRows: LocalRecordingRow[] = []

  // 生成日期范围内的所有日期
  const datesInRange: string[] = []
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const current = new Date(start)
    
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0]
      datesInRange.push(dateStr)
      current.setDate(current.getDate() + 1)
    }
  }

  // 检查每个日期的文件是否存在，不存在则创建空白文件
  for (const date of datesInRange) {
    const filePath = getRecordingFilePath(date)
    try {
      await stat(filePath)
      // 文件存在，读取数据
      const rows = await readJsonArray<LocalRecordingRow>(filePath, false)
      // 分批处理，避免一次性加载过多数据
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        allRows.push(...batch)
        // 释放内存
        batch.length = 0
      }
    } catch {
      // 文件不存在，创建空白文件
      await writeJsonArray(filePath, [])
      // 空白文件，无需读取数据
    }
  }
  
  // 兼容旧版：读取旧文件（如果日期范围包含旧文件）
  if (!startDate && !endDate) {
    try {
      const oldRows = await readJsonArray<LocalRecordingRow>(RECORDING_FILE, false)
      // 分批处理，避免一次性加载过多数据
      for (let i = 0; i < oldRows.length; i += batchSize) {
        const batch = oldRows.slice(i, i + batchSize)
        allRows.push(...batch)
        // 释放内存
        batch.length = 0
      }
    } catch {
      // 忽略旧文件不存在的错误
    }
  }
  
  // 排序时使用稳定的比较函数
  return allRows.sort((a, b) => {
    const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
    const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
    return t2 - t1
  })
}

/**
 * 按日期分文件存储录音数据
 */
export async function upsertLocalRecordings(
  rows: LocalRecordingRow[],
  options?: { batchSize?: number, writeBatchSize?: number }
): Promise<number> {
  return withQueue(async () => {
    const batchSize = options?.batchSize ?? Number(process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE || '10000')
    const safeBatchSize = Math.max(1000, Math.min(50000, batchSize))
    const writeBatchSize = options?.writeBatchSize ?? 50000
    
    // 按日期分组
    const grouped = groupByDate(rows)
    
    let totalUpserted = 0
    
    // 并行写入不同日期的文件
    const writePromises = Array.from(grouped.entries()).map(async ([date, dateRows]) => {
      const filePath = getRecordingFilePath(date)
      
      // 读取现有数据
      const existing = await readJsonArray<LocalRecordingRow>(filePath, false)
      const byUuid = new Map<string, LocalRecordingRow>()
      
      // 建立现有数据的索引
      for (const row of existing) {
        if (row.uuid) {
          byUuid.set(row.uuid, row)
        }
      }
      
      // 分批合并新数据，避免一次性处理过多数据
      for (let i = 0; i < dateRows.length; i += safeBatchSize) {
        const batch = dateRows.slice(i, i + safeBatchSize)
        for (const row of batch) {
          byUuid.set(row.uuid, row)
        }
        // 释放内存
        batch.length = 0
      }
      
      // 按时间排序
      const merged = Array.from(byUuid.values()).sort((a, b) => {
        const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
        const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
        return t2 - t1
      })
      
      // 写入完整数据
      await writeJsonArray(filePath, merged)
      
      return dateRows.length
    })
    
    const results = await Promise.all(writePromises)
    totalUpserted = results.reduce((sum, n) => sum + n, 0)
    
    return totalUpserted
  })
}

/**
 * 迁移旧版数据到按日期分文件
 */
export async function migrateOldRecordingData(): Promise<{
  migrated: boolean
  fileCount: number
  totalRows: number
}> {
  try {
    const oldRows = await readJsonArray<LocalRecordingRow>(RECORDING_FILE, false)
    
    if (oldRows.length === 0) {
      return { migrated: false, fileCount: 0, totalRows: 0 }
    }
    
    // 按日期分组并写入新文件
    await upsertLocalRecordings(oldRows)
    
    // 备份旧文件
    const backupPath = `${RECORDING_FILE}.backup.${Date.now()}`
    await rename(RECORDING_FILE, backupPath)
    
    const grouped = groupByDate(oldRows)
    
    return {
      migrated: true,
      fileCount: grouped.size,
      totalRows: oldRows.length,
    }
  } catch (error) {
    console.error('Migration failed:', error)
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
}

/**
 * 清理指定日期之前的录音文件
 */
export async function cleanupOldRecordings(beforeDate: string): Promise<{
  deletedFiles: number
  deletedRows: number
}> {
  const files = await getAllRecordingFiles()
  let deletedFiles = 0
  let deletedRows = 0
  
  for (const file of files) {
    const match = file.match(/qms_recording_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const fileDate = match[1]
    
    if (fileDate < beforeDate) {
      const rows = await readJsonArray<LocalRecordingRow>(file, false)
      deletedRows += rows.length
      
      // 删除文件
      const fs = await import('fs/promises')
      await fs.unlink(file)
      
      jsonReadCache.delete(file)
      deletedFiles++
    }
  }
  
  return { deletedFiles, deletedRows }
}

/**
 * 获取存储统计信息
 */
export async function getRecordingStorageStats(): Promise<{
  totalFiles: number
  totalRows: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
  fileSize: number
}> {
  const files = await getAllRecordingFiles()
  let totalRows = 0
  let totalSize = 0
  let earliest: string | null = null
  let latest: string | null = null
  
  for (const file of files) {
    const match = file.match(/qms_recording_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue
    
    const fileDate = match[1]
    
    if (!earliest || fileDate < earliest) earliest = fileDate
    if (!latest || fileDate > latest) latest = fileDate
    
    try {
      const fileStat = await stat(file)
      totalSize += fileStat.size
      
      const rows = await readJsonArray<LocalRecordingRow>(file, false)
      totalRows += rows.length
    } catch {
      // 忽略读取失败的文件
    }
  }
  
  return {
    totalFiles: files.length,
    totalRows,
    dateRange: { earliest, latest },
    fileSize: totalSize,
  }
}

// Helper functions (需要补充完整)
function parseJsonArraySafely<T>(raw: string): { rows: T[]; recovered: boolean } {
  const text = raw.trim()
  if (!text) return { rows: [], recovered: false }
  
  try {
    const parsed = JSON.parse(text)
    return { rows: Array.isArray(parsed) ? (parsed as T[]) : [], recovered: false }
  } catch {
    // 简化处理，实际应该实现 extractFirstJsonSegment
    return { rows: [], recovered: false }
  }
}
