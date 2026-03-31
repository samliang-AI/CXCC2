import { NextRequest, NextResponse } from 'next/server'

type QuickBody = {
  startTime?: string
  endTime?: string
}

export async function POST(request: NextRequest) {
  try {
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as QuickBody
    const url = new URL(request.url)
    const startTime = String(body.startTime || url.searchParams.get('startTime') || '').trim()
    const endTime = String(body.endTime || url.searchParams.get('endTime') || '').trim()

    if (!startTime || !endTime) {
      return NextResponse.json(
        {
          code: 400,
          message: 'startTime 和 endTime 必填',
          example: {
            startTime: '2026-03-21 00:00:00',
            endTime: '2026-03-21 23:59:59',
          },
        },
        { status: 400 }
      )
    }

    const sliceMinutes = Number(process.env.BACKFILL_SLICE_MINUTES || '120') || 120
    const pageSize = Number(process.env.BACKFILL_PAGE_SIZE || '200') || 200
    const maxPagesPerSlice = Number(process.env.BACKFILL_MAX_PAGES_PER_SLICE || '30') || 30
    const localUpsertBatchSize = Number(process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE || '10000') || 10000

    const proxyUrl = new URL('/api/internal/sync/recordings/backfill', request.url).toString()
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(tokenGot ? { 'x-sync-token': tokenGot } : {}),
      },
      body: JSON.stringify({
        startTime,
        endTime,
        sliceMinutes,
        pageSize,
        maxPagesPerSlice,
        localUpsertBatchSize,
      }),
      cache: 'no-store',
    })

    const json = await resp.json().catch(() => null)
    if (!resp.ok) {
      return NextResponse.json(
        json ?? {
          code: resp.status,
          message: 'BACKFILL_QUICK_FAILED',
          details: '上游补数接口返回异常',
        },
        { status: resp.status }
      )
    }

    return NextResponse.json({
      code: 200,
      message: 'BACKFILL_QUICK_OK',
      quickConfig: {
        sliceMinutes,
        pageSize,
        maxPagesPerSlice,
        localUpsertBatchSize,
      },
      data: json?.data ?? json,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        code: 500,
        message: 'BACKFILL_QUICK_FAILED',
        details: msg,
      },
      { status: 500 }
    )
  }
}
