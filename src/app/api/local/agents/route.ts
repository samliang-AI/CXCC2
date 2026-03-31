import { NextRequest, NextResponse } from 'next/server'

import { getLocalSyncFiles, readLocalAgents } from '@/lib/local-recording-store'

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

export async function GET(request: NextRequest) {
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
