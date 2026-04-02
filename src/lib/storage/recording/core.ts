// 录音存储核心功能模块
import { mkdir, readFile, rename, stat, writeFile, readdir } from 'fs/promises'
import path from 'path'
import { LocalRecordingRow, RecordingReadOptions, UpsertOptions } from './types'
import { getCachedData, setCachedData, clearCache } from './cache'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_FILE = path.join(DATA_DIR, 'qms_recording_list_2026-03-22.json')

// 写入队列，确保并发写入安全
let recordingWriteQueue: Promise<void> = Promise.resolve()

/**
 * 从录音时间提取日期部分 (YYYY-MM-DD)
 */
export function extractDateFromStartTime(startTime: string | null): string | null {
  if (!startTime) return null
  const match = startTime.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/**
 * 获取指定日期的文件路径
 */
export function getRecordingFilePath(date: string | null): string {
  if (!date) {
    return RECORDING_FILE
  }
  return path.join(DATA_DIR, `qms_recording_list_${date}.json`)
}

/**
 * 获取所有录音文件列表
 */
export async function getAllRecordingFiles(): Promise<string[]> {
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

/**
 * 安全解析JSON数组
 */
export function parseJsonArraySafely<T>(raw: string): { rows: T[]; recovered: boolean } {
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

/**
 * 读取JSON数组文件
 */
export async function readJsonArray<T>(filePath: string, strict = false): Promise<T[]> {
  const maxRetries = strict ? 5 : 2
  let lastError: unknown = null
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 检查缓存
      const cachedData = await getCachedData<T>(filePath)
      if (cachedData) {
        return cachedData
      }
      
      const raw = await readFile(filePath, 'utf-8')
      if (!raw.trim()) return []
      
      const { rows } = parseJsonArraySafely<T>(raw)
      
      // 设置缓存
      await setCachedData(filePath, rows)
      
      return rows
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        clearCache(filePath)
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

/**
 * 写入JSON数组文件
 */
export async function writeJsonArray<T>(filePath: string, rows: T[]): Promise<void> {
  await ensureDir()
  const tmpPath = `${filePath}.tmp`
  await writeFile(tmpPath, JSON.stringify(rows, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
  clearCache(filePath)
}

/**
 * 队列处理，确保并发写入安全
 */
export async function withQueue<T>(fn: () => Promise<T>): Promise<T> {
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
export function groupByDate(rows: LocalRecordingRow[]): Map<string, LocalRecordingRow[]> {
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
export async function readAllLocalRecordings(options?: RecordingReadOptions): Promise<{ rows: LocalRecordingRow[]; files: string[] }> {
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
export async function readLocalRecordingsByDateRange(options?: RecordingReadOptions): Promise<LocalRecordingRow[]> {
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
 * @param rows 要写入的录音数据
 * @param options 配置选项
 * @param options.batchSize 分批处理的大小
 * @param options.writeBatchSize 写入批次大小
 * @param options.onlyAddNew 如果为 true，则只添加新录音，不覆盖已有录音（基于 uuid）
 */
export async function upsertLocalRecordings(
  rows: LocalRecordingRow[],
  options?: UpsertOptions
): Promise<number> {
  return withQueue(async () => {
    const batchSize = options?.batchSize ?? Number(process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE || '10000')
    const safeBatchSize = Math.max(1000, Math.min(50000, batchSize))
    const writeBatchSize = options?.writeBatchSize ?? 50000
    const onlyAddNew = options?.onlyAddNew ?? false // 默认不覆盖已有数据
    
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
      
      const existingCount = byUuid.size
      
      // 分批合并新数据，避免一次性处理过多数据
      for (let i = 0; i < dateRows.length; i += safeBatchSize) {
        const batch = dateRows.slice(i, i + safeBatchSize)
        for (const row of batch) {
          // 如果 onlyAddNew 为 true，只添加 uuid 不存在的新录音
          if (onlyAddNew) {
            if (!byUuid.has(row.uuid)) {
              byUuid.set(row.uuid, row)
            }
          } else {
            // 否则覆盖已有录音（upsert 行为）
            byUuid.set(row.uuid, row)
          }
        }
        // 释放内存
        batch.length = 0
      }
      
      // 如果没有新增或更新的数据，跳过写入
      if (byUuid.size === existingCount && onlyAddNew) {
        return 0
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