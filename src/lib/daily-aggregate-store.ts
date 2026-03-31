import { readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

import { isConnectedRecord, isSuccessRecord, qualityBucket, extractAgentCode } from '@/lib/cxcc-boards'
import { getLocalSyncFiles, readLocalAgents, readLocalCallLogs, readLocalRecordingsRaw, readLocalTeams, readLocalRecordingsByDateRange, readLocalCallLogsByDateRange } from '@/lib/local-recording-store'
import { readAllLocalRecordings } from '@/lib/local-recording-store-optimized'
import { readAllLocalCallLogs } from '@/lib/local-call-log-store-optimized'
import { getProjectIdNameMap, resolveProjectName } from '@/lib/project-id-name-map'

type Counter = Record<string, number>

export type RecordingDailySummary = {
  sourceFingerprint: string
  generatedAt: string
  days: Record<
    string,
    {
      total: number
      connected: number
      success: number
      quality: { excellent: number; good: number; pass: number; fail: number }
      statusCounts: Counter
      byProject: Record<string, { total: number; connected: number; success: number; agentCodes: string[]; teams: Map<string, { teamId: string; teamName: string; total: number; connected: number; success: number; agentCodes: string[] }> }>
      byAgent: Record<string, { agentName: string; teamId: string; teamName: string; total: number; success: number }>
      byTeam: Record<string, { teamName: string; total: number; success: number; agentCodes: string[] }>
    }
  >
}

export type CallLogDailySummary = {
  sourceFingerprint: string
  generatedAt: string
  days: Record<
    string,
    {
      total: number
      byProjectTotal: Counter
      byKey: Record<
        string,
        {
          total: number
          connected: number
          success: number
          durationSum: number
          byCity: Record<string, { total: number; connected: number; success: number }>
          byTeam: Record<string, { total: number; connected: number; success: number }>
        }
      >
    }
  >
}

const SUMMARY_DIR = path.join(process.cwd(), 'data', 'local-sync')
const RECORDING_SUMMARY_FILE = path.join(SUMMARY_DIR, 'qms_recording_daily_summary.json')
const CALL_LOG_SUMMARY_FILE = path.join(SUMMARY_DIR, 'qms_call_log_daily_summary.json')
const projectIdNameMap = getProjectIdNameMap()

let recordingSummaryCache: RecordingDailySummary | null = null
let callLogSummaryCache: CallLogDailySummary | null = null

function dayFromTime(v: unknown): string {
  const text = String(v ?? '').trim()
  if (!text) return ''
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

async function sourceFingerprint(paths: string[]): Promise<string> {
  const chunks: string[] = []
  for (const p of paths) {
    try {
      const s = await stat(p)
      chunks.push(`${p}|${s.size}|${s.mtimeMs}`)
    } catch {
      chunks.push(`${p}|0|0`)
    }
  }
  return chunks.join(';')
}

async function readSummaryFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    if (!raw.trim()) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeSummaryFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value), 'utf-8')
}

function incCounter(counter: Counter, key: string, step = 1): void {
  counter[key] = (counter[key] || 0) + step
}

export async function getRecordingDailySummary(): Promise<RecordingDailySummary> {
  const files = getLocalSyncFiles()
  const fp = await sourceFingerprint([files.recordings, files.teams, files.agents])
  if (recordingSummaryCache && recordingSummaryCache.sourceFingerprint === fp) {
    return recordingSummaryCache
  }

  const fromFile = await readSummaryFile<RecordingDailySummary>(RECORDING_SUMMARY_FILE)
  if (fromFile && fromFile.sourceFingerprint === fp) {
    recordingSummaryCache = fromFile
    return fromFile
  }

  const [recordings, teams, agents] = await Promise.all([
    readAllLocalRecordings(),
    readLocalTeams(),
    readLocalAgents(),
  ])

  const teamNameById = new Map<string, string>()
  for (const t of teams as Array<Record<string, unknown>>) {
    const tid = String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim()
    const tname = String(t.skillGroupName ?? t.name ?? t.teamName ?? tid).trim()
    if (tid) teamNameById.set(tid, tname || tid)
  }

  const agentDim = new Map<string, { name: string; teamId: string; teamName: string }>()
  for (const a of agents as Array<Record<string, unknown>>) {
    const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
    if (!code) continue
    const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
    const tname = String(a.skillGroupName ?? a.teamName ?? teamNameById.get(tid) ?? tid).trim() || '未分组'
    const name = String(a.name ?? a.agentName ?? a.realname ?? code).trim() || code
    agentDim.set(code, { name, teamId: tid, teamName: tname })
  }

  const days: RecordingDailySummary['days'] = {}
  const recordingRows = Array.isArray(recordings) ? recordings : recordings.rows
  for (const r of recordingRows) {
    const raw = r as Record<string, unknown>
    const day = dayFromTime(raw.start_time ?? raw.startTime)
    if (!day) continue
    if (!days[day]) {
      days[day] = {
        total: 0,
        connected: 0,
        success: 0,
        quality: { excellent: 0, good: 0, pass: 0, fail: 0 },
        statusCounts: {},
        byProject: {},
        byAgent: {},
        byTeam: {},
      }
    }
    const bucket = days[day]
    bucket.total += 1
    const connected = isConnectedRecord(raw)
    const success = isSuccessRecord(raw)
    if (connected) bucket.connected += 1
    if (success) bucket.success += 1

    const q = qualityBucket(raw)
    if (q === '优秀') bucket.quality.excellent += 1
    else if (q === '良好') bucket.quality.good += 1
    else if (q === '合格') bucket.quality.pass += 1
    else bucket.quality.fail += 1

    const statusName = String(raw.status_name ?? raw.statusName ?? '未标记').trim() || '未标记'
    incCounter(bucket.statusCounts, statusName)

    const projectName = resolveProjectName(raw.project_id ?? raw.projectId, projectIdNameMap)
    if (!bucket.byProject[projectName]) {
      bucket.byProject[projectName] = { total: 0, connected: 0, success: 0, agentCodes: [], teams: new Map() }
    }
    const p = bucket.byProject[projectName]
    p.total += 1
    if (connected) p.connected += 1
    if (success) p.success += 1

    const agentCode = extractAgentCode(raw)
    const ad = agentDim.get(agentCode)
    const agentName = ad?.name || String(raw.agent_name ?? raw.agentName ?? raw.agentRealName ?? agentCode).trim() || '未知坐席'
    const teamId = ad?.teamId || String(raw.skillgroupId ?? raw.teamId ?? '').trim() || 'unknown'
    const teamName = ad?.teamName || teamNameById.get(teamId) || teamId || '未分组'

    if (!bucket.byAgent[agentCode || 'unknown']) {
      bucket.byAgent[agentCode || 'unknown'] = { agentName, teamId, teamName, total: 0, success: 0 }
    }
    const a = bucket.byAgent[agentCode || 'unknown']
    a.total += 1
    if (success) a.success += 1

    if (!bucket.byTeam[teamId]) {
      bucket.byTeam[teamId] = { teamName, total: 0, success: 0, agentCodes: [] }
    }
    const t = bucket.byTeam[teamId]
    t.total += 1
    if (success) t.success += 1

    if (agentCode) {
      if (!p.agentCodes.includes(agentCode)) p.agentCodes.push(agentCode)
      if (!t.agentCodes.includes(agentCode)) t.agentCodes.push(agentCode)
      
      // 将团队数据关联到项目中，基于projectId和taskId
      const projectId = raw.project_id ?? raw.projectId
      const taskId = raw.task_id ?? raw.taskId
      const projectTeamKey = `${teamId}-${projectId}-${taskId}`
      if (!p.teams.has(projectTeamKey)) {
        p.teams.set(projectTeamKey, {
          teamId,
          teamName: ad?.teamName || teamNameById.get(teamId) || teamId || '未分组',
          total: 0,
          connected: 0,
          success: 0,
          agentCodes: []
        })
      }
      const projectTeam = p.teams.get(projectTeamKey)!
      projectTeam.total += 1
      if (connected) projectTeam.connected += 1
      if (success) projectTeam.success += 1
      if (!projectTeam.agentCodes.includes(agentCode)) {
        projectTeam.agentCodes.push(agentCode)
      }
    }
  }

  const summary: RecordingDailySummary = {
    sourceFingerprint: fp,
    generatedAt: new Date().toISOString(),
    days,
  }
  await writeSummaryFile(RECORDING_SUMMARY_FILE, summary)
  recordingSummaryCache = summary
  return summary
}

export async function getCallLogDailySummary(): Promise<CallLogDailySummary> {
  const files = getLocalSyncFiles()
  const fp = await sourceFingerprint([files.callLogs, files.recordings, files.teams, files.agents])
  if (callLogSummaryCache && callLogSummaryCache.sourceFingerprint === fp) {
    return callLogSummaryCache
  }

  const fromFile = await readSummaryFile<CallLogDailySummary>(CALL_LOG_SUMMARY_FILE)
  if (fromFile && fromFile.sourceFingerprint === fp) {
    callLogSummaryCache = fromFile
    return fromFile
  }

  const [callLogs, recordings, teams, agents] = await Promise.all([
    readAllLocalCallLogs(),
    readAllLocalRecordings(),
    readLocalTeams(),
    readLocalAgents(),
  ])

  const teamNameById = new Map<string, string>()
  for (const t of teams as Array<Record<string, unknown>>) {
    const tid = String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim()
    const tname = String(t.skillGroupName ?? t.name ?? t.teamName ?? tid).trim()
    if (tid) teamNameById.set(tid, tname || tid)
  }
  const agentDim = new Map<string, { teamId: string; teamName: string }>()
  for (const a of agents as Array<Record<string, unknown>>) {
    const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
    if (!code) continue
    const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
    const tname = String(a.skillGroupName ?? a.teamName ?? teamNameById.get(tid) ?? tid).trim() || '未分组'
    agentDim.set(code, { teamId: tid, teamName: tname })
  }
  const projectByUuid = new Map<string, string>()
  const recordingRows = Array.isArray(recordings) ? recordings : recordings.rows
  for (const r of recordingRows) {
    const uuid = String((r as Record<string, unknown>).uuid ?? '').trim()
    if (!uuid) continue
    projectByUuid.set(uuid, resolveProjectName((r as Record<string, unknown>).project_id, projectIdNameMap))
  }

  const days: CallLogDailySummary['days'] = {}
  for (const row of callLogs as Array<Record<string, unknown>>) {
    const day = dayFromTime(row.startTime)
    if (!day) continue
    if (!days[day]) {
      days[day] = { total: 0, byProjectTotal: {}, byKey: {} }
    }
    const bucket = days[day]
    bucket.total += 1

    const uuid = String(row.uuid ?? row.id ?? '').trim()
    const projectName = resolveProjectName(row.projectId ?? projectByUuid.get(uuid), projectIdNameMap)
    incCounter(bucket.byProjectTotal, projectName)

    const key = String(row.keyInfo ?? '').trim()
    if (!bucket.byKey[key]) {
      bucket.byKey[key] = { total: 0, connected: 0, success: 0, durationSum: 0, byCity: {}, byTeam: {} }
    }
    const k = bucket.byKey[key]
    k.total += 1
    const connected = String(row.connectStatus ?? '').trim() === '已接通'
    const success = isSuccessRecord(row) || String(row.callStatus ?? '').includes('接通')
    if (connected) {
      k.connected += 1
      const n = Number(row.answerDuration ?? row.callDuration ?? 0)
      k.durationSum += Number.isFinite(n) ? n : 0
    }
    if (success) k.success += 1

    const city = String(row.cityName ?? row.city ?? row.cityCode ?? '未知').trim() || '未知'
    if (!k.byCity[city]) k.byCity[city] = { total: 0, connected: 0, success: 0 }
    k.byCity[city].total += 1
    if (connected) k.byCity[city].connected += 1
    if (success) k.byCity[city].success += 1

    const code = String(row.agentCode ?? '').trim()
    const teamName = agentDim.get(code)?.teamName || '未分组'
    if (!k.byTeam[teamName]) k.byTeam[teamName] = { total: 0, connected: 0, success: 0 }
    k.byTeam[teamName].total += 1
    if (connected) k.byTeam[teamName].connected += 1
    if (success) k.byTeam[teamName].success += 1
  }

  const summary: CallLogDailySummary = {
    sourceFingerprint: fp,
    generatedAt: new Date().toISOString(),
    days,
  }
  await writeSummaryFile(CALL_LOG_SUMMARY_FILE, summary)
  callLogSummaryCache = summary
  return summary
}

export async function getRecordingDailySummaryByDateRange(options?: {
  startDate?: string
  endDate?: string
}): Promise<RecordingDailySummary> {
  const { startDate, endDate } = options || {}
  
  const files = getLocalSyncFiles()
  const fp = await sourceFingerprint([files.recordings, files.teams, files.agents])
  
  // 如果有日期范围，不使用缓存，直接查询
  const [recordingsResult, teams, agents] = await Promise.all([
    startDate && endDate ? readLocalRecordingsByDateRange({ startDate, endDate }) : readLocalRecordingsRaw(),
    readLocalTeams(),
    readLocalAgents(),
  ])
  const recordings = Array.isArray(recordingsResult) ? recordingsResult : (recordingsResult as any).rows || []

  const teamNameById = new Map<string, string>()
  for (const t of teams as Array<Record<string, unknown>>) {
    const tid = String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim()
    const tname = String(t.skillGroupName ?? t.name ?? t.teamName ?? tid).trim()
    if (tid) teamNameById.set(tid, tname || tid)
  }

  const agentDim = new Map<string, { name: string; teamId: string; teamName: string }>()
  for (const a of agents as Array<Record<string, unknown>>) {
    const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
    if (!code) continue
    const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
    const tname = String(a.skillGroupName ?? a.teamName ?? teamNameById.get(tid) ?? tid).trim() || '未分组'
    const name = String(a.name ?? a.agentName ?? a.realname ?? code).trim() || code
    agentDim.set(code, { name, teamId: tid, teamName: tname })
  }

  const days: RecordingDailySummary['days'] = {}
  for (const r of recordings) {
    const raw = r as Record<string, unknown>
    const day = dayFromTime(raw.start_time ?? raw.startTime)
    if (!day) continue
    if (!days[day]) {
      days[day] = {
        total: 0,
        connected: 0,
        success: 0,
        quality: { excellent: 0, good: 0, pass: 0, fail: 0 },
        statusCounts: {},
        byProject: {},
        byAgent: {},
        byTeam: {},
      }
    }
    const bucket = days[day]
    bucket.total += 1
    const connected = isConnectedRecord(raw)
    if (connected) bucket.connected += 1
    if (isSuccessRecord(raw)) bucket.success += 1

    const qs = qualityBucket(raw)
    if (qs === '优秀') bucket.quality.excellent += 1
    else if (qs === '良好') bucket.quality.good += 1
    else if (qs === '合格') bucket.quality.pass += 1
    else if (qs === '不合格') bucket.quality.fail += 1

    const statusName = String(raw.status_name ?? raw.status ?? 'unknown').trim()
    incCounter(bucket.statusCounts, statusName)

    const projectId = raw.project_id ?? (raw as Record<string, unknown>).projectId
    const taskId = raw.task_id ?? (raw as Record<string, unknown>).taskId
    const projectName = resolveProjectName(projectId, projectIdNameMap)
    if (!bucket.byProject[projectName]) {
      bucket.byProject[projectName] = { total: 0, connected: 0, success: 0, agentCodes: [], teams: new Map() }
    }
    bucket.byProject[projectName].total += 1
    if (connected) bucket.byProject[projectName].connected += 1
    if (isSuccessRecord(raw)) bucket.byProject[projectName].success += 1

    const agentCode = extractAgentCode(raw)
    if (agentCode && !bucket.byProject[projectName].agentCodes.includes(agentCode)) {
      bucket.byProject[projectName].agentCodes.push(agentCode)
    }
    if (agentCode) {
      const dim = agentDim.get(agentCode)
      if (!bucket.byAgent[agentCode]) {
        bucket.byAgent[agentCode] = {
          agentName: dim?.name || agentCode,
          teamId: dim?.teamId || '',
          teamName: dim?.teamName || '',
          total: 0,
          success: 0,
        }
      }
      bucket.byAgent[agentCode].total += 1
      if (isSuccessRecord(raw)) bucket.byAgent[agentCode].success += 1

      const teamId = dim?.teamId || ''
      if (teamId) {
        const teamName = dim?.teamName || teamNameById.get(teamId) || teamId
        if (!bucket.byTeam[teamId]) {
          bucket.byTeam[teamId] = { teamName, total: 0, success: 0, agentCodes: [] }
        }
        bucket.byTeam[teamId].total += 1
        if (isSuccessRecord(raw)) bucket.byTeam[teamId].success += 1
        if (!bucket.byTeam[teamId].agentCodes.includes(agentCode)) {
          bucket.byTeam[teamId].agentCodes.push(agentCode)
        }
        
        // 将团队数据关联到项目中，基于projectId和taskId
        const projectTeamKey = `${teamId}-${projectId}-${taskId}`
        if (!bucket.byProject[projectName].teams.has(projectTeamKey)) {
          bucket.byProject[projectName].teams.set(projectTeamKey, {
            teamId,
            teamName,
            total: 0,
            connected: 0,
            success: 0,
            agentCodes: []
          })
        }
        const projectTeam = bucket.byProject[projectName].teams.get(projectTeamKey)!
        projectTeam.total += 1
        if (connected) projectTeam.connected += 1
        if (isSuccessRecord(raw)) projectTeam.success += 1
        if (!projectTeam.agentCodes.includes(agentCode)) {
          projectTeam.agentCodes.push(agentCode)
        }
      }
    }
  }

  return {
    sourceFingerprint: fp,
    generatedAt: new Date().toISOString(),
    days,
  }
}

export async function getCallLogDailySummaryByDateRange(options?: {
  startDate?: string
  endDate?: string
}): Promise<CallLogDailySummary> {
  const { startDate, endDate } = options || {}
  
  const files = getLocalSyncFiles()
  const fp = await sourceFingerprint([files.callLogs, files.teams, files.agents])
  
  const [callLogsResult, teams, agents] = await Promise.all([
    startDate && endDate ? readLocalCallLogsByDateRange({ startDate, endDate }) : readLocalCallLogs(),
    readLocalTeams(),
    readLocalAgents(),
  ])
  const callLogs = Array.isArray(callLogsResult) ? callLogsResult : callLogsResult.rows

  const teamNameById = new Map<string, string>()
  for (const t of teams as Array<Record<string, unknown>>) {
    const tid = String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim()
    const tname = String(t.skillGroupName ?? t.name ?? t.teamName ?? tid).trim()
    if (tid) teamNameById.set(tid, tname || tid)
  }

  const agentDim = new Map<string, { name: string; teamId: string; teamName: string }>()
  for (const a of agents as Array<Record<string, unknown>>) {
    const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
    if (!code) continue
    const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
    const tname = String(a.skillGroupName ?? a.teamName ?? teamNameById.get(tid) ?? tid).trim() || '未分组'
    const name = String(a.name ?? a.agentName ?? a.realname ?? code).trim() || code
    agentDim.set(code, { name, teamId: tid, teamName: tname })
  }

  const projectIdNameMap = getProjectIdNameMap()
  const projectByUuid = new Map<string, string>()
  for (const r of callLogs as Array<Record<string, unknown>>) {
    const uuid = String(r.uuid ?? r.id ?? '').trim()
    if (!uuid) continue
    projectByUuid.set(uuid, resolveProjectName((r as Record<string, unknown>).project_id, projectIdNameMap))
  }

  const days: CallLogDailySummary['days'] = {}
  for (const row of callLogs as Array<Record<string, unknown>>) {
    const day = dayFromTime(row.startTime)
    if (!day) continue
    if (!days[day]) {
      days[day] = { total: 0, byProjectTotal: {}, byKey: {} }
    }
    const bucket = days[day]
    bucket.total += 1

    const uuid = String(row.uuid ?? row.id ?? '').trim()
    const projectName = resolveProjectName(row.projectId ?? projectByUuid.get(uuid), projectIdNameMap)
    incCounter(bucket.byProjectTotal, projectName)

    const key = String(row.keyInfo ?? '').trim()
    if (!bucket.byKey[key]) {
      bucket.byKey[key] = { total: 0, connected: 0, success: 0, durationSum: 0, byCity: {}, byTeam: {} }
    }
    const k = bucket.byKey[key]
    k.total += 1
    const connected = String(row.connectStatus ?? '').trim() === '已接通'
    const success = isSuccessRecord(row) || String(row.callStatus ?? '').includes('接通')
    if (connected) {
      k.connected += 1
      const n = Number(row.answerDuration ?? row.callDuration ?? 0)
      k.durationSum += Number.isFinite(n) ? n : 0
    }
    if (success) k.success += 1

    const city = String(row.cityName ?? row.city ?? row.cityCode ?? '未知').trim() || '未知'
    if (!k.byCity[city]) k.byCity[city] = { total: 0, connected: 0, success: 0 }
    k.byCity[city].total += 1
    if (connected) k.byCity[city].connected += 1
    if (success) k.byCity[city].success += 1

    const code = String(row.agentCode ?? '').trim()
    const teamName = agentDim.get(code)?.teamName || '未分组'
    if (!k.byTeam[teamName]) k.byTeam[teamName] = { total: 0, connected: 0, success: 0 }
    k.byTeam[teamName].total += 1
    if (connected) k.byTeam[teamName].connected += 1
    if (success) k.byTeam[teamName].success += 1
  }

  const summary: CallLogDailySummary = {
    sourceFingerprint: fp,
    generatedAt: new Date().toISOString(),
    days,
  }
  return summary
}
