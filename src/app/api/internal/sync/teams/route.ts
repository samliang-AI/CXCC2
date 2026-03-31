import { NextRequest, NextResponse } from 'next/server'

import { fetchAllCxccTeamsRaw } from '@/lib/cxcc-local-sync'
import { appendLocalSyncLog, getLocalSyncFiles, upsertLocalTeams } from '@/lib/local-recording-store'

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  try {
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const url = new URL(request.url)
    const maxPages = Math.max(1, Number(url.searchParams.get('maxPages') || process.env.SYNC_TEAMS_MAX_PAGES || '20'))
    const pageSize = Math.max(20, Number(url.searchParams.get('pageSize') || process.env.SYNC_TEAMS_PAGE_SIZE || '100'))

    const rows = await fetchAllCxccTeamsRaw(maxPages, pageSize)
    const upserted = await upsertLocalTeams(rows)
    await appendLocalSyncLog({
      sync_type: 'teams',
      sync_start_time: startedAt.toISOString(),
      sync_end_time: new Date().toISOString(),
      sync_status: 1,
      sync_count: rows.length,
      success_count: upserted,
      fail_count: 0,
      error_message: null,
    })

    return NextResponse.json({
      code: 200,
      message: 'SYNC_TEAMS_OK',
      data: {
        fetched: rows.length,
        upserted,
        localFiles: getLocalSyncFiles(),
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    try {
      await appendLocalSyncLog({
        sync_type: 'teams',
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
    return NextResponse.json({ code: 500, message: 'SYNC_TEAMS_FAILED', details: msg }, { status: 500 })
  }
}
