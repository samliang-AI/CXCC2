import { NextRequest, NextResponse } from 'next/server'

import {
  isSuccessRecord,
} from '@/lib/cxcc-boards'
import { isRealDataOnly } from '@/lib/data-source-config'
import { getProjectIdNameMap, resolveProjectName } from '@/lib/project-id-name-map'
import { readLocalAgents, readLocalCallLogs, readLocalTeams, readLocalCallLogsByDateRange } from '@/lib/local-recording-store'
import { getCachedQueryResult, getRouteCacheTtlMs } from '@/lib/route-query-cache'
import { getCallLogDailySummary, getCallLogDailySummaryByDateRange } from '@/lib/daily-aggregate-store'

function formatDateLocal(d: Date): string {
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
const projectIdNameMap = getProjectIdNameMap()
const projects = Object.entries(projectIdNameMap).map(([code, name]) => ({ code, name }))

// 团队列表
const teams = [
  { id: 'T001', name: '广东升档组-登封' },
  { id: 'T002', name: '广东升档组-云晟' },
  { id: 'T003', name: '广东升档组-如皓' },
  { id: 'T004', name: '广东升档组-诚聚' },
  { id: 'T005', name: '广东升档组-佳硕' },
  { id: 'T006', name: '广东升档组-聚能' },
  { id: 'T007', name: '佛山升档组-腾飞' },
  { id: 'T008', name: '深圳升档组-飞越' }
]

// 坐席列表
const agents = [
  { code: 'A001', name: '林宇君', teamId: 'T001' },
  { code: 'A002', name: '刘土梅', teamId: 'T001' },
  { code: 'A003', name: '张小明', teamId: 'T002' },
  { code: 'A004', name: '李小红', teamId: 'T002' },
  { code: 'A005', name: '王大伟', teamId: 'T003' },
  { code: 'A006', name: '陈小芳', teamId: 'T003' },
  { code: 'A007', name: '赵大力', teamId: 'T004' },
  { code: 'A008', name: '周小敏', teamId: 'T004' },
  { code: 'A009', name: '吴小华', teamId: 'T005' },
  { code: 'A010', name: '郑小强', teamId: 'T005' },
  { code: 'A011', name: '黄小燕', teamId: 'T006' },
  { code: 'A012', name: '杨小龙', teamId: 'T006' },
  { code: 'A013', name: '何小军', teamId: 'T007' },
  { code: 'A014', name: '罗小玲', teamId: 'T007' },
  { code: 'A015', name: '马小虎', teamId: 'T008' },
  { code: 'A016', name: '朱小娟', teamId: 'T008' }
]

// 类型列表
const keyInfoList = [
  { code: '1', name: '类型1' },
  { code: '2', name: '类型2' },
  { code: '3', name: '类型3' },
  { code: '4', name: '类型4' },
  { code: '5', name: '类型5' },
  { code: '6', name: '类型6' },
  { code: '7', name: '类型7' },
  { code: '8', name: '类型8' },
  { code: '9', name: '类型9' },
  { code: '0', name: '类型0' },
  { code: '*', name: '类型*' },
  { code: '#', name: '类型#' },
  { code: '', name: '无类型' }
]

// 模拟通话清单数据（实际应该从数据库查询）
interface CallRecord {
  id: string
  agentCode: string
  agentName: string
  teamId: string
  teamName: string
  cityCode: string
  cityName: string
  keyInfo: string
  callTime: Date
  callDuration: number
  isConnected: boolean
  isSuccess: boolean
}

// 生成模拟通话清单数据
function generateMockCallRecords(
  startDate: Date,
  endDate: Date,
  filterTeamId?: string,
  filterAgentCode?: string
): CallRecord[] {
  const records: CallRecord[] = []
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // 根据筛选条件确定要生成的坐席
  let targetAgents = agents
  if (filterAgentCode) {
    targetAgents = agents.filter(a => a.code === filterAgentCode)
  } else if (filterTeamId) {
    targetAgents = agents.filter(a => a.teamId === filterTeamId)
  }

  // 每个坐席每天的通话量基础值
  const baseCallsPerDay = 50

  targetAgents.forEach(agent => {
    const team = teams.find(t => t.id === agent.teamId)
    
    for (let d = 0; d < days; d++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + d)
      
      // 当天通话量（添加随机波动）
      const callsToday = Math.floor(baseCallsPerDay * (0.8 + Math.random() * 0.4))
      
      for (let i = 0; i < callsToday; i++) {
        const isConnected = Math.random() > 0.55 // 45%接通率
        const isSuccess = isConnected && Math.random() > 0.85 // 接通中15%成功
        
        // 随机分配类型
        const keyIndex = Math.floor(Math.random() * keyInfoList.length)
        const keyInfo = keyInfoList[keyIndex].code
        
        // 随机分配地市
        const cityIndex = Math.floor(Math.random() * cities.length)
        const city = cities[cityIndex]

        const callTime = new Date(date)
        callTime.setHours(8 + Math.floor(Math.random() * 10))
        callTime.setMinutes(Math.floor(Math.random() * 60))

        records.push({
          id: `call_${records.length}`,
          agentCode: agent.code,
          agentName: agent.name,
          teamId: agent.teamId,
          teamName: team?.name || '',
          cityCode: city.code,
          cityName: city.name,
          keyInfo,
          callTime,
          callDuration: isConnected ? Math.floor(30 + Math.random() * 180) : Math.floor(15 + Math.random() * 45),
          isConnected,
          isSuccess
        })
      }
    }
  })

  return records
}

// 按类型分组统计
function aggregateByKeyInfo(
  records: CallRecord[],
  filterTeamId?: string,
  filterAgentCode?: string
) {
  // 获取团队名称和坐席名称
  let teamName = ''
  let agentName = ''
  
  if (filterAgentCode) {
    const agent = agents.find(a => a.code === filterAgentCode)
    if (agent) {
      agentName = agent.name
      teamName = teams.find(t => t.id === agent.teamId)?.name || ''
    }
  } else if (filterTeamId) {
    teamName = teams.find(t => t.id === filterTeamId)?.name || ''
  }

  // 按类型分组
  const groupedData = new Map<string, {
    keyInfo: string
    totalCalls: number
    connectedCalls: number
    noAnswerCalls: number
    successCalls: number
    totalDuration: number
    cityStats: Map<string, { totalCalls: number; connectedCalls: number; successCalls: number }>
    teamStats: Map<string, { totalCalls: number; connectedCalls: number; successCalls: number }>
  }>()

  // 初始化所有类型
  keyInfoList.forEach(key => {
    groupedData.set(key.code, {
      keyInfo: key.code,
      totalCalls: 0,
      connectedCalls: 0,
      noAnswerCalls: 0,
      successCalls: 0,
      totalDuration: 0,
      cityStats: new Map(),
      teamStats: new Map()
    })
  })

  // 统计数据
  records.forEach(record => {
    const stats = groupedData.get(record.keyInfo)
    if (stats) {
      stats.totalCalls++
      if (record.isConnected) {
        stats.connectedCalls++
        stats.totalDuration += record.callDuration
      } else {
        stats.noAnswerCalls++
      }
      if (record.isSuccess) {
        stats.successCalls++
      }

      // 地市统计
      const cityStats = stats.cityStats.get(record.cityCode) || { totalCalls: 0, connectedCalls: 0, successCalls: 0 }
      cityStats.totalCalls++
      if (record.isConnected) cityStats.connectedCalls++
      if (record.isSuccess) cityStats.successCalls++
      stats.cityStats.set(record.cityCode, cityStats)

      // 团队统计
      const teamStats = stats.teamStats.get(record.teamId) || { totalCalls: 0, connectedCalls: 0, successCalls: 0 }
      teamStats.totalCalls++
      if (record.isConnected) teamStats.connectedCalls++
      if (record.isSuccess) teamStats.successCalls++
      stats.teamStats.set(record.teamId, teamStats)
    }
  })

  // 转换为数组格式
  const keyInfoDetails = Array.from(groupedData.values())
    .filter(stats => stats.totalCalls > 0) // 只返回有数据的类型
    .map(stats => {
      const keyInfo = keyInfoList.find(k => k.code === stats.keyInfo)
      
      // 转换地市统计
      const cityDetails = Array.from(stats.cityStats.entries())
        .map(([cityCode, data]) => ({
          cityName: cities.find(c => c.code === cityCode)?.name || cityCode,
          ...data
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 5)

      // 转换团队统计
      const teamDetails = Array.from(stats.teamStats.entries())
        .map(([teamId, data]) => ({
          teamName: teams.find(t => t.id === teamId)?.name || teamId,
          ...data
        }))
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .slice(0, 4)

      return {
        keyInfo: stats.keyInfo,
        keyName: keyInfo?.name || '未知',
        teamName,
        agentName,
        totalCalls: stats.totalCalls,
        connectedCalls: stats.connectedCalls,
        noAnswerCalls: stats.noAnswerCalls,
        connectRate: stats.totalCalls > 0 ? Number((stats.connectedCalls / stats.totalCalls * 100).toFixed(1)) : 0,
        successCalls: stats.successCalls,
        successRate: stats.connectedCalls > 0 ? Number((stats.successCalls / stats.connectedCalls * 100).toFixed(1)) : 0,
        avgCallDuration: stats.connectedCalls > 0 ? Math.round(stats.totalDuration / stats.connectedCalls) : 0,
        cityDetails,
        teamDetails
      }
    })
    .sort((a, b) => b.totalCalls - a.totalCalls)

  return keyInfoDetails
}

// 主函数：生成统计数据
function generateStatistics(
  startDate: Date,
  endDate: Date,
  projectName?: string,
  teamId?: string,
  agentCode?: string,
  connectStatus?: string,
  keyInfoFilter?: string
) {
  // 1. 从通话清单获取数据
  let records = generateMockCallRecords(startDate, endDate, teamId, agentCode)

  // 2. 应用其他筛选条件
  if (projectName) {
    // mock 数据按“项目名称”筛选时，仅作为条件占位，不影响结构
    records = records.filter(r => r.cityName === projectName)
  }

  if (connectStatus) {
    if (connectStatus === 'connected') {
      records = records.filter(r => r.isConnected)
    } else if (connectStatus === 'noAnswer') {
      records = records.filter(r => !r.isConnected)
    }
  }

  // 3. 按类型分组统计
  let keyInfoDetails = aggregateByKeyInfo(records, teamId, agentCode)

  // 4. 如果指定了类型，只返回该类型
  if (keyInfoFilter) {
    keyInfoDetails = keyInfoDetails.filter(k => k.keyInfo === keyInfoFilter)
  }

  // 5. 计算概览数据
  const overview = {
    totalCalls: keyInfoDetails.reduce((sum, k) => sum + k.totalCalls, 0),
    connectedCalls: keyInfoDetails.reduce((sum, k) => sum + k.connectedCalls, 0),
    noAnswerCalls: keyInfoDetails.reduce((sum, k) => sum + k.noAnswerCalls, 0),
    successCalls: keyInfoDetails.reduce((sum, k) => sum + k.successCalls, 0)
  }

  return {
    overview,
    keyInfoDetails,
    filterData: {
      projects,
      teams,
      agents,
      keyInfoList
    },
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate)
    }
  }
}

function toTimeMs(v: unknown): number {
  const text = String(v ?? '').trim()
  if (!text) return NaN
  const normalized = text.includes('T') ? text : text.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function isConnectedByStatus(r: Record<string, unknown>): boolean {
  return String(r.connectStatus ?? '').trim() === '已接通'
}

async function buildTypeFilterFromLocal(
  startDate: Date,
  endDate: Date,
  projectName?: string | null,
  teamId?: string | null,
  agentCode?: string | null,
  connectStatus?: string | null,
  keyInfoFilter?: string | null
) {
  const startDateStr = formatDateLocal(startDate)
  const endDateStr = formatDateLocal(endDate)
  
  const [callLogsResult, teamsLocal, agentsLocal] = await Promise.all([
    readLocalCallLogsByDateRange({ startDate: startDateStr, endDate: endDateStr }),
    readLocalTeams(),
    readLocalAgents(),
  ])
  const callLogs = Array.isArray(callLogsResult) ? callLogsResult : callLogsResult.rows

  const startMs = new Date(startDate).setHours(0, 0, 0, 0)
  const endMs = new Date(endDate).setHours(23, 59, 59, 999)

  const agentMap = new Map<string, { name: string; teamId: string; teamName: string }>()
  for (const a of agentsLocal as Array<Record<string, unknown>>) {
    const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
    if (!code) continue
    const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
    const tname = String(a.skillGroupName ?? a.teamName ?? tid).trim() || tid || '未分组'
    const name = String(a.name ?? a.agentName ?? a.realname ?? code).trim() || code
    agentMap.set(code, { name, teamId: tid, teamName: tname })
  }

  const rows = (callLogs as Array<Record<string, unknown>>).filter((r) => {
    const ts = toTimeMs(r.startTime)
    if (!Number.isFinite(ts) || ts < startMs || ts > endMs) return false
    if (projectName) {
      const pName = resolveProjectName(r.projectId ?? r.project_id, projectIdNameMap)
      if (pName !== projectName) return false
    }
    if (agentCode) {
      const code = String(r.agentCode ?? '').trim()
      if (code !== agentCode) return false
    }
    if (teamId) {
      const code = String(r.agentCode ?? '').trim()
      const ag = agentMap.get(code)
      if (ag?.teamId !== teamId) return false
    }
    if (connectStatus === 'connected' && !isConnectedByStatus(r)) return false
    if (connectStatus === 'noAnswer' && isConnectedByStatus(r)) return false
    const key = String(r.keyInfo ?? '').trim()
    if (keyInfoFilter && key !== keyInfoFilter) return false
    return true
  })

  const byKey = new Map<
    string,
    {
      total: number
      connected: number
      success: number
      durationSum: number
      cityMap: Map<string, { total: number; connected: number; success: number }>
      teamMap: Map<string, { total: number; connected: number; success: number }>
    }
  >()

  for (const r of rows) {
    const keyInfoCode = String(r.keyInfo ?? '').trim()
    if (!byKey.has(keyInfoCode)) {
      byKey.set(keyInfoCode, {
        total: 0,
        connected: 0,
        success: 0,
        durationSum: 0,
        cityMap: new Map(),
        teamMap: new Map(),
      })
    }
    const bucket = byKey.get(keyInfoCode)!
    bucket.total += 1
    const connected = isConnectedByStatus(r)
    const success = isSuccessRecord(r) || String(r.callStatus ?? '').includes('接通')
    const duration = Number(r.answerDuration ?? r.callDuration ?? 0)
    const safeDuration = Number.isFinite(duration) ? duration : 0
    if (connected) {
      bucket.connected += 1
      bucket.durationSum += safeDuration
    }
    if (success) bucket.success += 1

    const cityName = String(r.cityName ?? r.city ?? r.cityCode ?? '未知').trim() || '未知'
    if (!bucket.cityMap.has(cityName)) {
      bucket.cityMap.set(cityName, { total: 0, connected: 0, success: 0 })
    }
    const c = bucket.cityMap.get(cityName)!
    c.total += 1
    if (connected) c.connected += 1
    if (success) c.success += 1

    const code = String(r.agentCode ?? '').trim()
    const ag = agentMap.get(code)
    const teamName = ag?.teamName || '未分组'
    if (!bucket.teamMap.has(teamName)) {
      bucket.teamMap.set(teamName, { total: 0, connected: 0, success: 0 })
    }
    const t = bucket.teamMap.get(teamName)!
    t.total += 1
    if (connected) t.connected += 1
    if (success) t.success += 1
  }

  const keyInfoDetails = Array.from(byKey.entries())
    .map(([keyCode, b]) => {
      const keyName = keyCode ? `类型${keyCode}` : '无类型'
      const cityDetails = Array.from(b.cityMap.entries())
        .map(([cityName, c]) => ({ cityName, ...c }))
        .sort((x, y) => y.total - x.total)
        .slice(0, 5)
      const teamDetails = Array.from(b.teamMap.entries())
        .map(([teamName, t]) => ({ teamName, ...t }))
        .sort((x, y) => y.total - x.total)
        .slice(0, 4)
      return {
        keyInfo: keyCode,
        keyName,
        teamName: '',
        agentName: '',
        totalCalls: b.total,
        connectedCalls: b.connected,
        noAnswerCalls: b.total - b.connected,
        connectRate: b.total > 0 ? Number(((b.connected / b.total) * 100).toFixed(1)) : 0,
        successCalls: b.success,
        successRate: b.connected > 0 ? Number(((b.success / b.connected) * 100).toFixed(1)) : 0,
        avgCallDuration: b.connected > 0 ? Math.round(b.durationSum / b.connected) : 0,
        cityDetails,
        teamDetails,
      }
    })
    .sort((a, b) => b.totalCalls - a.totalCalls)

  const overview = {
    totalCalls: keyInfoDetails.reduce((s, k) => s + k.totalCalls, 0),
    connectedCalls: keyInfoDetails.reduce((s, k) => s + k.connectedCalls, 0),
    noAnswerCalls: keyInfoDetails.reduce((s, k) => s + k.noAnswerCalls, 0),
    successCalls: keyInfoDetails.reduce((s, k) => s + k.successCalls, 0),
  }

  const projectsFromRows = Array.from(
    new Map(
      rows
        .map((r) => {
          const projectId = String(r.projectId ?? r.project_id ?? '').trim()
          if (!projectId) return null
          const name = resolveProjectName(projectId, projectIdNameMap)
          if (!name || name === '未知项目') return null
          return [projectId, { code: projectId, name }] as const
        })
        .filter(Boolean) as Array<readonly [string, { code: string; name: string }]>
    ).values()
  )
  const teamsFromLocal = Array.from(
    new Map(
      (teamsLocal as Array<Record<string, unknown>>)
        .map((t) => {
          const id = String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim()
          const name = String(t.skillGroupName ?? t.name ?? t.teamName ?? id).trim()
          if (!id) return null
          return [id, { id, name: name || id }] as const
        })
        .filter(Boolean) as Array<readonly [string, { id: string; name: string }]>
    ).values()
  )
  const agentsFromLocal = Array.from(
    new Map(
      Array.from(agentMap.entries()).map(([code, a]) => [
        code,
        { code, name: a.name || code, teamId: a.teamId || '' },
      ] as const)
    ).values()
  )
  const keyInfoList = keyInfoDetails.map((k) => ({ code: k.keyInfo, name: k.keyName }))

  return {
    overview,
    keyInfoDetails,
    filterData: {
      projects: projectsFromRows,
      teams: teamsFromLocal,
      agents: agentsFromLocal,
      keyInfoList,
    },
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
    },
  }
}

async function buildTypeFilterFromCallLogSummary(startDate: Date, endDate: Date) {
  const startDateStr = formatDateLocal(startDate)
  const endDateStr = formatDateLocal(endDate)
  const summary = await getCallLogDailySummaryByDateRange({ startDate: startDateStr, endDate: endDateStr })
  const byKey = new Map<
    string,
    {
      total: number
      connected: number
      success: number
      durationSum: number
      byCity: Map<string, { total: number; connected: number; success: number }>
      byTeam: Map<string, { total: number; connected: number; success: number }>
    }
  >()
  const projects = new Set<string>()

  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const day = formatDateLocal(cursor)
    const bucket = summary.days[day]
    if (bucket) {
      Object.keys(bucket.byProjectTotal).forEach((p) => {
        if (p && p !== '未知项目') projects.add(p)
      })
      for (const [key, s] of Object.entries(bucket.byKey)) {
        if (!byKey.has(key)) {
          byKey.set(key, {
            total: 0,
            connected: 0,
            success: 0,
            durationSum: 0,
            byCity: new Map(),
            byTeam: new Map(),
          })
        }
        const agg = byKey.get(key)!
        agg.total += s.total
        agg.connected += s.connected
        agg.success += s.success
        agg.durationSum += s.durationSum
        for (const [cityName, c] of Object.entries(s.byCity)) {
          if (!agg.byCity.has(cityName)) agg.byCity.set(cityName, { total: 0, connected: 0, success: 0 })
          const b = agg.byCity.get(cityName)!
          b.total += c.total
          b.connected += c.connected
          b.success += c.success
        }
        for (const [teamName, t] of Object.entries(s.byTeam)) {
          if (!agg.byTeam.has(teamName)) agg.byTeam.set(teamName, { total: 0, connected: 0, success: 0 })
          const b = agg.byTeam.get(teamName)!
          b.total += t.total
          b.connected += t.connected
          b.success += t.success
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  const keyInfoDetails = Array.from(byKey.entries())
    .map(([keyCode, b]) => ({
      keyInfo: keyCode,
      keyName: keyCode ? `类型${keyCode}` : '无类型',
      teamName: '',
      agentName: '',
      totalCalls: b.total,
      connectedCalls: b.connected,
      noAnswerCalls: b.total - b.connected,
      connectRate: b.total > 0 ? Number(((b.connected / b.total) * 100).toFixed(1)) : 0,
      successCalls: b.success,
      successRate: b.connected > 0 ? Number(((b.success / b.connected) * 100).toFixed(1)) : 0,
      avgCallDuration: b.connected > 0 ? Math.round(b.durationSum / b.connected) : 0,
      cityDetails: Array.from(b.byCity.entries())
        .map(([cityName, c]) => ({ cityName, totalCalls: c.total, connectedCalls: c.connected, successCalls: c.success }))
        .sort((x, y) => y.totalCalls - x.totalCalls)
        .slice(0, 5),
      teamDetails: Array.from(b.byTeam.entries())
        .map(([teamName, t]) => ({ teamName, totalCalls: t.total, connectedCalls: t.connected, successCalls: t.success }))
        .sort((x, y) => y.totalCalls - x.totalCalls)
        .slice(0, 4),
    }))
    .sort((a, b) => b.totalCalls - a.totalCalls)

  const overview = {
    totalCalls: keyInfoDetails.reduce((s, k) => s + k.totalCalls, 0),
    connectedCalls: keyInfoDetails.reduce((s, k) => s + k.connectedCalls, 0),
    noAnswerCalls: keyInfoDetails.reduce((s, k) => s + k.noAnswerCalls, 0),
    successCalls: keyInfoDetails.reduce((s, k) => s + k.successCalls, 0),
  }

  // 从项目ID名称映射中获取项目选项
  const projectOptions = Object.entries(projectIdNameMap)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    overview,
    keyInfoDetails,
    filterData: {
      projects: projectOptions,
      teams,
      agents,
      keyInfoList: keyInfoDetails.map((k) => ({ code: k.keyInfo, name: k.keyName })),
    },
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const projectName = searchParams.get('projectName') || searchParams.get('cityCode')
    const teamId = searchParams.get('teamId')
    const agentCode = searchParams.get('agentCode')
    const connectStatus = searchParams.get('connectStatus')
    const keyInfo = searchParams.get('keyInfo')

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

    try {
      const cacheKey = `start=${formatDateLocal(startDate)}|end=${formatDateLocal(endDate)}|project=${projectName || 'all'}|team=${teamId || 'all'}|agent=${agentCode || 'all'}|connect=${
        connectStatus || 'all'
      }|key=${keyInfo || 'all'}`
      const data = await getCachedQueryResult<any>(
        'reports.type-filter.statistics',
        cacheKey,
        () =>
          !projectName && !teamId && !agentCode && !connectStatus && !keyInfo
            ? buildTypeFilterFromCallLogSummary(startDate, endDate)
            : buildTypeFilterFromLocal(
                startDate,
                endDate,
                projectName,
                teamId,
                agentCode,
                connectStatus,
                keyInfo
              ),
        getRouteCacheTtlMs(15000)
      )
      return NextResponse.json({
        code: 200,
        message: '查询成功',
        data,
      })
    } catch (e) {
      if (isRealDataOnly()) {
        return NextResponse.json(
          {
            code: 503,
            error: 'LOCAL_DATA_UNAVAILABLE',
            message: '类型筛选统计来源于本地通话清单，请检查 qms_call_log_list.json / qms_team_list.json / qms_agent_list.json 可读性。',
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 503 }
        )
      }
    }

    // 生成统计数据（模拟从通话清单查询）
    const data = generateStatistics(
      startDate,
      endDate,
      projectName || undefined,
      teamId || undefined,
      agentCode || undefined,
      connectStatus || undefined,
      keyInfo || undefined
    )

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data
    })
  } catch (error) {
    console.error('Failed to fetch type filter statistics:', error)
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
