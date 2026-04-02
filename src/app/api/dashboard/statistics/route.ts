import { NextRequest, NextResponse } from 'next/server'

import {
  dateKey,
  extractAgentCode,
  fetchAllCxccAgents,
  fetchAllCxccRecordsInRange,
  fetchAllCxccTeams,
  isConnectedRecord,
  isSuccessRecord,
  normalizeDateRange,
  qualityBucket,
} from '@/lib/cxcc-boards'
import { isRealDataOnly } from '@/lib/data-source-config'
import { readLocalCallLogs, readLocalRecordingsRaw, readLocalCallLogsByDateRange, readLocalRecordingsByDateRange } from '@/lib/local-recording-store'
import { getProjectIdNameMap, resolveProjectName } from '@/lib/project-id-name-map'
import { getCachedQueryResult, getRouteCacheTtlMs } from '@/lib/route-query-cache'
import { getCallLogDailySummary, getRecordingDailySummary, getCallLogDailySummaryByDateRange, getRecordingDailySummaryByDateRange } from '@/lib/daily-aggregate-store'

function formatDateStr(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const text = value.trim()
  if (!text) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

// 模拟生成统计数据
function generateMockData(startDate: Date, endDate: Date) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // 地市数据
  const cities = [
    { code: '4401', name: '广州' },
    { code: '4403', name: '深圳' },
    { code: '4404', name: '珠海' },
    { code: '4405', name: '汕头' },
    { code: '4406', name: '佛山' },
    { code: '4407', name: '江门' },
    { code: '4408', name: '湛江' },
    { code: '4409', name: '茂名' },
    { code: '4412', name: '肇庆' },
    { code: '4413', name: '惠州' },
    { code: '4414', name: '梅州' },
    { code: '4415', name: '汕尾' },
    { code: '4416', name: '河源' },
    { code: '4417', name: '阳江' },
    { code: '4418', name: '清远' },
    { code: '4419', name: '东莞' },
    { code: '4420', name: '中山' },
    { code: '4451', name: '潮州' },
    { code: '4452', name: '揭阳' },
    { code: '4453', name: '云浮' },
    { code: '4421', name: '韶关' }
  ]

  // 趋势数据 - 根据时间范围生成每日数据
  // 计算全省日均呼叫量基础值（所有地市日均之和）
  const provinceBaseDailyCalls = cities.reduce((sum, city) => {
    const baseDailyCalls = {
      '4401': 180,
      '4403': 200,
      '4406': 150,
      '4419': 160,
    }[city.code] || 100
    return sum + baseDailyCalls
  }, 0)
  
  const trendData = []
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    // 日呼叫量基于全省日均，加入波动
    const calls = Math.floor(provinceBaseDailyCalls * (0.8 + Math.random() * 0.4))
    const connected = Math.floor(calls * (0.6 + Math.random() * 0.2))
    const success = Math.floor(connected * (0.5 + Math.random() * 0.3))
    trendData.push({
      date: formatDateStr(date).substring(5),
      calls,
      connected,
      success,
      rate: Number((success / calls * 100).toFixed(1))
    })
  }

  // 地市排名数据 - 根据时间范围动态调整
  const cityRanking = cities.map(city => {
    // 使用与地市明细相同的基础日均呼叫量逻辑
    const baseDailyCalls = {
      '4401': 180,
      '4403': 200,
      '4406': 150,
      '4419': 160,
    }[city.code] || (100 + Math.floor(Math.random() * 80))
    
    const dailyVariation = 0.8 + Math.random() * 0.4
    const totalCalls = Math.floor(baseDailyCalls * days * dailyVariation)
    const connectedCalls = Math.floor(totalCalls * (0.6 + Math.random() * 0.2))
    const successCalls = Math.floor(connectedCalls * (0.5 + Math.random() * 0.3))
    return {
      cityCode: city.code,
      cityName: city.name,
      totalCalls,
      connectedCalls,
      successCalls,
      rate: Number((successCalls / totalCalls * 100).toFixed(1))
    }
  }).sort((a, b) => b.successCalls - a.successCalls)

  // 坐席排名数据 - 根据时间范围动态调整
  const agents = ['林宇君', '刘土梅', '张小明', '李小红', '王大伟', '陈小芳', '赵大力', '周小敏']
  const agentRanking = agents.map(name => {
    // 日均成功量基础值
    const baseDailySuccess = 8 + Math.floor(Math.random() * 12) // 每天成功8-20单
    const successCalls = Math.floor(baseDailySuccess * days * (0.8 + Math.random() * 0.4))
    const totalCalls = Math.floor(successCalls * (1.2 + Math.random() * 0.3) / (0.5 + Math.random() * 0.3))
    return {
      agentName: name,
      totalCalls,
      successCalls,
      rate: Number((successCalls / totalCalls * 100).toFixed(1))
    }
  }).sort((a, b) => b.successCalls - a.successCalls).slice(0, 5)

  // 地市明细表格数据 - 根据时间范围动态调整
  const cityDetails = cities.map(city => {
    // 日均基础呼叫量（根据城市规模设定不同的基础值）
    const baseDailyCalls = {
      '4401': 180, // 广州
      '4403': 200, // 深圳
      '4406': 150, // 佛山
      '4419': 160, // 东莞
    }[city.code] || (100 + Math.floor(Math.random() * 80))
    
    // 累计外呼量 = 日均呼叫量 * 天数（加入随机波动）
    const dailyVariation = 0.8 + Math.random() * 0.4 // 0.8-1.2的波动
    const totalCalls = Math.floor(baseDailyCalls * days * dailyVariation)
    
    const connectedCalls = Math.floor(totalCalls * (0.6 + Math.random() * 0.2))
    const successCalls = Math.floor(connectedCalls * (0.5 + Math.random() * 0.3))
    const avgDailySuccess = Number((successCalls / days).toFixed(1))
    const expectedRevenue = Number((successCalls * (50 + Math.random() * 100)).toFixed(2))
    // 假设每个地市有5-20个坐席（大城市坐席更多）
    const agentCount = Math.max(5, Math.floor((baseDailyCalls / 15) + Math.random() * 10))
    const avgSuccessPerAgent = Number((successCalls / agentCount).toFixed(1))
    return {
      cityCode: city.code,
      cityName: city.name,
      totalCalls,
      connectedCalls,
      successCalls,
      successRate: Number((successCalls / connectedCalls * 100).toFixed(1)),
      avgDailySuccess,
      agentCount,
      avgSuccessPerAgent,
      expectedRevenue
    }
  }).sort((a, b) => b.totalCalls - a.totalCalls)

  // 总览数据
  const overview = {
    totalCalls: trendData.reduce((sum, d) => sum + d.calls, 0),
    connectedCalls: trendData.reduce((sum, d) => sum + d.connected, 0),
    successCalls: trendData.reduce((sum, d) => sum + d.success, 0),
    qualityRate: 85.5 + Math.random() * 5,
    totalAgents: cityDetails.reduce((sum, c) => sum + c.agentCount, 0)
  }

  // 质检分布数据
  const qualityDistribution = [
    { name: '优秀', value: 35 + Math.floor(Math.random() * 10) },
    { name: '良好', value: 40 + Math.floor(Math.random() * 10) },
    { name: '合格', value: 15 + Math.floor(Math.random() * 5) },
    { name: '不合格', value: 5 + Math.floor(Math.random() * 3) }
  ]

  return {
    overview,
    trendData,
    cityRanking: cityRanking.slice(0, 5),
    agentRanking,
    cityDetails,
    qualityDistribution
  }
}

type DashboardDataResponse = {
  overview: {
    totalCalls: number
    connectedCalls: number
    successCalls: number
    qualityRate: number
    totalAgents: number
  }
  trendData: Array<{
    date: string
    calls: number
    connected: number
    success: number
    rate: number
  }>
  cityRanking: Array<{
    cityCode: string
    cityName: string
    totalCalls: number
    connectedCalls: number
    successCalls: number
    rate: number
  }>
  agentRanking: Array<{
    agentName: string
    totalCalls: number
    successCalls: number
    rate: number
  }>
  cityDetails: Array<{
    cityCode: string
    cityName: string
    totalCalls: number
    connectedCalls: number
    successCalls: number
    successRate: number
    avgDailySuccess: number
    agentCount: number
    avgSuccessPerAgent: number
    teams?: Array<any>
  }>
  qualityDistribution: Array<{ name: string; value: number }>
  dateRange: { startDate: string; endDate: string }
}

function listDays(startDate: Date, endDate: Date): string[] {
  const days: string[] = []
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    days.push(formatDateStr(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function toTimeMs(value: unknown): number {
  const text = String(value ?? '').trim()
  if (!text) return NaN
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function isWithinDateRange(ms: number, startDate: Date, endDate: Date): boolean {
  if (!Number.isFinite(ms)) return false
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return ms >= start.getTime() && ms <= end.getTime()
}

function getProjectNameFromRow(
  row: Record<string, unknown> | undefined,
  projectIdNameMap: Record<string, string>
): string {
  if (!row) return '未知项目'
  const projectId = row.projectId ?? row.project_id
  const mapped = resolveProjectName(projectId, projectIdNameMap)
  if (mapped !== '未知项目') return mapped
  const nameText = String(row.projectName ?? row.project_name ?? '').trim()
  return nameText || mapped
}

async function fetchDashboardFromCxcc(startDate: Date, endDate: Date): Promise<DashboardDataResponse> {
  const { startTime, endTime } = normalizeDateRange(startDate, endDate)
  const maxPages = Number(process.env.CXCC_BOARD_MAX_PAGES || '3') || 3
  
  // 根据时间范围读取对应的日期文件
  const startDateStr = startTime.split('T')[0]
  const endDateStr = endTime.split('T')[0]
  
  const [recordings, teamDims, agentDims, localCallLogsAll, localRecordingsAll] = await Promise.all([
    fetchAllCxccRecordsInRange({
      startTime,
      endTime,
      // 数据看板：录音清单为主数据源
      primaryPath: '/om/agentCalldetailList/selectRecordList/api',
      maxPages,
    }),
    fetchAllCxccTeams(),
    fetchAllCxccAgents(),
    readLocalCallLogsByDateRange({ startDate: startDateStr, endDate: endDateStr }),
    readLocalRecordingsByDateRange({ startDate: startDateStr, endDate: endDateStr }),
  ])

  const callLogByUuid = new Map<string, Record<string, unknown>>()
  const projectIdNameMap = getProjectIdNameMap()
  const localCallLogsRows = Array.isArray(localCallLogsAll) ? localCallLogsAll : localCallLogsAll.rows
  for (const c of localCallLogsRows) {
    const row = c as Record<string, unknown>
    const uuid = String(row.uuid ?? row.id ?? '').trim()
    if (uuid) callLogByUuid.set(uuid, row)
  }
  const localCallLogs = localCallLogsRows.filter((row: Record<string, unknown>) =>
    isWithinDateRange(toTimeMs(row.startTime), startDate, endDate)
  )
  const localRecordingsRows = Array.isArray(localRecordingsAll) ? localRecordingsAll : (localRecordingsAll as any).rows || []
  const localRecordings = localRecordingsRows.filter((row: Record<string, unknown>) =>
    isWithinDateRange(toTimeMs(row.start_time ?? row.startTime), startDate, endDate)
  )

  const recordingByUuid = new Map<string, Record<string, unknown>>()
  for (const row of recordings) {
    const raw = row as Record<string, unknown>
    const uuid = String(raw.uuid ?? '').trim()
    if (uuid) recordingByUuid.set(uuid, raw)
  }

  const teamNameById = new Map<string, string>()
  for (const t of teamDims) {
    if (t.teamId) teamNameById.set(t.teamId, t.teamName || t.teamId)
  }

  const agentByCode = new Map<string, { agentName: string; teamId: string; teamName: string }>()
  for (const a of agentDims) {
    if (!a.agentCode) continue
    const teamName = a.teamName || teamNameById.get(a.teamId) || a.teamId
    agentByCode.set(a.agentCode, {
      agentName: a.agentName || a.agentCode,
      teamId: a.teamId,
      teamName: teamName || a.teamId || '未分组',
    })
  }

  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  let totalCalls = 0
  let connectedCalls = 0
  let successCalls = 0

  const cityMap = new Map<
    string,
    {
      cityCode: string
      cityName: string
      totalCalls: number
      connectedCalls: number
      successCalls: number
      agentSet: Set<string>
    }
  >()
  const qualityDist = new Map<'优秀' | '良好' | '合格' | '不合格', number>([
    ['优秀', 0],
    ['良好', 0],
    ['合格', 0],
    ['不合格', 0],
  ])

  for (const row of recordings) {
    const raw = row as Record<string, unknown>
    const uuid = String(raw.uuid ?? '').trim()
    const callLog = uuid ? callLogByUuid.get(uuid) : undefined
    const merged = callLog ? { ...callLog, ...raw } : raw
    totalCalls += 1
    const connected = isConnectedRecord(merged)
    const success = isSuccessRecord(merged)
    if (connected) connectedCalls += 1
    if (success) successCalls += 1

    const cityCode = String(merged.city ?? merged.cityCode ?? '').trim() || '未知'
    const cityName = cityCode
    if (!cityMap.has(cityCode)) {
      cityMap.set(cityCode, {
        cityCode,
        cityName,
        totalCalls: 0,
        connectedCalls: 0,
        successCalls: 0,
        agentSet: new Set<string>(),
      })
    }
    const city = cityMap.get(cityCode)!
    city.totalCalls += 1
    if (connected) city.connectedCalls += 1
    if (success) city.successCalls += 1

    const agentCode = extractAgentCode(merged)
    if (agentCode) {
      city.agentSet.add(agentCode)
    }

    const q = qualityBucket(merged)
    qualityDist.set(q, (qualityDist.get(q) || 0) + 1)
  }

  // “总呼叫量/累计外呼量”口径改为本地累计通话文件（qms_call_log_list.json）。
  totalCalls = localCallLogs.length
  const localCityTotalCalls = new Map<string, number>()
  for (const log of localCallLogs) {
    const uuid = String(log.uuid ?? log.id ?? '').trim()
    const relatedRecording = uuid ? recordingByUuid.get(uuid) : undefined
    const cityCode =
      String(log.city ?? log.cityCode ?? relatedRecording?.city ?? relatedRecording?.cityCode ?? '').trim() || '未知'
    localCityTotalCalls.set(cityCode, (localCityTotalCalls.get(cityCode) || 0) + 1)
  }
  for (const city of cityMap.values()) {
    city.totalCalls = localCityTotalCalls.get(city.cityCode) || 0
  }

  const localRecordingByUuid = new Map<string, Record<string, unknown>>()
  for (const row of localRecordings) {
    const uuid = String(row.uuid ?? '').trim()
    if (uuid) localRecordingByUuid.set(uuid, row)
  }

  const projectTotalCalls = new Map<string, number>()
  for (const log of localCallLogs) {
    const uuid = String(log.uuid ?? log.id ?? '').trim()
    const relatedRecording = uuid ? localRecordingByUuid.get(uuid) : undefined
    const projectName = getProjectNameFromRow(relatedRecording, projectIdNameMap)
    projectTotalCalls.set(projectName, (projectTotalCalls.get(projectName) || 0) + 1)
  }

  const projectMetrics = new Map<
    string,
    { totalCalls: number; connectedCalls: number; successCalls: number; agentSet: Set<string> }
  >()
  for (const row of localRecordings) {
    const projectName = getProjectNameFromRow(row, projectIdNameMap)
    if (!projectMetrics.has(projectName)) {
      projectMetrics.set(projectName, {
        totalCalls: 0,
        connectedCalls: 0,
        successCalls: 0,
        agentSet: new Set<string>(),
      })
    }
    const metric = projectMetrics.get(projectName)!
    metric.totalCalls += 1
    const connected = isConnectedRecord(row)
    const success = isSuccessRecord(row)
    if (connected) metric.connectedCalls += 1
    if (success) metric.successCalls += 1
    const agentCode = extractAgentCode(row)
    if (agentCode) metric.agentSet.add(agentCode)
  }

  // “接通量/成功量/坐席人数”口径改为本地累计录音文件（qms_recording_list.json）。
  connectedCalls = 0
  successCalls = 0
  const localActiveAgentCodeSet = new Set<string>()
  for (const row of localRecordings) {
    const connected = isConnectedRecord(row)
    const success = isSuccessRecord(row)
    if (connected) connectedCalls += 1
    if (success) successCalls += 1
    const agentCode = extractAgentCode(row)
    if (agentCode) localActiveAgentCodeSet.add(agentCode)
  }

  // 趋势分析与“项目数据明细”同源：按天汇总本地通话 + 本地录音口径。
  const trendByDay = new Map<string, { calls: number; connected: number; success: number }>()
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const endCursor = new Date(endDate)
  endCursor.setHours(0, 0, 0, 0)
  while (cursor <= endCursor) {
    const key = formatDateStr(cursor).substring(5)
    trendByDay.set(key, { calls: 0, connected: 0, success: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const row of localCallLogs) {
    const day = dateKey(String(row.startTime ?? ''))
    if (!day) continue
    const key = day.substring(5)
    if (!trendByDay.has(key)) trendByDay.set(key, { calls: 0, connected: 0, success: 0 })
    const bucket = trendByDay.get(key)!
    bucket.calls += 1
  }
  for (const row of localRecordings) {
    const day = dateKey(String(row.start_time ?? row.startTime ?? ''))
    if (!day) continue
    const key = day.substring(5)
    if (!trendByDay.has(key)) trendByDay.set(key, { calls: 0, connected: 0, success: 0 })
    const bucket = trendByDay.get(key)!
    if (isConnectedRecord(row)) bucket.connected += 1
    if (isSuccessRecord(row)) bucket.success += 1
  }

  const trendData = Array.from(trendByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      calls: v.calls,
      connected: v.connected,
      success: v.success,
      rate: v.calls > 0 ? Number(((v.success / v.calls) * 100).toFixed(1)) : 0,
    }))

  const allProjectNames = new Set<string>([
    ...Array.from(projectMetrics.keys()),
    ...Array.from(projectTotalCalls.keys()),
  ])
  const cityDetails = Array.from(allProjectNames)
    .map((projectName) => {
      const metric = projectMetrics.get(projectName)
      const totalCallsByProject = projectTotalCalls.get(projectName) || metric?.totalCalls || 0
      const connectedCallsByProject = metric?.connectedCalls || 0
      const successCallsByProject = metric?.successCalls || 0
      const agentCount = metric?.agentSet.size || 0
      const successRate =
        totalCallsByProject > 0 ? Number(((successCallsByProject / totalCallsByProject) * 100).toFixed(1)) : 0
      const avgDailySuccess = Number((successCallsByProject / days).toFixed(1))
      const avgSuccessPerAgent = agentCount > 0 ? Number((successCallsByProject / agentCount).toFixed(1)) : 0
      return {
        cityCode: projectName,
        cityName: projectName,
        totalCalls: totalCallsByProject,
        connectedCalls: connectedCallsByProject,
        successCalls: successCallsByProject,
        successRate,
        avgDailySuccess,
        agentCount,
        avgSuccessPerAgent,
      }
    })
    .sort((a, b) => b.totalCalls - a.totalCalls)
  const cityRanking = cityDetails
    .slice()
    .sort((a, b) => b.successCalls - a.successCalls)
    .slice(0, 5)
    .map((p) => ({
      cityCode: p.cityCode,
      cityName: p.cityName,
      totalCalls: p.totalCalls,
      connectedCalls: p.connectedCalls,
      successCalls: p.successCalls,
      rate: p.successRate,
    }))

  // 坐席排名口径：来自录音清单本地累计数据（qms_recording_list.json）。
  const localAgentMap = new Map<string, { agentName: string; totalCalls: number; successCalls: number }>()
  for (const row of localRecordings) {
    const agentCode = extractAgentCode(row)
    const dim = agentByCode.get(agentCode)
    const agentName =
      dim?.agentName ||
      String(row.agent_name ?? row.agentName ?? row.agentRealName ?? (agentCode || '未知坐席'))
    if (!localAgentMap.has(agentName)) {
      localAgentMap.set(agentName, { agentName, totalCalls: 0, successCalls: 0 })
    }
    const item = localAgentMap.get(agentName)!
    item.totalCalls += 1
    if (isSuccessRecord(row)) item.successCalls += 1
  }
  const agentRanking = Array.from(localAgentMap.values())
    .map((a) => ({
      ...a,
      rate: a.totalCalls > 0 ? Number(((a.successCalls / a.totalCalls) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.successCalls - a.successCalls)
    .slice(0, 10)

  const qExcellent = qualityDist.get('优秀') || 0
  const qGood = qualityDist.get('良好') || 0
  const qPass = qualityDist.get('合格') || 0
  const qFail = qualityDist.get('不合格') || 0
  const qTotal = qExcellent + qGood + qPass + qFail
  const avgScore =
    qTotal > 0 ? (qExcellent * 9.5 + qGood * 8.5 + qPass * 7.5 + qFail * 5.5) / qTotal : 0
  const qualityRate = Number((avgScore * 10).toFixed(1))
  const qualityDistribution = [
    { name: '优秀', value: qExcellent },
    { name: '良好', value: qGood },
    { name: '合格', value: qPass },
    { name: '不合格', value: qFail },
  ]

  return {
    overview: {
      totalCalls,
      connectedCalls,
      successCalls,
      qualityRate,
      totalAgents: localActiveAgentCodeSet.size,
    },
    trendData,
    cityRanking,
    agentRanking,
    cityDetails,
    qualityDistribution,
    dateRange: {
      startDate: formatDateStr(startDate),
      endDate: formatDateStr(endDate),
    },
  }
}

async function fetchDashboardFromDailySummary(startDate: Date, endDate: Date): Promise<DashboardDataResponse> {
  const startDateStr = formatDateStr(startDate)
  const endDateStr = formatDateStr(endDate)
  const [recSummary, callSummary] = await Promise.all([
    getRecordingDailySummaryByDateRange({ startDate: startDateStr, endDate: endDateStr }),
    getCallLogDailySummaryByDateRange({ startDate: startDateStr, endDate: endDateStr })
  ])
  const days = listDays(startDate, endDate)

  let totalCalls = 0
  let connectedCalls = 0
  let successCalls = 0
  const qualityDist = { excellent: 0, good: 0, pass: 0, fail: 0 }
  const trendData: Array<{ date: string; calls: number; connected: number; success: number; rate: number }> = []

  const projectAgg = new Map<string, { total: number; connected: number; success: number; agentCodes: Set<string>; teams: Map<string, { teamId: string; teamName: string; total: number; connected: number; success: number; agentCodes: Set<string> }> }>()
  const agentAgg = new Map<string, { total: number; success: number }>()
  const activeAgentCodes = new Set<string>()

  for (const day of days) {
    const r = recSummary.days[day]
    const c = callSummary.days[day]
    const calls = c?.total || 0
    const connected = r?.connected || 0
    const success = r?.success || 0
    totalCalls += calls
    connectedCalls += connected
    successCalls += success
    if (r) {
      qualityDist.excellent += r.quality.excellent
      qualityDist.good += r.quality.good
      qualityDist.pass += r.quality.pass
      qualityDist.fail += r.quality.fail
      
      // 处理项目数据
      for (const [projectName, p] of Object.entries(r.byProject)) {
        if (!projectAgg.has(projectName)) {
          projectAgg.set(projectName, { 
            total: 0, 
            connected: 0, 
            success: 0, 
            agentCodes: new Set<string>(), 
            teams: new Map() 
          })
        }
        const b = projectAgg.get(projectName)!
        b.connected += p.connected
        b.success += p.success
        
        // 使用Set存储agentCodes，避免重复
        p.agentCodes.forEach((code) => {
          b.agentCodes.add(code)
        })
      }
      
      // 处理团队数据（使用项目中已经关联好的团队数据）
      for (const [projectName, p] of Object.entries(r.byProject)) {
        const project = projectAgg.get(projectName)!
        if (p.teams) {
          for (const [projectTeamKey, team] of p.teams.entries()) {
            if (!project.teams.has(team.teamId)) {
              project.teams.set(team.teamId, { 
                teamId: team.teamId, 
                teamName: team.teamName, 
                total: 0, 
                connected: 0, 
                success: 0, 
                agentCodes: new Set<string>() 
              })
            }
            const projectTeam = project.teams.get(team.teamId)!
            projectTeam.total += team.total
            projectTeam.connected += team.connected
            projectTeam.success += team.success
            team.agentCodes.forEach(code => {
              projectTeam.agentCodes.add(code)
            })
          }
        }
      }
      
      // 处理坐席数据
      for (const [agentCode, a] of Object.entries(r.byAgent)) {
        if (!agentAgg.has(agentCode)) agentAgg.set(agentCode, { total: 0, success: 0 })
        const b = agentAgg.get(agentCode)!
        b.total += a.total
        b.success += a.success
        activeAgentCodes.add(agentCode)
      }
    }
    
    // 处理通话数据
    if (c) {
      for (const [projectName, count] of Object.entries(c.byProjectTotal)) {
        if (!projectAgg.has(projectName)) {
          projectAgg.set(projectName, { 
            total: 0, 
            connected: 0, 
            success: 0, 
            agentCodes: new Set<string>(), 
            teams: new Map() 
          })
        }
        projectAgg.get(projectName)!.total += count
      }
    }
    
    // 添加趋势数据
    trendData.push({
      date: day.substring(5),
      calls,
      connected,
      success,
      rate: connected > 0 ? Number(((success / connected) * 100).toFixed(1)) : 0,
    })
  }

  // 生成城市详情
  const cityDetails = Array.from(projectAgg.entries())
    .map(([projectName, p]) => {
      const successRate = p.connected > 0 ? Number(((p.success / p.connected) * 100).toFixed(1)) : 0
      const avgDailySuccess = Number((p.success / Math.max(1, days.length)).toFixed(1))
      const agentCount = p.agentCodes.size
      const avgSuccessPerAgent = agentCount > 0 ? Number((p.success / agentCount).toFixed(1)) : 0
      
      // 转换团队数据为数组
      const teams = Array.from(p.teams.entries())
        .map(([teamId, team]) => {
          const teamSuccessRate = team.connected > 0 ? Number(((team.success / team.connected) * 100).toFixed(1)) : 0
          const teamAvgDailySuccess = Number((team.success / Math.max(1, days.length)).toFixed(1))
          const teamAgentCount = team.agentCodes.size
          const teamAvgSuccessPerAgent = teamAgentCount > 0 ? Number((team.success / teamAgentCount).toFixed(1)) : 0
          return {
            teamId,
            teamName: team.teamName,
            totalCalls: team.total,
            connectedCalls: team.connected,
            successCalls: team.success,
            successRate: teamSuccessRate,
            avgDailySuccess: teamAvgDailySuccess,
            agentCount: teamAgentCount,
            avgSuccessPerAgent: teamAvgSuccessPerAgent
          }
        })
        .sort((a, b) => b.successCalls - a.successCalls)
      
      return {
        cityCode: projectName,
        cityName: projectName,
        totalCalls: p.total,
        connectedCalls: p.connected,
        successCalls: p.success,
        successRate,
        avgDailySuccess,
        agentCount,
        avgSuccessPerAgent,
        teams
      }
    })
    .sort((a, b) => b.totalCalls - a.totalCalls)

  // 生成城市排名
  const cityRanking = cityDetails
    .slice()
    .sort((a, b) => b.successCalls - a.successCalls)
    .slice(0, 5)
    .map((p) => ({
      cityCode: p.cityCode,
      cityName: p.cityName,
      totalCalls: p.totalCalls,
      connectedCalls: p.connectedCalls,
      successCalls: p.successCalls,
      rate: p.successRate,
    }))

  // 生成坐席排名
  const agentRanking = Array.from(agentAgg.entries())
    .map(([agentName, a]) => ({
      agentName,
      totalCalls: a.total,
      successCalls: a.success,
      rate: a.total > 0 ? Number(((a.success / a.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.successCalls - a.successCalls)
    .slice(0, 10)

  // 计算质检分布
  const qTotal = qualityDist.excellent + qualityDist.good + qualityDist.pass + qualityDist.fail
  const avgScore =
    qTotal > 0
      ? (qualityDist.excellent * 9.5 + qualityDist.good * 8.5 + qualityDist.pass * 7.5 + qualityDist.fail * 5.5) / qTotal
      : 0
  const qualityRate = Number((avgScore * 10).toFixed(1))

  return {
    overview: {
      totalCalls,
      connectedCalls,
      successCalls,
      qualityRate,
      totalAgents: activeAgentCodes.size,
    },
    trendData,
    cityRanking,
    agentRanking,
    cityDetails,
    qualityDistribution: [
      { name: '优秀', value: qualityDist.excellent },
      { name: '良好', value: qualityDist.good },
      { name: '合格', value: qualityDist.pass },
      { name: '不合格', value: qualityDist.fail },
    ],
    dateRange: {
      startDate: formatDateStr(startDate),
      endDate: formatDateStr(endDate),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    // 使用 request.nextUrl.searchParams 直接获取查询参数，避免使用 request.url
    const startDateStr = request.nextUrl.searchParams.get('startDate')
    const endDateStr = request.nextUrl.searchParams.get('endDate')

    let startDate = parseDateParam(startDateStr) ?? new Date()
    let endDate = parseDateParam(endDateStr) ?? new Date()

    // 如果没有提供日期，默认查询今天
    if (!startDateStr && !endDateStr) {
      startDate = new Date()
      endDate = new Date(startDate)
    }

    // 验证日期
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: '无效的日期格式' },
        { status: 400 }
      )
    }

    // 确保开始日期不大于结束日期
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate]
    }

    const cacheKey = `start=${formatDateStr(startDate)}|end=${formatDateStr(endDate)}`
    const data = await getCachedQueryResult<DashboardDataResponse>(
      'dashboard.statistics',
      cacheKey,
      async () => {
        try {
          return await fetchDashboardFromDailySummary(startDate, endDate)
        } catch (e) {
          if (isRealDataOnly()) {
            throw e
          }
          try {
            return await fetchDashboardFromCxcc(startDate, endDate)
          } catch (inner) {
            // eslint-disable-next-line no-console
            console.warn('[dashboard/statistics] local aggregation failed, fallback to mock:', inner)
            return generateMockData(startDate, endDate) as any
          }
        }
      },
      getRouteCacheTtlMs(15000)
    )

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data: {
        ...(data as any),
        dateRange: {
          startDate: formatDateStr(startDate),
          endDate: formatDateStr(endDate),
        },
      } as DashboardDataResponse
    })
  } catch (error: any) {
    if (isRealDataOnly()) {
      return NextResponse.json(
        {
          code: 503,
          error: 'REAL_DATA_UNAVAILABLE',
          message:
            'DATA_SOURCE_MODE=real：数据看板按“录音清单主表 + 通话清单/外呼团队/坐席设置”聚合，请检查本地同步文件可用性。',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: error.message || '查询失败' },
      { status: 500 }
    )
  }
}
