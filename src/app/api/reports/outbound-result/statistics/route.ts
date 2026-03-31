import { NextRequest, NextResponse } from 'next/server'

import {
  isConnectedRecord,
} from '@/lib/cxcc-boards'
import { isRealDataOnly } from '@/lib/data-source-config'
import { getProjectIdNameMap, resolveProjectName } from '@/lib/project-id-name-map'
import { readLocalAgents, readLocalRecordingsRaw, readLocalTeams, readLocalRecordingsByDateRange } from '@/lib/local-recording-store'
import { getCachedQueryResult, getRouteCacheTtlMs } from '@/lib/route-query-cache'
import { getRecordingDailySummary, getRecordingDailySummaryByDateRange } from '@/lib/daily-aggregate-store'

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

// 模拟生成外呼结果统计数据
function generateMockData(startDate: Date, endDate: Date, projectName?: string, teamId?: string, agentCode?: string) {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // 根据天数调整基础数量
  const baseMultiplier = days / 7 // 以7天为基准

  // 根据筛选条件调整系数
  let filterMultiplier = 1
  if (agentCode) {
    filterMultiplier = 0.06 // 单个坐席
  } else if (teamId) {
    filterMultiplier = 0.12 // 单个团队
  } else if (projectName) {
    filterMultiplier = 0.15 // 单个项目
  }

  // 客户状态数据 - 基于图片中的数据比例
  const statusData = [
    { status: '成功客户', count: Math.floor(5 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: false },
    { status: '高频骚扰', count: Math.floor(6 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: true },
    { status: '开场拒访', count: Math.floor(634 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: true },
    { status: '秒挂无声', count: Math.floor(740 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: true },
    { status: '失败客户', count: Math.floor(679 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: true },
    { status: '验证码失败', count: Math.floor(2 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: false },
    { status: '语音助手', count: Math.floor(510 * baseMultiplier * filterMultiplier * (0.8 + Math.random() * 0.4)), isHighlight: true }
  ]

  // 计算总数
  const total = statusData.reduce((sum, item) => sum + item.count, 0)

  // 计算占比
  const statusDetails = statusData.map(item => ({
    status: item.status,
    count: item.count,
    percentage: total > 0 ? Number((item.count / total * 100).toFixed(1)) : 0,
    isHighlight: item.isHighlight
  }))

  // 计算概览数据
  const successItem = statusDetails.find(s => s.status === '成功客户')!
  const failItem = statusDetails.find(s => s.status === '失败客户')!
  
  const overview = {
    totalCalls: total,
    connectedCalls: Math.floor(total * 0.6),
    successRate: successItem.percentage,
    failRate: failItem.percentage,
    noAnswerRate: statusDetails
      .filter(s => ['秒挂无声', '开场拒访', '语音助手'].includes(s.status))
      .reduce((sum, s) => sum + s.percentage, 0)
  }

  return {
    overview,
    statusDetails,
    filterData: {
      projects,
      teams,
      agents
    },
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate)
    }
  }
}

async function buildOutboundResultFromLocal(
  startDate: Date,
  endDate: Date,
  projectName?: string | null,
  teamId?: string | null,
  agentCode?: string | null
) {
  const startDateStr = formatDateLocal(startDate)
  const endDateStr = formatDateLocal(endDate)
  
  const [recordings, teamsLocal, agentsLocal] = await Promise.all([
    readLocalRecordingsByDateRange({ startDate: startDateStr, endDate: endDateStr }),
    readLocalTeams(),
    readLocalAgents(),
  ])

  const startMs = new Date(startDate).setHours(0, 0, 0, 0)
  const endMs = new Date(endDate).setHours(23, 59, 59, 999)
  const baseRows = recordings.filter((r) => {
    const t = r.start_time ? new Date(r.start_time).getTime() : NaN
    return Number.isFinite(t) && t >= startMs && t <= endMs
  })

  const agentToTeam = new Map<string, string>()
  const agentOptions = Array.from(
    new Map(
      (agentsLocal as Array<Record<string, unknown>>)
        .map((a) => {
          const code = String(a.username ?? a.agent ?? a.agentNo ?? a.workNumber ?? '').trim()
          const name = String(a.name ?? a.agentName ?? a.realname ?? code).trim()
          const tid = String(a.skillgroupId ?? a.teamId ?? '').trim()
          if (!code) return null
          agentToTeam.set(code, tid)
          return [code, { code, name: name || code, teamId: tid }] as const
        })
        .filter(Boolean) as Array<readonly [string, { code: string; name: string; teamId: string }]>
    ).values()
  )

  const teamOptions = Array.from(
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

  const projectOptions = Array.from(
    new Map(
      baseRows
        .map((r) => {
          const projectId = String(r.project_id ?? '').trim()
          if (!projectId) return null
          const name = resolveProjectName(projectId, projectIdNameMap)
          if (!name || name === '未知项目') return null
          return [projectId, { code: projectId, name }] as const
        })
        .filter(Boolean) as Array<readonly [string, { code: string; name: string }]>
    ).values()
  )

  let rows = baseRows as Array<Record<string, unknown>>
  if (projectName) {
    // 检查projectName是projectId还是项目名称
    const isProjectId = !isNaN(Number(projectName))
    if (isProjectId) {
      // 如果是projectId，直接匹配
      rows = rows.filter((r) => String(r.project_id ?? '').trim() === projectName)
    } else {
      // 如果是项目名称，通过解析后的名称匹配
      rows = rows.filter((r) => resolveProjectName(r.project_id, projectIdNameMap) === projectName)
    }
  }
  if (teamId) {
    rows = rows.filter((r) => {
      const code = String(r.agent ?? '').trim()
      return agentToTeam.get(code) === teamId
    })
  }
  if (agentCode) {
    rows = rows.filter((r) => String(r.agent ?? '').trim() === agentCode)
  }

  const statusCounts = new Map<string, number>()
  for (const name of ['成功客户', '高频骚扰', '开场拒访', '秒挂无声', '失败客户', '验证码失败', '语音助手', '办理互斥', '未标记']) {
    statusCounts.set(name, 0)
  }
  for (const r of rows) {
    const name = String(r.status_name ?? r.statusName ?? '未标记').trim() || '未标记'
    statusCounts.set(name, (statusCounts.get(name) ?? 0) + 1)
  }

  const statusDetails = [
    { status: '成功客户', count: statusCounts.get('成功客户') ?? 0, isHighlight: false },
    { status: '高频骚扰', count: statusCounts.get('高频骚扰') ?? 0, isHighlight: true },
    { status: '开场拒访', count: statusCounts.get('开场拒访') ?? 0, isHighlight: true },
    { status: '秒挂无声', count: statusCounts.get('秒挂无声') ?? 0, isHighlight: true },
    { status: '失败客户', count: statusCounts.get('失败客户') ?? 0, isHighlight: true },
    { status: '验证码失败', count: statusCounts.get('验证码失败') ?? 0, isHighlight: false },
    { status: '语音助手', count: statusCounts.get('语音助手') ?? 0, isHighlight: true },
    { status: '办理互斥', count: statusCounts.get('办理互斥') ?? 0, isHighlight: false },
    { status: '未标记', count: statusCounts.get('未标记') ?? 0, isHighlight: false },
  ].filter((s) => s.count > 0)

  const total = rows.length
  const connectedCount = rows.reduce((sum, row) => (isConnectedRecord(row) ? sum + 1 : sum), 0)
  const withPct = statusDetails.map((s) => ({
    ...s,
    percentage: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
  }))

  const successItem = withPct.find((s) => s.status === '成功客户') || { percentage: 0 }
  const failItem = withPct.find((s) => s.status === '失败客户') || { percentage: 0 }
  const noAnswerRate = withPct
    .filter((s) => ['秒挂无声', '开场拒访', '语音助手'].includes(s.status))
    .reduce((sum, s) => sum + s.percentage, 0)

  return {
    overview: {
      totalCalls: total,
      connectedCalls: connectedCount,
      successRate: successItem.percentage,
      failRate: failItem.percentage,
      noAnswerRate,
    },
    statusDetails: withPct,
    filterData: { projects: projectOptions, teams: teamOptions, agents: agentOptions },
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
    },
  }
}

async function buildOutboundResultFromRecordingSummary(startDate: Date, endDate: Date) {
  const startDateStr = formatDateLocal(startDate)
  const endDateStr = formatDateLocal(endDate)
  const summary = await getRecordingDailySummaryByDateRange({ startDate: startDateStr, endDate: endDateStr })
  const statusCounts = new Map<string, number>()
  let total = 0
  let connectedCount = 0
  const projectSet = new Set<string>()

  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    const day = formatDateLocal(cursor)
    const bucket = summary.days[day]
    if (bucket) {
      total += bucket.total
      connectedCount += bucket.connected
      for (const [statusName, count] of Object.entries(bucket.statusCounts)) {
        statusCounts.set(statusName, (statusCounts.get(statusName) ?? 0) + count)
      }
      Object.keys(bucket.byProject).forEach((p) => {
        if (p && p !== '未知项目') projectSet.add(p)
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  const statusDetails = [
    { status: '成功客户', count: statusCounts.get('成功客户') ?? 0, isHighlight: false },
    { status: '高频骚扰', count: statusCounts.get('高频骚扰') ?? 0, isHighlight: true },
    { status: '开场拒访', count: statusCounts.get('开场拒访') ?? 0, isHighlight: true },
    { status: '秒挂无声', count: statusCounts.get('秒挂无声') ?? 0, isHighlight: true },
    { status: '失败客户', count: statusCounts.get('失败客户') ?? 0, isHighlight: true },
    { status: '验证码失败', count: statusCounts.get('验证码失败') ?? 0, isHighlight: false },
    { status: '语音助手', count: statusCounts.get('语音助手') ?? 0, isHighlight: true },
    { status: '办理互斥', count: statusCounts.get('办理互斥') ?? 0, isHighlight: false },
    { status: '未标记', count: statusCounts.get('未标记') ?? 0, isHighlight: false },
  ].filter((s) => s.count > 0)
  const withPct = statusDetails.map((s) => ({
    ...s,
    percentage: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
  }))
  const successItem = withPct.find((s) => s.status === '成功客户') || { percentage: 0 }
  const failItem = withPct.find((s) => s.status === '失败客户') || { percentage: 0 }
  const noAnswerRate = withPct
    .filter((s) => ['秒挂无声', '开场拒访', '语音助手'].includes(s.status))
    .reduce((sum, s) => sum + s.percentage, 0)

  // 从项目ID名称映射中获取项目选项
  const projectOptions = Object.entries(projectIdNameMap)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    overview: {
      totalCalls: total,
      connectedCalls: connectedCount,
      successRate: successItem.percentage,
      failRate: failItem.percentage,
      noAnswerRate,
    },
    statusDetails: withPct,
    filterData: {
      projects: projectOptions,
      teams,
      agents,
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
    const projectName = searchParams.get('projectName')
    const teamId = searchParams.get('teamId')
    const agentCode = searchParams.get('agentCode')

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
      const cacheKey = `start=${formatDateLocal(startDate)}|end=${formatDateLocal(endDate)}|project=${projectName || 'all'}|team=${teamId || 'all'}|agent=${agentCode || 'all'}`
      const data = await getCachedQueryResult(
        'reports.outbound-result.statistics',
        cacheKey,
        () =>
          !projectName && !teamId && !agentCode
            ? buildOutboundResultFromRecordingSummary(startDate, endDate)
            : buildOutboundResultFromLocal(startDate, endDate, projectName, teamId, agentCode),
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
            message: '外呼结果统计来源于录音清单本地累计文件，请检查 qms_recording_list.json 可读性。',
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 503 }
        )
      }
    }

    // 生成模拟数据
    const data = generateMockData(startDate, endDate, projectName || undefined, teamId || undefined, agentCode || undefined)

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data
    })
  } catch (error) {
    console.error('Failed to fetch outbound result statistics:', error)
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
