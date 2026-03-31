import { NextRequest, NextResponse } from 'next/server'

import { fetchCxccAgentRecordList, mapCxccRecordToCallLog } from '@/lib/cxcc-agent-record-list'
import { appendLocalSyncLog, getLocalSyncFiles, upsertLocalCallLogs } from '@/lib/local-recording-store'

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  try {
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const url = new URL(request.url)
    const lookbackMinutes = Math.max(1, Number(url.searchParams.get('lookbackMinutes') || '15'))
    const pageSize = Math.max(20, Number(url.searchParams.get('pageSize') || '200'))
    const maxPages = Math.max(1, Number(url.searchParams.get('maxPages') || '10'))

    const body = (await request.json().catch(() => ({}))) as { startTime?: string; endTime?: string }
    const now = new Date()
    const start = body.startTime ? new Date(body.startTime) : new Date(now.getTime() - lookbackMinutes * 60 * 1000)
    const end = body.endTime ? new Date(body.endTime) : now
    const startTime = Number.isNaN(start.getTime())
      ? formatDateTime(new Date(now.getTime() - lookbackMinutes * 60 * 1000))
      : formatDateTime(start)
    const endTime = Number.isNaN(end.getTime()) ? formatDateTime(now) : formatDateTime(end)

    const allRows: Record<string, unknown>[] = []
    for (let p = 1; p <= maxPages; p++) {
      const { records } = await fetchCxccAgentRecordList(
        {
          pageNum: p,
          pageSize,
          startTime,
          endTime,
        },
        { primaryPath: '/om/agentrecordList/api' }
      )
      if (!records.length) break
      allRows.push(...records.map((r) => r as Record<string, unknown>))
      if (records.length < pageSize) break
    }

    const syncNow = new Date().toISOString()
    const normalized = allRows
      .map((r, idx) => {
        const row = mapCxccRecordToCallLog(r, idx) as Record<string, unknown>
        return { ...row, uuid: String(r.uuid ?? row.id ?? ''), syncTime: syncNow }
      })
      .filter((r) => String((r as any).id ?? (r as any).uuid ?? '').trim().length > 0)

    const upserted = await upsertLocalCallLogs(normalized)
    await appendLocalSyncLog({
      sync_type: 'call_logs',
      sync_start_time: startedAt.toISOString(),
      sync_end_time: new Date().toISOString(),
      sync_status: 1,
      sync_count: normalized.length,
      success_count: upserted,
      fail_count: 0,
      error_message: null,
    })

    return NextResponse.json({
      code: 200,
      message: 'SYNC_CALL_LOGS_OK',
      data: {
        startTime,
        endTime,
        fetched: allRows.length,
        upserted,
        localFiles: getLocalSyncFiles(),
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    try {
      await appendLocalSyncLog({
        sync_type: 'call_logs',
        sync_start_time: startedAt.toISOString(),
        sync_end_time: new Date().toISOString(),
        sync_status: 0,
        sync_count: 0,
        success_count: 0,
        fail_count: 1,
        error_message: msg,
      })
    } catch {
      // ignore
    }
    return NextResponse.json({ code: 500, message: 'SYNC_CALL_LOGS_FAILED', details: msg }, { status: 500 })
  }
}
