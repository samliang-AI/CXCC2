import { NextRequest, NextResponse } from 'next/server'

import { getLocalSyncFiles } from '@/lib/local-recording-store'
import { readAllLocalCallLogs, readLocalCallLogsByDateRange, getAllCallLogFiles } from '@/lib/local-call-log-store-optimized'

function parseDateRange(startDate: string | null, endDate: string | null): { startMs: number | null; endMs: number | null } {
  const toMs = (s: string | null, isEnd: boolean): number | null => {
    if (!s) return null
    const d = new Date(`${s}T${isEnd ? '23:59:59' : '00:00:00'}`)
    const t = d.getTime()
    return Number.isFinite(t) ? t : null
  }
  return { startMs: toMs(startDate, false), endMs: toMs(endDate, true) }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number(searchParams.get('page') || '1')
    const pageSize = Number(searchParams.get('pageSize') || '20')
    const agentCode = (searchParams.get('agentCode') || '').trim()
    const calleeNumber = (searchParams.get('calleeNumber') || '').trim()
    const callStatus = (searchParams.get('callStatus') || '').trim()
    const connectStatus = (searchParams.get('connectStatus') || '').trim()
    const { startMs, endMs } = parseDateRange(searchParams.get('startDate'), searchParams.get('endDate'))

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    let rows: Record<string, unknown>[]
    let loadedFiles: string[] = []
    if (startDate || endDate) {
      // 按日期范围读取（更高效）
      const result = await readLocalCallLogsByDateRange({
        startDate: startDate ? startDate.split('T')[0] : undefined,
        endDate: endDate ? endDate.split('T')[0] : undefined,
      })
      rows = result.rows as Record<string, unknown>[]
      loadedFiles = result.files
    } else {
      // 读取全部数据
      const typedRows = await readAllLocalCallLogs()
      rows = typedRows as Record<string, unknown>[]
      // 获取所有文件
      const files = await getAllCallLogFiles()
      loadedFiles = files
    }
    const filtered = rows.filter((row) => {
      const callee = String(row.calleeNumber ?? '')
      const agent = String(row.agentCode ?? '')
      const cs = String(row.callStatus ?? '')
      const conn = String(row.connectStatus ?? '')
      const st = String(row.startTime ?? '')
      const t = new Date(st.replace(' ', 'T')).getTime()
      const stMs = Number.isFinite(t) ? t : null

      if (calleeNumber && !callee.includes(calleeNumber)) return false
      if (agentCode && agentCode !== 'all' && agent !== agentCode) return false
      if (callStatus && callStatus !== 'all' && cs !== callStatus) return false
      if (connectStatus && connectStatus !== 'all' && conn !== connectStatus) return false
      if (startMs !== null && (stMs === null || stMs < startMs)) return false
      if (endMs !== null && (stMs === null || stMs > endMs)) return false
      return true
    })

    const from = (page - 1) * pageSize
    const list = filtered.slice(from, from + pageSize)
    const total = filtered.length

    // 提取文件名列表，只保留文件名部分
    const fileNames = loadedFiles.map(file => file.split('\\').pop() || file)
    
    return NextResponse.json({
      code: 200,
      message: '查询成功',
      data: {
        list,
        total,
        page,
        pageSize,
        rawTotal: rows.length,
        meta: {
          source: 'local-file',
          sourceFile: getLocalSyncFiles().callLogs,
          loadedFiles: fileNames,
        },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        code: 500,
        error: 'LOCAL_CALL_LOGS_FAILED',
        message: msg,
        details: msg,
      },
      { status: 500 }
    )
  }
}
