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

async function handleOutboundResultStatistics(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const projectName = searchParams.get('projectName') || searchParams.get('cityCode')

    const startDate = parseDateParam(startDateStr)
    const endDate = parseDateParam(endDateStr)

    if (!startDate || !endDate) {
      return NextResponse.json({ code: 400, message: '缺少日期参数' }, { status: 400 })
    }

    const result = await getCachedQueryResult(
      'reports',
      `outbound-result-stats-${startDateStr}-${endDateStr}-${projectName || 'all'}`,
      async () => {
        const recordings = await readLocalRecordingsByDateRange({
          startDate: formatDateLocal(startDate),
          endDate: formatDateLocal(endDate)
        })

        let filtered = recordings
        if (projectName && projectName !== 'all') {
          filtered = recordings.filter(r => resolveProjectName(r.project_id) === projectName)
        }

        const stats: Record<string, number> = {}
        filtered.forEach(r => {
          const status = r.status_name || '未知'
          stats[status] = (stats[status] || 0) + 1
        })

        return {
          total: filtered.length,
          stats,
          projectName: projectName || '全部'
        }
      },
      getRouteCacheTtlMs()
    )

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: result
    })
  } catch (error) {
    console.error('外呼结果统计失败:', error)
    return NextResponse.json(
      { code: 500, message: '服务器错误' },
      { status: 500 }
    )
  }
}

async function handleTeamStatistics(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const yearStr = searchParams.get('year')
    const monthStr = searchParams.get('month')
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (yearStr && monthStr) {
      const year = parseInt(yearStr)
      const month = parseInt(monthStr) - 1
      startDate = new Date(year, month, 1)
      endDate = new Date(year, month + 1, 0)
    } else {
      startDate = parseDateParam(startDateStr)
      endDate = parseDateParam(endDateStr)
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ code: 400, message: '缺少日期参数' }, { status: 400 })
    }

    const result = await getCachedQueryResult(
      'reports',
      `team-stats-${formatDateLocal(startDate)}-${formatDateLocal(endDate)}`,
      async () => {
        const teams = await readLocalTeams()
        const recordings = await readLocalRecordingsByDateRange({
          startDate: formatDateLocal(startDate!),
          endDate: formatDateLocal(endDate!)
        })

        const teamStats: Record<string, any> = {}
        teams.forEach(team => {
          const teamName = team.skillGroupName as string
          teamStats[teamName] = {
            teamName: teamName,
            total: 0,
            connected: 0,
            success: 0
          }
        })

        recordings.forEach(r => {
          const teamName = (r as any).team_name
          if (teamName && teamStats[teamName]) {
            teamStats[teamName].total++
            if (isConnectedRecord(r)) {
              teamStats[teamName].connected++
            }
            if (r.status_name === '成功客户') {
              teamStats[teamName].success++
            }
          }
        })

        return Object.values(teamStats)
      },
      getRouteCacheTtlMs()
    )

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: result
    })
  } catch (error) {
    console.error('团队统计失败:', error)
    return NextResponse.json(
      { code: 500, message: '服务器错误' },
      { status: 500 }
    )
  }
}

async function handleTeamAgentDaily(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentCode = searchParams.get('agentCode')
    const yearStr = searchParams.get('year')
    const monthStr = searchParams.get('month')

    if (!agentCode) {
      return NextResponse.json({ code: 400, message: '缺少坐席工号参数' }, { status: 400 })
    }

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (yearStr && monthStr) {
      const year = parseInt(yearStr)
      const month = parseInt(monthStr) - 1
      startDate = new Date(year, month, 1)
      endDate = new Date(year, month + 1, 0)
    } else {
      const now = new Date()
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    const result = await getCachedQueryResult(
      'reports',
      `agent-daily-${agentCode}-${formatDateLocal(startDate)}-${formatDateLocal(endDate)}`,
      async () => {
        const dailySummary = await getRecordingDailySummaryByDateRange({
          startDate: formatDateLocal(startDate!),
          endDate: formatDateLocal(endDate!)
        })

        const result: any[] = []
        Object.entries(dailySummary.days).forEach(([date, dayData]) => {
          Object.entries(dayData.byAgent).forEach(([agentCodeKey, agentData]) => {
            if (agentCodeKey === agentCode) {
              result.push({
                date,
                agent_code: agentCodeKey,
                agent_name: agentData.agentName,
                team_name: agentData.teamName,
                total: agentData.total,
                success: agentData.success
              })
            }
          })
        })

        return result
      },
      getRouteCacheTtlMs()
    )

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: result
    })
  } catch (error) {
    console.error('坐席日报失败:', error)
    return NextResponse.json(
      { code: 500, message: '服务器错误' },
      { status: 500 }
    )
  }
}

async function handleTypeFilterStatistics(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const projectName = searchParams.get('projectName') || searchParams.get('cityCode')

    const startDate = parseDateParam(startDateStr)
    const endDate = parseDateParam(endDateStr)

    if (!startDate || !endDate) {
      return NextResponse.json({ code: 400, message: '缺少日期参数' }, { status: 400 })
    }

    const result = await getCachedQueryResult(
      'reports',
      `type-filter-stats-${startDateStr}-${endDateStr}-${projectName || 'all'}`,
      async () => {
        const recordings = await readLocalRecordingsByDateRange({
          startDate: formatDateLocal(startDate!),
          endDate: formatDateLocal(endDate!)
        })

        let filtered = recordings
        if (projectName && projectName !== 'all') {
          filtered = recordings.filter(r => resolveProjectName(r.project_id) === projectName)
        }

        const typeStats: Record<string, number> = {}
        filtered.forEach(r => {
          const type = (r as any).call_type || '未知'
          typeStats[type] = (typeStats[type] || 0) + 1
        })

        return {
          total: filtered.length,
          typeStats,
          projectName: projectName || '全部'
        }
      },
      getRouteCacheTtlMs()
    )

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: result
    })
  } catch (error) {
    console.error('类型筛选统计失败:', error)
    return NextResponse.json(
      { code: 500, message: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  switch (type) {
    case 'outbound-result':
      return handleOutboundResultStatistics(request)
    case 'team':
      return handleTeamStatistics(request)
    case 'team-agent-daily':
      return handleTeamAgentDaily(request)
    case 'type-filter':
      return handleTypeFilterStatistics(request)
    default:
      return NextResponse.json(
        { error: 'Invalid type. Supported types: outbound-result, team, team-agent-daily, type-filter' },
        { status: 400 }
      )
  }
}
