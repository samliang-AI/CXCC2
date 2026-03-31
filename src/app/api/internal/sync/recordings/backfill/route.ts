import { NextRequest, NextResponse } from 'next/server'

import { fetchCxccAgentRecordList } from '@/lib/cxcc-agent-record-list'
import { appendLocalSyncLog, getLocalSyncFiles } from '@/lib/local-recording-store'
import { upsertLocalRecordings } from '@/lib/local-recording-store-optimized'
import { getSupabaseClient } from '@/storage/database/supabase-client'

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toText(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function toIsoDateTime(v: unknown): string | null {
  const s = toText(v)
  if (!s) return null
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  try {
    console.log('[BACKFILL] 开始录音清单补完，时间:', new Date().toISOString())
    
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      console.log('[BACKFILL] 认证失败:', tokenGot)
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const body = (await request.json()) as {
      startTime?: string
      endTime?: string
      sliceMinutes?: number
      pageSize?: number
      maxPagesPerSlice?: number
      localUpsertBatchSize?: number
    }
    console.log('[BACKFILL] 请求参数:', body)

    const start = new Date(String(body.startTime ?? ''))
    const end = new Date(String(body.endTime ?? ''))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      console.log('[BACKFILL] 时间格式错误:', body.startTime, body.endTime)
      return NextResponse.json({ code: 400, message: 'startTime/endTime 必填且格式正确' }, { status: 400 })
    }
    if (start > end) {
      console.log('[BACKFILL] 时间范围错误:', start, end)
      return NextResponse.json({ code: 400, message: 'startTime 不能大于 endTime' }, { status: 400 })
    }

    const sliceMinutes = Math.max(5, Math.min(360, Number(body.sliceMinutes ?? 60)))
    const pageSize = Math.max(20, Math.min(500, Number(body.pageSize ?? 200)))
    const maxPagesPerSlice = Math.max(1, Math.min(300, Number(body.maxPagesPerSlice ?? 30)))
    const localUpsertBatchSize = Math.max(
      1000,
      Math.min(50000, Number(body.localUpsertBatchSize ?? process.env.SYNC_LOCAL_UPSERT_BATCH_SIZE ?? 10000))
    )

    const hasSupabase = Boolean(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)
    const storageMode: 'supabase' | 'local' = hasSupabase ? 'supabase' : 'local'
    const syncNow = new Date().toISOString()

    let cursor = start.getTime()
    const endMs = end.getTime()

    let totalFetched = 0
    let totalUpserted = 0
    let totalFailed = 0
    let slices = 0

    const windows: Array<{ startTime: string; endTime: string; fetched: number; upserted: number; failed: number }> = []
    const supabase = hasSupabase ? getSupabaseClient() : null

    console.log('[BACKFILL] 开始处理时间范围:', formatDateTime(start), '到', formatDateTime(end))
    console.log('[BACKFILL] 配置:', { sliceMinutes, pageSize, maxPagesPerSlice, localUpsertBatchSize, storageMode })

    while (cursor <= endMs) {
      const windowStart = new Date(cursor)
      const windowEnd = new Date(Math.min(endMs, cursor + sliceMinutes * 60 * 1000 - 1000))
      const startText = formatDateTime(windowStart)
      const endText = formatDateTime(windowEnd)

      console.log('[BACKFILL] 处理时间窗口:', startText, '到', endText)

      const allRows: Array<Record<string, unknown>> = []
      try {
        for (let p = 1; p <= maxPagesPerSlice; p++) {
          console.log('[BACKFILL]  fetching page', p, 'of', maxPagesPerSlice)
          const { records } = await fetchCxccAgentRecordList({
            pageNum: p,
            pageSize,
            startTime: startText,
            endTime: endText,
          })
          console.log('[BACKFILL]  page', p, 'got', records.length, 'records')
          if (!records.length) break
          allRows.push(...(records as Array<Record<string, unknown>>))
          if (records.length < pageSize) break
        }
        console.log('[BACKFILL] 窗口总记录数:', allRows.length)
      } catch (fetchError) {
        console.error('[BACKFILL] 数据获取失败:', fetchError)
        totalFailed += 1
        slices += 1
        windows.push({
          startTime: startText,
          endTime: endText,
          fetched: 0,
          upserted: 0,
          failed: 1,
        })
        cursor = windowEnd.getTime() + 1000
        continue
      }

      const upsertRows = allRows
        .map((r) => ({
          uuid: toText(r.uuid),
          company_id: toNum(r.companyId),
          project_id: toNum(r.projectId),
          task_id: toNum(r.taskId),
          agent: toText(r.agent),
          agent_name: toText(r.agentName ?? r.agentRealName),
          calling_phone: toText(r.callingPhone),
          called_phone: toText(r.calledPhone),
          start_time: toIsoDateTime(r.startTime),
          end_time: toIsoDateTime(r.endTime),
          answer_duration: toNum(r.answerDuration),
          play_url: toText(r.playUrl),
          status: toNum(r.status),
          status_name: toText(r.statusName),
          quality_status: toNum(r.qualityStatus),
          sync_time: syncNow,
          updated_at: syncNow,
        }))
        .filter((r) => r.uuid)

      console.log('[BACKFILL] 处理后可插入记录数:', upsertRows.length)

      let windowUpserted = 0
      let windowFailed = 0
      if (upsertRows.length > 0) {
        try {
          if (supabase) {
            const { error } = await supabase.from('qms_recording_list').upsert(upsertRows, {
              onConflict: 'uuid',
              ignoreDuplicates: false,
            })
            if (error) {
              console.error('[BACKFILL] Supabase 写入失败:', error)
              windowFailed = upsertRows.length
            } else {
              windowUpserted = upsertRows.length
            }
          } else {
            console.log('[BACKFILL] 开始本地存储写入，批次大小:', localUpsertBatchSize)
            windowUpserted = await upsertLocalRecordings(upsertRows.filter((row: any) => row.uuid !== null) as any, {
              batchSize: localUpsertBatchSize,
            })
            console.log('[BACKFILL] 本地存储写入完成，成功:', windowUpserted)
          }
        } catch (writeError) {
          console.error('[BACKFILL] 写入失败:', writeError)
          windowFailed = upsertRows.length
        }
      }

      totalFetched += allRows.length
      totalUpserted += windowUpserted
      totalFailed += windowFailed
      slices += 1

      windows.push({
        startTime: startText,
        endTime: endText,
        fetched: allRows.length,
        upserted: windowUpserted,
        failed: windowFailed,
      })

      console.log('[BACKFILL] 窗口处理完成:', { fetched: allRows.length, upserted: windowUpserted, failed: windowFailed })

      cursor = windowEnd.getTime() + 1000
    }

    const syncLog = {
      sync_type: 'recordings_backfill',
      sync_start_time: startedAt.toISOString(),
      sync_end_time: new Date().toISOString(),
      sync_status: totalFailed > 0 ? 0 : 1,
      sync_count: totalFetched,
      success_count: totalUpserted,
      fail_count: totalFailed,
      error_message: totalFailed > 0 ? '部分窗口写入失败，请检查返回的 windows 详情' : null,
    }

    console.log('[BACKFILL] 同步完成，统计:', syncLog)

    try {
      if (supabase) {
        await supabase.from('qms_sync_log').insert(syncLog)
      } else {
        await appendLocalSyncLog(syncLog)
      }
    } catch (logError) {
      console.error('[BACKFILL] 日志记录失败:', logError)
    }

    const result = {
      code: 200,
      message: 'BACKFILL_OK',
      data: {
        storageMode,
        localFiles: storageMode === 'local' ? getLocalSyncFiles() : null,
        startTime: formatDateTime(start),
        endTime: formatDateTime(end),
        sliceMinutes,
        pageSize,
        maxPagesPerSlice,
        localUpsertBatchSize,
        slices,
        fetched: totalFetched,
        upserted: totalUpserted,
        failed: totalFailed,
        windows,
      },
    }
    console.log('[BACKFILL] 返回结果:', result)
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[BACKFILL] 整体失败:', error)
    try {
      const hasSupabase = Boolean(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)
      const syncLog = {
        sync_type: 'recordings_backfill',
        sync_start_time: startedAt.toISOString(),
        sync_end_time: new Date().toISOString(),
        sync_status: 0,
        sync_count: 0,
        success_count: 0,
        fail_count: 1,
        error_message: msg,
      }
      if (hasSupabase) {
        const supabase = getSupabaseClient()
        await supabase.from('qms_sync_log').insert(syncLog)
      } else {
        await appendLocalSyncLog(syncLog)
      }
    } catch {
      // ignore log failures
    }
    const errorResult = {
      code: 500,
      message: 'BACKFILL_FAILED',
      details: msg,
    }
    console.log('[BACKFILL] 返回错误:', errorResult)
    return NextResponse.json(errorResult, { status: 500 })
  }
}
