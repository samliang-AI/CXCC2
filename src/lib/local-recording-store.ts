import { mkdir, readFile, rename, stat, writeFile } from 'fs/promises'
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

export type LocalTeamRow = Record<string, unknown>
export type LocalAgentRow = Record<string, unknown>
export type LocalCallLogRow = Record<string, unknown>

type LocalSyncLog = {
  sync_type: string
  sync_start_time: string
  sync_end_time: string
  sync_status: number
  sync_count: number
  success_count: number
  fail_count: number
  error_message: string | null
}

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_FILE = path.join(DATA_DIR, 'qms_recording_list_2026-03-22.json')
const CALL_LOG_FILE = path.join(DATA_DIR, 'qms_call_log_list_2026-03-22.json')
const TEAM_FILE = path.join(DATA_DIR, 'qms_team_list.json')
const AGENT_FILE = path.join(DATA_DIR, 'qms_agent_list.json')
const SYNC_LOG_FILE = path.join(DATA_DIR, 'qms_sync_log.json')
let recordingWriteQueue: Promise<void> = Promise.resolve()
let callLogWriteQueue: Promise<void> = Promise.resolve()
let teamWriteQueue: Promise<void> = Promise.resolve()
let agentWriteQueue: Promise<void> = Promise.resolve()
let syncLogWriteQueue: Promise<void> = Promise.resolve()
const jsonReadCache = new Map<
  string,
  {
    mtimeMs: number
    size: number
    rows: unknown[]
  }
>()

async function ensureDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function extractFirstJsonSegment(text: string): string | null {
  const src = text.trim()
  if (!src) return null
  const start = src.search(/[\{\[]/)
  if (start < 0) return null
  const open = src[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth += 1
    if (ch === close) {
      depth -= 1
      if (depth === 0) {
        return src.slice(start, i + 1)
      }
    }
  }
  return null
}

function parseJsonArraySafely<T>(raw: string): { rows: T[]; recovered: boolean } {
  const text = raw.trim()
  if (!text) return { rows: [], recovered: false }
  try {
    const parsed = JSON.parse(text)
    return { rows: Array.isArray(parsed) ? (parsed as T[]) : [], recovered: false }
  } catch {
    const segment = extractFirstJsonSegment(text)
    if (!segment) {
      throw new Error('本地 JSON 文件损坏且无法恢复')
    }
    const parsed = JSON.parse(segment)
    return { rows: Array.isArray(parsed) ? (parsed as T[]) : [], recovered: true }
  }
}

async function readJsonArray<T>(filePath: string, strict = false): Promise<T[]> {
  const maxRetries = strict ? 5 : 2
  let lastError: unknown = null
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fileStat = await stat(filePath)
      const cached = jsonReadCache.get(filePath)
      if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
        return cached.rows as T[]
      }
      const raw = await readFile(filePath, 'utf-8')
      if (!raw.trim()) return []
      const { rows, recovered } = parseJsonArraySafely<T>(raw)
      // 自愈：若发现尾部脏数据，回写标准 JSON，避免后续重复失败
      if (recovered && strict) {
        await writeJsonArray(filePath, rows)
      }
      jsonReadCache.set(filePath, {
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
        rows: rows as unknown[],
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

async function withQueue<T>(type: 'recording' | 'callLog' | 'team' | 'agent' | 'syncLog', fn: () => Promise<T>): Promise<T> {
  const queue =
    type === 'recording'
      ? recordingWriteQueue
      : type === 'callLog'
        ? callLogWriteQueue
      : type === 'team'
        ? teamWriteQueue
        : type === 'agent'
          ? agentWriteQueue
          : syncLogWriteQueue
  const task = queue.then(fn, fn)
  const cleanup = task.then(
    () => undefined,
    () => undefined
  )
  if (type === 'recording') recordingWriteQueue = cleanup
  else if (type === 'callLog') callLogWriteQueue = cleanup
  else if (type === 'team') teamWriteQueue = cleanup
  else if (type === 'agent') agentWriteQueue = cleanup
  else syncLogWriteQueue = cleanup
  return task
}

function firstNonEmptyText(values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

function resolveBatchSize(override?: number): number {
  const fromEnv = Number(process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE || '10000')
  const n = override ?? fromEnv
  if (!Number.isFinite(n)) return 10000
  return Math.max(1000, Math.min(50000, Math.floor(n)))
}

export async function upsertLocalRecordings(
  rows: LocalRecordingRow[],
  options?: { batchSize?: number }
): Promise<number> {
  return withQueue('recording', async () => {
    const batchSize = resolveBatchSize(options?.batchSize)
    // 按日期分组数据
    const groupedByDate = new Map<string, LocalRecordingRow[]>()
    
    for (const row of rows) {
      if (row.start_time) {
        const date = new Date(row.start_time).toISOString().split('T')[0]
        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, [])
        }
        groupedByDate.get(date)!.push(row)
      }
    }
    
    let totalUpserted = 0
    
    // 处理每个日期的数据
    for (const [date, dateRows] of groupedByDate.entries()) {
      const filePath = path.join(DATA_DIR, `qms_recording_list_${date}.json`)
      const existing = await readJsonArray<LocalRecordingRow>(filePath, true)
      const byUuid = new Map<string, LocalRecordingRow>()
      
      for (const row of existing) {
        if (row.uuid) byUuid.set(row.uuid, row)
      }
      
      for (let i = 0; i < dateRows.length; i += batchSize) {
        const chunk = dateRows.slice(i, i + batchSize)
        for (const row of chunk) {
          byUuid.set(row.uuid, row)
        }
      }
      
      const merged = Array.from(byUuid.values()).sort((a, b) => {
        const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
        const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
        return t2 - t1
      })
      
      await writeJsonArray(filePath, merged)
      totalUpserted += dateRows.length
    }
    
    return totalUpserted
  })
}

export async function upsertLocalCallLogs(
  rows: LocalCallLogRow[],
  options?: { batchSize?: number }
): Promise<number> {
  return withQueue('callLog', async () => {
    const batchSize = resolveBatchSize(options?.batchSize)
    // 按日期分组数据
    const groupedByDate = new Map<string, LocalCallLogRow[]>()
    
    for (const row of rows) {
      if (row.startTime) {
        const date = new Date(String(row.startTime)).toISOString().split('T')[0]
        if (!groupedByDate.has(date)) {
          groupedByDate.set(date, [])
        }
        groupedByDate.get(date)!.push(row)
      }
    }
    
    let totalUpserted = 0
    
    // 处理每个日期的数据
    for (const [date, dateRows] of groupedByDate.entries()) {
      const filePath = path.join(DATA_DIR, `qms_call_log_list_${date}.json`)
      const existing = await readJsonArray<LocalCallLogRow>(filePath, true)
      const byKey = new Map<string, LocalCallLogRow>()
      
      for (const row of existing) {
        const key = firstNonEmptyText([row.id, row.uuid])
        if (key) byKey.set(key, row)
      }
      
      for (let i = 0; i < dateRows.length; i += batchSize) {
        const chunk = dateRows.slice(i, i + batchSize)
        for (const row of chunk) {
          const key = firstNonEmptyText([row.id, row.uuid])
          if (key) byKey.set(key, row)
        }
      }
      
      const merged = Array.from(byKey.values()).sort((a, b) => {
        const ta = new Date(String(a.startTime ?? '')).getTime()
        const tb = new Date(String(b.startTime ?? '')).getTime()
        const na = Number.isFinite(ta) ? ta : 0
        const nb = Number.isFinite(tb) ? tb : 0
        return nb - na
      })
      
      await writeJsonArray(filePath, merged)
      totalUpserted += dateRows.length
    }
    
    return totalUpserted
  })
}

export async function appendLocalSyncLog(log: LocalSyncLog): Promise<void> {
  await withQueue('syncLog', async () => {
    const logs = await readJsonArray<LocalSyncLog>(SYNC_LOG_FILE, true)
    logs.push(log)
    const sliced = logs.slice(-1000)
    await writeJsonArray(SYNC_LOG_FILE, sliced)
  })
}

export async function upsertLocalTeams(rows: LocalTeamRow[]): Promise<number> {
  return withQueue('team', async () => {
    const existing = await readJsonArray<LocalTeamRow>(TEAM_FILE, true)
    const byKey = new Map<string, LocalTeamRow>()
    for (const row of existing) {
      const key = firstNonEmptyText([
        row.id,
        row.skillgroupId,
        row.teamId,
        row.name,
        row.skillGroupName,
      ])
      if (key) byKey.set(key, row)
    }
    for (const row of rows) {
      const key = firstNonEmptyText([
        row.id,
        row.skillgroupId,
        row.teamId,
        row.name,
        row.skillGroupName,
      ])
      if (key) byKey.set(key, row)
    }
    await writeJsonArray(TEAM_FILE, Array.from(byKey.values()))
    return rows.length
  })
}

export async function upsertLocalAgents(rows: LocalAgentRow[]): Promise<number> {
  return withQueue('agent', async () => {
    const existing = await readJsonArray<LocalAgentRow>(AGENT_FILE, true)
    const byKey = new Map<string, LocalAgentRow>()
    for (const row of existing) {
      const key = firstNonEmptyText([
        row.agent,
        row.agentNo,
        row.username,
        row.workNumber,
        row.id,
      ])
      if (key) byKey.set(key, row)
    }
    for (const row of rows) {
      const key = firstNonEmptyText([
        row.agent,
        row.agentNo,
        row.username,
        row.workNumber,
        row.id,
      ])
      if (key) byKey.set(key, row)
    }
    await writeJsonArray(AGENT_FILE, Array.from(byKey.values()))
    return rows.length
  })
}

export async function readLocalRecordings(): Promise<LocalRecordingRow[]> {
  const rows = await readLocalRecordingsRaw()
  return [...rows].sort((a, b) => {
    const t1 = a.start_time ? new Date(a.start_time).getTime() : 0
    const t2 = b.start_time ? new Date(b.start_time).getTime() : 0
    return t2 - t1
  })
}

export async function readLocalRecordingsRaw(): Promise<LocalRecordingRow[]> {
  return readJsonArray<LocalRecordingRow>(RECORDING_FILE)
}

export async function readLocalCallLogs(): Promise<LocalCallLogRow[]> {
  return readJsonArray<LocalCallLogRow>(CALL_LOG_FILE)
}

export async function readLocalTeams(): Promise<LocalTeamRow[]> {
  return readJsonArray<LocalTeamRow>(TEAM_FILE)
}

export async function readLocalAgents(): Promise<LocalAgentRow[]> {
  return readJsonArray<LocalAgentRow>(AGENT_FILE)
}

export function getLocalSyncFiles() {
  const today = new Date().toISOString().split('T')[0];
  return {
    recordings: path.join(DATA_DIR, `qms_recording_list_${today}.json`),
    callLogs: path.join(DATA_DIR, `qms_call_log_list_${today}.json`),
    teams: TEAM_FILE,
    agents: AGENT_FILE,
    syncLogs: SYNC_LOG_FILE,
  }
}

// 导出优化版本的日期范围查询函数
export { readLocalRecordingsByDateRange } from './local-recording-store-optimized'
export { readLocalCallLogsByDateRange } from './local-call-log-store-optimized'
