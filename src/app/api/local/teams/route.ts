import { NextRequest, NextResponse } from 'next/server'

import { getLocalSyncFiles, readLocalTeams } from '@/lib/local-recording-store'
import path from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

const DATA_DIR = path.join(process.cwd(), 'data', 'local-sync')

// 确保数据目录存在
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

function containsKeyword(row: Record<string, unknown>, keyword: string): boolean {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  return Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(k))
}

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ code: 500, message: 'LOCAL_TEAMS_FAILED', details: msg }, { status: 500 })
  }
}

// POST - 创建新团队
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamName, teamKey } = body
    
    if (!teamName || !teamKey) {
      return NextResponse.json({ code: 400, message: '缺少必要参数' }, { status: 400 })
    }
    
    await ensureDataDir()
    
    // 读取现有团队数据
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
    
    // 检查团队是否已存在
    const existingIndex = teams.findIndex((t: any) => t.teamKey === teamKey || t.teamName === teamName)
    
    if (existingIndex >= 0) {
      // 团队已存在
      return NextResponse.json({ 
        code: 400, 
        message: '团队已存在',
        data: teams[existingIndex]
      }, { status: 400 })
    }
    
    // 创建新团队
    const newTeam = {
      teamKey,
      teamName,
      createTime: new Date().toISOString(),
    }
    
    teams.push(newTeam)
    
    // 写入文件
    await writeFile(teamsFilePath, JSON.stringify(teams, null, 2), 'utf-8')
    
    return NextResponse.json({
      code: 0,
      message: '创建成功',
      data: newTeam
    })
  } catch (error: any) {
    console.error('创建团队失败:', error)
    return NextResponse.json(
      { code: 500, message: error?.message || '服务器错误' },
      { status: 500 }
    )
  }
}
