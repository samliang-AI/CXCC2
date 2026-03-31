import { NextRequest, NextResponse } from 'next/server'

type DailySyncBody = {
  date?: string
  startTime?: string
  endTime?: string
  sliceMinutes?: number
  pageSize?: number
  maxPagesPerSlice?: number
  localUpsertBatchSize?: number
  retries?: number
}

function formatDayStart(day: string): string {
  return `${day} 00:00:00`
}

function formatDayEnd(day: string): string {
  return `${day} 23:59:59`
}

function parseDay(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

async function callWithRetry(
  request: NextRequest,
  path: string,
  payload: Record<string, unknown>,
  retries: number
): Promise<{ ok: boolean; status: number; body: unknown; attempts: number }> {
  const url = new URL(path, request.url).toString()
  const token = request.headers.get('x-sync-token') || ''

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-sync-token': token } : {}),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      })
      const body = await resp.json().catch(() => null)
      if (resp.ok) {
        return { ok: true, status: resp.status, body, attempts: attempt }
      }
      if (attempt > retries) {
        return { ok: false, status: resp.status, body, attempts: attempt }
      }
    } catch (error) {
      if (attempt > retries) {
        return {
          ok: false,
          status: 0,
          body: { message: 'REQUEST_FAILED', details: error instanceof Error ? error.message : String(error) },
          attempts: attempt,
        }
      }
    }
  }

  return { ok: false, status: 0, body: { message: 'UNKNOWN' }, attempts: retries + 1 }
}

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  try {
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as DailySyncBody
    const day = body.date ? parseDay(body.date) : null
    const startTime = (body.startTime || (day ? formatDayStart(day) : '')).trim()
    const endTime = (body.endTime || (day ? formatDayEnd(day) : '')).trim()
    if (!startTime || !endTime) {
      return NextResponse.json(
        {
          code: 400,
          message: 'date 或 startTime/endTime 必填',
          example: { date: '2026-03-01' },
        },
        { status: 400 }
      )
    }

    const sliceMinutes = Math.max(5, Math.min(360, Number(body.sliceMinutes ?? 120)))
    const pageSize = Math.max(20, Math.min(500, Number(body.pageSize ?? 200)))
    const maxPagesPerSlice = Math.max(1, Math.min(300, Number(body.maxPagesPerSlice ?? 80)))
    const localUpsertBatchSize = Math.max(
      1000,
      Math.min(50000, Number(body.localUpsertBatchSize ?? process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE ?? 10000))
    )
    const retries = Math.max(0, Math.min(5, Number(body.retries ?? 1)))

    const payload = {
      startTime,
      endTime,
      sliceMinutes,
      pageSize,
      maxPagesPerSlice,
      localUpsertBatchSize,
    }

    const recordings = await callWithRetry(request, '/api/internal/sync/recordings/backfill', payload, retries)
    const callLogs = await callWithRetry(request, '/api/internal/sync/call-logs/backfill', payload, retries)

    const success = recordings.ok && callLogs.ok
    return NextResponse.json(
      {
        code: success ? 200 : 500,
        message: success ? 'DAILY_SYNC_OK' : 'DAILY_SYNC_PARTIAL_OR_FAILED',
        data: {
          startTime,
          endTime,
          config: { sliceMinutes, pageSize, maxPagesPerSlice, localUpsertBatchSize, retries },
          recordings,
          callLogs,
          startedAt: startedAt.toISOString(),
          endedAt: new Date().toISOString(),
        },
      },
      { status: success ? 200 : 500 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ code: 500, message: 'DAILY_SYNC_FAILED', details: msg }, { status: 500 })
  }
}
