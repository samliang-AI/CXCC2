import { NextRequest, NextResponse } from 'next/server'

import { isRealDataOnly } from '@/lib/data-source-config'
import { readLocalTeams } from '@/lib/local-recording-store'
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

// 模拟生成团队看板统计数据
function generateMockData(year: number, month: number, teamId?: string) {
  // 计算当月天数
  const daysInMonth = new Date(year, month, 0).getDate()

  // 根据团队筛选
  const filteredTeams = teamId 
    ? teams.filter(t => t.id === teamId)
    : teams

  // 根据团队筛选坐席
  const filteredAgents = teamId 
    ? agents.filter(a => a.teamId === teamId)
    : agents

  // 生成坐席数据
  const agentDetails = filteredAgents.map(agent => {
    const team = teams.find(t => t.id === agent.teamId)!
    // 基础日均成功量
    const baseDailySuccess = 5 + Math.floor(Math.random() * 15) // 每天5-20单
    const monthlySuccess = Math.floor(baseDailySuccess * daysInMonth * (0.7 + Math.random() * 0.5))
    // 月目标 = 日均目标 * 工作日（约22天）
    const monthlyTarget = Math.floor(baseDailySuccess * 22 * (1 + Math.random() * 0.2))
    const completionRate = Number((monthlySuccess / monthlyTarget * 100).toFixed(1))

    return {
      teamName: team.name,
      teamId: team.id,
      agentCode: agent.code,
      agentName: agent.name,
      monthlySuccess,
      monthlyTarget,
      completionRate
    }
  }).sort((a, b) => b.monthlySuccess - a.monthlySuccess)

  // 生成团队汇总数据
  const teamSummary = filteredTeams.map(team => {
    const teamAgents = agentDetails.filter(a => a.teamId === team.id)
    const agentCount = teamAgents.length
    const totalMonthlySuccess = teamAgents.reduce((sum, a) => sum + a.monthlySuccess, 0)
    const totalMonthlyTarget = teamAgents.reduce((sum, a) => sum + a.monthlyTarget, 0)
    const avgSuccessPerAgent = agentCount > 0 ? Number((totalMonthlySuccess / agentCount).toFixed(1)) : 0
    const completionRate = totalMonthlyTarget > 0 ? Number((totalMonthlySuccess / totalMonthlyTarget * 100).toFixed(1)) : 0
    const topPerformers = teamAgents.filter(a => a.completionRate >= 100).length

    return {
      teamId: team.id,
      teamName: team.name,
      agentCount,
      totalMonthlySuccess,
      totalMonthlyTarget,
      avgSuccessPerAgent,
      completionRate,
      topPerformers
    }
  }).sort((a, b) => b.totalMonthlySuccess - a.totalMonthlySuccess)

  // 计算概览数据
  const totalAgents = agentDetails.length
  const totalMonthlySuccess = agentDetails.reduce((sum, a) => sum + a.monthlySuccess, 0)
  const avgCompletionRate = totalAgents > 0 ? agentDetails.reduce((sum, a) => sum + a.completionRate, 0) / totalAgents : 0
  const topPerformers = agentDetails.filter(a => a.completionRate >= 100).length

  return {
    overview: {
      totalAgents,
      totalMonthlySuccess,
      avgCompletionRate,
      topPerformers
    },
    teamSummary,
    agentDetails,
    teamList: teams,
    dateRange: {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`
    }
  }
}

async function buildTeamDashboardFromLocal(
  startDate: Date,
  endDate: Date,
  selectedTeamId?: string | null
) {
  // 使用日期范围查询优化版本
  const startDateStr = formatDateLocal(startDate)
  const endDateStr = formatDateLocal(endDate)
  const [summary, teamsLocal] = await Promise.all([
    getRecordingDailySummaryByDateRange({ startDate: startDateStr, endDate: endDateStr }),
    readLocalTeams()
  ])

  const byAgent = new Map<
    string,
    { name: string; teamId: string; teamName: string; total: number; success: number }
  >()
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const endCursor = new Date(endDate)
  endCursor.setHours(0, 0, 0, 0)
  while (cursor <= endCursor) {
    const day = formatDateLocal(cursor)
    const dayBucket = summary.days[day]
    if (dayBucket) {
      for (const [code, a] of Object.entries(dayBucket.byAgent)) {
        if (!byAgent.has(code)) {
          byAgent.set(code, { name: a.agentName, teamId: a.teamId || 'unknown', teamName: a.teamName || '未分组', total: 0, success: 0 })
        }
        const item = byAgent.get(code)!
        item.total += a.total
        item.success += a.success
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  let agentDetails = Array.from(byAgent.entries())
    .map(([agentCode, v]) => {
      const monthlySuccess = v.success
      const monthlyTarget = Math.max(monthlySuccess, Math.ceil((v.total || monthlySuccess) * 0.35))
      const completionRate = monthlyTarget > 0 ? Number(((monthlySuccess / monthlyTarget) * 100).toFixed(1)) : 0
      return {
        teamName: v.teamName,
        teamId: v.teamId,
        agentCode,
        agentName: v.name,
        monthlySuccess,
        monthlyTarget,
        completionRate,
      }
    })
    .sort((a, b) => b.monthlySuccess - a.monthlySuccess)

  if (selectedTeamId && selectedTeamId !== 'all') {
    agentDetails = agentDetails.filter((a) => a.teamId === selectedTeamId)
  }

  const teamMap = new Map<
    string,
    {
      teamId: string
      teamName: string
      agentCount: number
      totalMonthlySuccess: number
      totalMonthlyTarget: number
      topPerformers: number
    }
  >()
  for (const a of agentDetails) {
    if (!teamMap.has(a.teamId)) {
      teamMap.set(a.teamId, {
        teamId: a.teamId,
        teamName: a.teamName,
        agentCount: 0,
        totalMonthlySuccess: 0,
        totalMonthlyTarget: 0,
        topPerformers: 0,
      })
    }
    const t = teamMap.get(a.teamId)!
    t.agentCount += 1
    t.totalMonthlySuccess += a.monthlySuccess
    t.totalMonthlyTarget += a.monthlyTarget
    if (a.completionRate >= 100) t.topPerformers += 1
  }

  const teamSummary = Array.from(teamMap.values())
    .map((t) => ({
      ...t,
      avgSuccessPerAgent: t.agentCount > 0 ? Number((t.totalMonthlySuccess / t.agentCount).toFixed(1)) : 0,
      completionRate: t.totalMonthlyTarget > 0 ? Number(((t.totalMonthlySuccess / t.totalMonthlyTarget) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalMonthlySuccess - a.totalMonthlySuccess)

  const totalAgents = agentDetails.length
  const totalMonthlySuccess = agentDetails.reduce((s, a) => s + a.monthlySuccess, 0)
  const avgCompletionRate = teamSummary.length > 0 ? teamSummary.reduce((s, t) => s + t.completionRate, 0) / teamSummary.length : 0
  const topPerformers = agentDetails.filter((a) => a.completionRate >= 100).length

  const teamList = (teamsLocal as Array<Record<string, unknown>>)
    .map((t) => ({
      id: String(t.id ?? t.skillgroupId ?? t.teamId ?? '').trim(),
      name: String(t.skillGroupName ?? t.name ?? t.teamName ?? '').trim(),
    }))
    .filter((t) => t.id && t.name)

  return {
    overview: {
      totalAgents,
      totalMonthlySuccess,
      avgCompletionRate: Number(avgCompletionRate.toFixed(1)),
      topPerformers,
    },
    teamSummary,
    agentDetails,
    teamList,
    dateRange: {
      startDate: formatDateLocal(startDate),
      endDate: formatDateLocal(endDate),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const yearStr = searchParams.get('year')
    const monthStr = searchParams.get('month')
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const teamId = searchParams.get('teamId')

    // 获取当前年月（兼容旧参数）
    const now = new Date()
    const year = yearStr ? parseInt(yearStr) : now.getFullYear()
    const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1

    // 若显式传了日期范围，优先按日期查询；否则按 year/month 查询
    let startDate = parseDateParam(startDateStr)
    let endDate = parseDateParam(endDateStr)
    if (!startDate && !endDate) {
      if (yearStr || monthStr) {
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
          return NextResponse.json(
            { error: '无效的年月参数' },
            { status: 400 }
          )
        }
        startDate = new Date(year, month - 1, 1)
        endDate = new Date(year, month, 0, 23, 59, 59)
      } else {
        // 无任何日期参数时默认今天
        startDate = new Date()
        endDate = new Date(startDate)
        endDate.setHours(23, 59, 59, 999)
      }
    } else {
      if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: '无效的日期格式' },
          { status: 400 }
        )
      }
      endDate.setHours(23, 59, 59, 999)
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '无效的日期参数' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      const t = new Date(startDate)
      startDate.setTime(endDate.getTime())
      endDate.setTime(t.getTime())
    }

    try {
      const cacheKey = `start=${formatDateLocal(startDate)}|end=${formatDateLocal(endDate)}|team=${teamId || 'all'}`
      const data = await getCachedQueryResult(
        'reports.team.statistics',
        cacheKey,
        () => buildTeamDashboardFromLocal(startDate!, endDate!, teamId),
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
            message: '团队看板按“录音清单 + 外呼团队 + 坐席设置”本地累计数据聚合，请检查本地同步文件是否可读。',
            details: e instanceof Error ? e.message : String(e),
          },
          { status: 503 }
        )
      }
    }

    // 生成模拟数据
    const data = generateMockData(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      teamId || undefined
    )

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data
    })
  } catch (error) {
    console.error('Failed to fetch team statistics:', error)
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
