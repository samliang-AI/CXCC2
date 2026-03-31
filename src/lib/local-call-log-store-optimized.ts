/**
 * 通话清单数据存储 - 优化版本
 * 按日期分文件存储，提升读写性能
 */

import { mkdir, readFile, rename, stat, writeFile, readdir } from 'fs/promises'
import path from 'path'

export type LocalCallLogRow = {
  id?: string
  uuid?: string
  agentCode?: string
  agentName?: string
  teamId?: string
  teamName?: string
  cityCode?: string
  cityName?: string
  startTime?: string
  endTime?: string
  callDuration?: number
  ringDuration?: number
  callType?: number
  callTypeName?: string
  phoneNumber?: string
  calledPhone?: string
  callingPhone?: string
  status?: number
  statusName?: string
  syncTime?: string
  [key: string]: unknown
}

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const CALL_LOG_FILE = path.join(DATA_DIR, 'qms_call_log_list_2026-03-22.json')

const SYNC_LOG_FILE = path.join(DATA_DIR, 'qms_sync_log.json')

let callLogWriteQueue: Promise<void> = Promise.resolve()
const jsonReadCache = new Map<
  string,
  {
    mtimeMs: number
    size: number
    rows: unknown[]
  }
>()

/**
 * 从通话时间提取日期部分 (YYYY-MM-DD)
 */
function extractDateFromStartTime(startTime: string | null | undefined): string | null {
  if (!startTime) return null
  const match = String(startTime).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 获取指定日期的文件路径
 */
function getCallLogFilePath(date: string | null): string {
  if (!date) {
    return CALL_LOG_FILE
  }
  return path.join(DATA_DIR, `qms_call_log_list_${date}.json`)
}

/**
 * 获取所有通话清单文件列表
 */
export async function getAllCallLogFiles(): Promise<string[]> {
  try {
    const files = await readdir(DATA_DIR)
    return files
      .filter(f => f.startsWith('qms_call_log_list_') && f.endsWith('.json'))
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

/**
 * 提取第一个非空文本作为唯一键
 */
function firstNonEmptyText(values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v != null && String(v).trim().length > 0) {
      return String(v).trim()
    }
  }
  return null
}

async function readJsonArray<T>(filePath: string, useCache: boolean = true): Promise<T[]> {
  if (useCache && jsonReadCache.has(filePath)) {
    const cached = jsonReadCache.get(filePath)!
    try {
      const s = await stat(filePath)
      if (s.mtimeMs === cached.mtimeMs && s.size === cached.size) {
        return cached.rows as T[]
      }
    } catch {
      jsonReadCache.delete(filePath)
    }
  }

  try {
    const text = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(text)
    const rows = Array.isArray(parsed) ? parsed : []

    if (useCache) {
      const s = await stat(filePath)
      jsonReadCache.set(filePath, {
        mtimeMs: s.mtimeMs,
        size: s.size,
        rows,
      })
    }

    return rows
  } catch {
    return []
  }
}

async function writeJsonArray<T>(filePath: string, rows: T[]): Promise<void> {
  await ensureDir()
  const tmpPath = `${filePath}.tmp`
  await writeFile(tmpPath, JSON.stringify(rows, null, 2), 'utf-8')
  await rename(tmpPath, filePath)

  jsonReadCache.delete(filePath)
}

/**
 * 按日期分组通话数据
 */
function groupByDate(rows: LocalCallLogRow[]): Map<string, LocalCallLogRow[]> {
  const grouped = new Map<string, LocalCallLogRow[]>()
  console.log('[DEBUG] 开始分组通话数据，总记录数:', rows.length)

  for (const row of rows) {
    const date = extractDateFromStartTime(row.startTime)
    console.log('[DEBUG] 处理记录:', { startTime: row.startTime, extractedDate: date })
    if (!date) {
      console.log('[DEBUG] 跳过记录，因为日期为空:', row)
      continue
    }

    if (!grouped.has(date)) {
      grouped.set(date, [])
      console.log('[DEBUG] 新增日期分组:', date)
    }
    grouped.get(date)!.push(row)
  }

  console.log('[DEBUG] 分组完成，分组数:', grouped.size)
  grouped.forEach((rows, date) => {
    console.log('[DEBUG] 日期', date, '有', rows.length, '条记录')
  })
  return grouped
}

/**
 * 队列写入控制
 */
async function withQueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    callLogWriteQueue = callLogWriteQueue.then(async () => {
      try {
        await sleep(100)
        const result = await fn()
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })
  })
}

/**
 * 解析批量大小配置
 */
function resolveBatchSize(custom?: number): number {
  const envSize = process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE
    ? Number(process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE)
    : 10000
  const size = custom ?? envSize
  return Math.max(1000, Math.min(50000, size))
}

/**
 * 按日期分文件存储通话清单数据
 */
export async function upsertLocalCallLogs(
  rows: LocalCallLogRow[],
  options?: { batchSize?: number }
): Promise<number> {
  return withQueue(async () => {
    const batchSize = resolveBatchSize(options?.batchSize)
    const safeBatchSize = Math.max(1000, Math.min(50000, batchSize))

    // 按日期分组
    const grouped = groupByDate(rows)

    let totalUpserted = 0

    // 并行写入不同日期的文件
    const writePromises = Array.from(grouped.entries()).map(async ([date, dateRows]) => {
      const filePath = getCallLogFilePath(date)

      // 读取现有数据
      const existing = await readJsonArray<LocalCallLogRow>(filePath, false)
      const byKey = new Map<string, LocalCallLogRow>()

      // 建立现有数据的索引
      for (const row of existing) {
        const key = firstNonEmptyText([row.id, row.uuid])
        if (key) {
          byKey.set(key, row)
        }
      }

      // 合并新数据
      for (const row of dateRows) {
        const key = firstNonEmptyText([row.id, row.uuid])
        if (key) {
          byKey.set(key, row)
        }
      }

      // 按时间排序
      const merged = Array.from(byKey.values()).sort((a, b) => {
        const ta = new Date(String(a.startTime ?? '')).getTime()
        const tb = new Date(String(b.startTime ?? '')).getTime()
        const na = Number.isFinite(ta) ? ta : 0
        const nb = Number.isFinite(tb) ? tb : 0
        return nb - na
      })

      // 一次性写入所有数据
      await writeJsonArray(filePath, merged)

      return dateRows.length
    })

    const results = await Promise.all(writePromises)
    totalUpserted = results.reduce((sum, n) => sum + n, 0)

    return totalUpserted
  })
}

/**
 * 读取所有通话清单数据（聚合多个日期文件）
 */
export async function readAllLocalCallLogs(): Promise<LocalCallLogRow[]> {
  const files = await getAllCallLogFiles()
  const allRows: LocalCallLogRow[] = []

  for (const file of files) {
    const rows = await readJsonArray<LocalCallLogRow>(file, true)
    allRows.push(...rows)
  }

  // 按时间排序
  return allRows.sort((a, b) => {
    const ta = new Date(String(a.startTime ?? '')).getTime()
    const tb = new Date(String(b.startTime ?? '')).getTime()
    const na = Number.isFinite(ta) ? ta : 0
    const nb = Number.isFinite(tb) ? tb : 0
    return nb - na
  })
}

/**
 * 读取指定日期范围的通话清单数据
 */
export async function readLocalCallLogsByDateRange(options?: {
  startDate?: string
  endDate?: string
}): Promise<{ rows: LocalCallLogRow[]; files: string[] }> {
  const { startDate, endDate } = options || {}
  const files = await getAllCallLogFiles()

  const allRows: LocalCallLogRow[] = []
  const matchingFiles: string[] = []

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
    const filePath = getCallLogFilePath(date)
    try {
      await stat(filePath)
      // 文件存在，添加到匹配文件列表
      matchingFiles.push(filePath)
    } catch {
      // 文件不存在，创建空白文件
      await writeJsonArray(filePath, [])
      matchingFiles.push(filePath)
    }
  }

  // 读取所有匹配文件的数据
  for (const file of matchingFiles) {
    const rows = await readJsonArray<LocalCallLogRow>(file, true)
    allRows.push(...rows)
  }

  // 按时间排序
  const sortedRows = allRows.sort((a, b) => {
    const ta = new Date(String(a.startTime ?? '')).getTime()
    const tb = new Date(String(b.startTime ?? '')).getTime()
    const na = Number.isFinite(ta) ? ta : 0
    const nb = Number.isFinite(tb) ? tb : 0
    return nb - na
  })

  return { rows: sortedRows, files: matchingFiles }
}

/**
 * 读取单日通话清单数据
 */
export async function readLocalCallLogsByDate(date: string): Promise<LocalCallLogRow[]> {
  const filePath = getCallLogFilePath(date)
  const rows = await readJsonArray<LocalCallLogRow>(filePath, true)

  // 按时间排序
  return rows.sort((a, b) => {
    const ta = new Date(String(a.startTime ?? '')).getTime()
    const tb = new Date(String(b.startTime ?? '')).getTime()
    const na = Number.isFinite(ta) ? ta : 0
    const nb = Number.isFinite(tb) ? tb : 0
    return nb - na
  })
}

/**
 * 迁移旧版数据到按日期分文件
 */
export async function migrateOldCallLogData(): Promise<{
  migrated: boolean
  fileCount: number
  totalRows: number
}> {
  try {
    const fs = await import('fs/promises')

    // 检查旧文件是否存在
    try {
      await fs.access(CALL_LOG_FILE)
    } catch {
      return { migrated: false, fileCount: 0, totalRows: 0 }
    }

    const oldRows = await readJsonArray<LocalCallLogRow>(CALL_LOG_FILE, false)

    if (oldRows.length === 0) {
      return { migrated: false, fileCount: 0, totalRows: 0 }
    }

    // 按日期分组并写入新文件
    await upsertLocalCallLogs(oldRows)

    // 备份旧文件
    const backupPath = `${CALL_LOG_FILE}.backup.${Date.now()}`
    await rename(CALL_LOG_FILE, backupPath)

    const grouped = groupByDate(oldRows)

    return {
      migrated: true,
      fileCount: grouped.size,
      totalRows: oldRows.length,
    }
  } catch (error) {
    console.error('Call log migration failed:', error)
    return { migrated: false, fileCount: 0, totalRows: 0 }
  }
}

/**
 * 获取存储统计信息
 */
export async function getCallLogStorageStats(): Promise<{
  totalFiles: number
  totalRows: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
  fileSize: number
}> {
  const files = await getAllCallLogFiles()
  let totalRows = 0
  let totalSize = 0
  let earliest: string | null = null
  let latest: string | null = null

  for (const file of files) {
    const match = file.match(/qms_call_log_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue

    const fileDate = match[1]

    if (!earliest || fileDate < earliest) earliest = fileDate
    if (!latest || fileDate > latest) latest = fileDate

    const s = await stat(file)
    totalSize += s.size

    const rows = await readJsonArray<LocalCallLogRow>(file, false)
    totalRows += rows.length
  }

  return {
    totalFiles: files.length,
    totalRows,
    dateRange: { earliest, latest },
    fileSize: totalSize,
  }
}

/**
 * 清理指定日期之前的旧数据
 */
export async function cleanupOldCallLogs(beforeDate: string): Promise<{
  deletedFiles: number
  deletedRows: number
}> {
  const files = await getAllCallLogFiles()
  let deletedFiles = 0
  let deletedRows = 0

  for (const file of files) {
    const match = file.match(/qms_call_log_list_(\d{4}-\d{2}-\d{2})\.json$/)
    if (!match) continue

    const fileDate = match[1]

    if (fileDate < beforeDate) {
      const fs = await import('fs/promises')
      const rows = await readJsonArray<LocalCallLogRow>(file, false)
      deletedRows += rows.length

      try {
        await fs.unlink(file)
        deletedFiles++
        jsonReadCache.delete(file)
      } catch (error) {
        console.error(`Failed to delete file ${file}:`, error)
      }
    }
  }

  return { deletedFiles, deletedRows }
}
