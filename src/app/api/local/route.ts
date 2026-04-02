import { NextRequest, NextResponse } from 'next/server'
import { getLocalSyncFiles, readLocalAgents, readLocalTeams, readLocalCallLogs, readLocalRecordings } from '@/lib/local-recording-store'
import { readLocalCallLogsByDateRange } from '@/lib/local-call-log-store-optimized'
import { readLocalRecordingsByDateRange } from '@/lib/local-recording-store-optimized'
import path from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

function containsKeyword(row: Record<string, unknown>, keyword: string): boolean {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  const probes = [
    row.agent,
    row.agentNo,
    row.workNumber,
    row.username,
    row.realname,
    row.name,
    row.agentName,
    row.extension,
  ]
  return probes.some((v) => String(v ?? '').toLowerCase().includes(k))
}

async function handleAgents(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.max(1, Number(searchParams.get('pageSize') || '20'))
    const keyword = (searchParams.get('keyword') || '').trim()

    const rows = (await readLocalAgents()).map((r) => r as Record<string, unknown>)
    const filtered = keyword ? rows.filter((r) => containsKeyword(r, keyword)) : rows
    const total = filtered.length
    const from = (page - 1) * pageSize
    const list = filtered.slice(from, from + pageSize)

    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data: {
        list,
        total,
        rawTotal: rows.length,
        page,
        pageSize,
        meta: {
          source: 'local-file',
          sourceFile: getLocalSyncFiles().agents,
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ code: 500, message: 'LOCAL_AGENTS_FAILED', details: msg }, { status: 500 })
  }
}

async function handleTeams(request: NextRequest, method: string) {
  try {
    if (method === 'GET') {
      const { searchParams } = new URL(request.url)
      const page = Math.max(1, Number(searchParams.get('page') || '1'))
      const pageSize = Math.max(1, Number(searchParams.get('pageSize') || '20'))
      const keyword = (searchParams.get('keyword') || '').trim()

      const rows = (await readLocalTeams()).map((r) => r as Record<string, unknown>)
      const filtered = keyword ? rows.filter((r) => containsKeyword(r, keyword)) : rows
      const total = filtered.length
      const from = (page - 1) * pageSize
      const list = filtered.slice(from, from + pageSize)

      return NextResponse.json({
        code: 200,
        message: '查询成功',
        data: {
          list,
          total,
          rawTotal: rows.length,
          page,
          pageSize,
          meta: {
            source: 'local-file',
            sourceFile: getLocalSyncFiles().teams,
          },
        },
      })
    } else if (method === 'POST') {
      const body = await request.json()
      const { teamName, teamKey } = body
      
      if (!teamName || !teamKey) {
        return NextResponse.json({ code: 400, message: '缺少必要参数' }, { status: 400 })
      }
      
      await ensureDataDir()
      
      const teamsFilePath = path.join(DATA_DIR, 'qms_team_list.json')
      let teams: any[] = []
      
      try {
        const data = await readFile(teamsFilePath, 'utf-8')
        teams = JSON.parse(data)
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
      
      const newTeam = {
        id: String(Date.now()),
        skillGroupName: teamName,
        teamKey: teamKey,
        createTime: new Date().toISOString()
      }
      
      teams.push(newTeam)
      
      await writeFile(teamsFilePath, JSON.stringify(teams, null, 2), 'utf-8')
      
      return NextResponse.json({
        code: 200,
        message: '创建成功',
        data: newTeam
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ code: 500, message: 'LOCAL_TEAMS_FAILED', details: msg }, { status: 500 })
  }
}

async function handleCallLogs(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const agent = searchParams.get('agent')
    const projectId = searchParams.get('projectId')
    const calledPhone = searchParams.get('calledPhone')
    const callingPhone = searchParams.get('callingPhone')

    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      targetStartTime = startTime
      targetEndTime = endTime
    } else if (date) {
      targetStartTime = `${date} 00:00:00`
      targetEndTime = `${date} 23:59:59`
    } else {
      const today = new Date().toISOString().split('T')[0]
      targetStartTime = `${today} 00:00:00`
      targetEndTime = `${today} 23:59:59`
    }

    const startDate = targetStartTime.split(' ')[0]
    const endDate = targetEndTime.split(' ')[0]
    
    const result = await readLocalCallLogsByDateRange({
      startDate,
      endDate
    })

    let filteredRows = result.rows

    if (agent) {
      filteredRows = filteredRows.filter(row => row.agent === agent)
    }
    if (projectId) {
      filteredRows = filteredRows.filter(row => row.project_id === parseInt(projectId))
    }
    if (calledPhone) {
      filteredRows = filteredRows.filter(row => {
        const phone = row.called_phone as string | undefined
        return phone && phone.includes(calledPhone)
      })
    }
    if (callingPhone) {
      filteredRows = filteredRows.filter(row => {
        const phone = row.calling_phone as string | undefined
        return phone && phone.includes(callingPhone)
      })
    }

    const total = filteredRows.length
    const startIndex = (page - 1) * pageSize
    const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize)

    return NextResponse.json({
      code: 0,
      message: 'OK',
      rows: paginatedRows,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('读取本地通话清单数据失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      {
        code: 500,
        message: `读取失败：${errorMessage}`,
        rows: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

async function handleRecordings(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const agent = searchParams.get('agent')
    const projectId = searchParams.get('projectId')
    const calledPhone = searchParams.get('calledPhone')
    const callingPhone = searchParams.get('callingPhone')

    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      targetStartTime = startTime
      targetEndTime = endTime
    } else if (date) {
      targetStartTime = `${date} 00:00:00`
      targetEndTime = `${date} 23:59:59`
    } else {
      const today = new Date().toISOString().split('T')[0]
      targetStartTime = `${today} 00:00:00`
      targetEndTime = `${today} 23:59:59`
    }

    const startDate = targetStartTime.split(' ')[0]
    const endDate = targetEndTime.split(' ')[0]
    
    const rows = await readLocalRecordingsByDateRange({
      startDate,
      endDate
    })

    let filteredRows = rows

    if (agent) {
      filteredRows = filteredRows.filter(row => row.agent === agent)
    }
    if (projectId) {
      filteredRows = filteredRows.filter(row => row.project_id === parseInt(projectId))
    }
    if (calledPhone) {
      filteredRows = filteredRows.filter(row => {
        const phone = row.called_phone
        return phone && phone.includes(calledPhone)
      })
    }
    if (callingPhone) {
      filteredRows = filteredRows.filter(row => {
        const phone = row.calling_phone
        return phone && phone.includes(callingPhone)
      })
    }

    const total = filteredRows.length
    const startIndex = (page - 1) * pageSize
    const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize)

    return NextResponse.json({
      code: 0,
      message: 'OK',
      rows: paginatedRows,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('读取本地录音清单数据失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      {
        code: 500,
        message: `读取失败：${errorMessage}`,
        rows: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'agents':
      return handleAgents(request)
    case 'teams':
      return handleTeams(request, 'GET')
    case 'call-logs':
      return handleCallLogs(request)
    case 'recordings':
      return handleRecordings(request)
    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: agents, teams, call-logs, recordings' },
        { status: 400 }
      )
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'teams') {
    return handleTeams(request, 'POST')
  }

  return NextResponse.json(
    { error: 'Invalid action. Only teams action supports POST method' },
    { status: 400 }
  )
}
