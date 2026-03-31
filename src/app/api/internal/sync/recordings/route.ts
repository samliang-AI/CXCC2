import { NextRequest, NextResponse } from 'next/server'

import { fetchCxccAgentRecordList, mapCxccRecordToRecording } from '@/lib/cxcc-agent-record-list'
import { appendLocalSyncLog, getLocalSyncFiles, upsertLocalRecordings } from '@/lib/local-recording-store'
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
  // CXCC 常见格式: YYYY-MM-DD HH:mm:ss
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
    const tokenRequired = process.env.INTERNAL_SYNC_TOKEN || ''
    const tokenGot = request.headers.get('x-sync-token') || ''
    if (tokenRequired && tokenGot !== tokenRequired) {
      return NextResponse.json({ code: 401, message: 'UNAUTHORIZED_SYNC_TOKEN' }, { status: 401 })
    }

    const url = new URL(request.url)
    const lookbackMinutes = Math.max(1, Number(url.searchParams.get('lookbackMinutes') || '15'))
    const pageSize = Math.max(20, Number(url.searchParams.get('pageSize') || '200'))
    const maxPages = Math.max(1, Number(url.searchParams.get('maxPages') || '5'))

    const body = (await request.json().catch(() => ({}))) as {
      startTime?: string
      endTime?: string
    }

    const now = new Date()
    const start = body.startTime ? new Date(body.startTime) : new Date(now.getTime() - lookbackMinutes * 60 * 1000)
    const end = body.endTime ? new Date(body.endTime) : now
    const startTime = Number.isNaN(start.getTime()) ? formatDateTime(new Date(now.getTime() - lookbackMinutes * 60 * 1000)) : formatDateTime(start)
    const endTime = Number.isNaN(end.getTime()) ? formatDateTime(now) : formatDateTime(end)

    const allRows: Array<Record<string, unknown>> = []
    for (let p = 1; p <= maxPages; p++) {
      const { records } = await fetchCxccAgentRecordList({
        pageNum: p,
        pageSize,
        startTime,
        endTime,
      }, {
        // 使用录音清单专用 API 路径，该路径返回 status、statusName、qualityStatus 字段
        primaryPath: '/om/agentCalldetailList/selectRecordList/api'
      })
      if (!records.length) break
      allRows.push(...(records as Array<Record<string, unknown>>))
      if (records.length < pageSize) break
    }

    const syncNow = new Date().toISOString()
    const upsertRows = allRows
      .map((r) => {
        // 调试：输出第一条记录的原始字段
        if (allRows.indexOf(r) === 0) {
          console.log('[RecordingSync] 原始数据字段示例:', JSON.stringify(r, null, 2))
        }
        return {
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
          // 直接使用 API 返回的 status、statusName、qualityStatus 字段
          status: toNum(r.status),
          status_name: toText(r.statusName),
          quality_status: toNum(r.qualityStatus),
          sync_time: syncNow,
          updated_at: syncNow,
        }
      })
      .filter((r) => r.uuid && r.answer_duration !== null && r.answer_duration > 0 && r.agent !== null && r.agent !== '')

    let successCount = 0
    let failCount = 0
    let storageMode: 'supabase' | 'local' = 'local'

    const hasSupabase = Boolean(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)
    if (hasSupabase) {
      storageMode = 'supabase'
      const supabase = getSupabaseClient()
      if (upsertRows.length > 0) {
        const { error } = await supabase.from('qms_recording_list').upsert(upsertRows, {
          onConflict: 'uuid',
          ignoreDuplicates: false,
        })
        if (error) {
          failCount = upsertRows.length
          throw new Error(`录音清单 upsert 失败: ${error.message}`)
        }
        successCount = upsertRows.length
      }
      const endedAt = new Date()
      await supabase.from('qms_sync_log').insert({
        sync_type: 'recordings',
        sync_start_time: startedAt.toISOString(),
        sync_end_time: endedAt.toISOString(),
        sync_status: 1,
        sync_count: upsertRows.length,
        success_count: successCount,
        fail_count: failCount,
        error_message: null,
      })
    } else {
      successCount = await upsertLocalRecordings(upsertRows.filter((row: any) => row.uuid !== null) as any)
      await appendLocalSyncLog({
        sync_type: 'recordings',
        sync_start_time: startedAt.toISOString(),
        sync_end_time: new Date().toISOString(),
        sync_status: 1,
        sync_count: upsertRows.length,
        success_count: successCount,
        fail_count: failCount,
        error_message: null,
      })
    }

    return NextResponse.json({
      code: 200,
      message: 'SYNC_OK',
      data: {
        storageMode,
        localFiles: storageMode === 'local' ? getLocalSyncFiles() : null,
        startTime,
        endTime,
        fetched: allRows.length,
        upserted: successCount,
        failed: failCount,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    try {
      const hasSupabase = Boolean(process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY)
      if (hasSupabase) {
        const supabase = getSupabaseClient()
        await supabase.from('qms_sync_log').insert({
          sync_type: 'recordings',
          sync_start_time: startedAt.toISOString(),
          sync_end_time: new Date().toISOString(),
          sync_status: 0,
          sync_count: 0,
          success_count: 0,
          fail_count: 1,
          error_message: msg,
        })
      } else {
        await appendLocalSyncLog({
          sync_type: 'recordings',
          sync_start_time: startedAt.toISOString(),
          sync_end_time: new Date().toISOString(),
          sync_status: 0,
          sync_count: 0,
          success_count: 0,
          fail_count: 1,
          error_message: msg,
        })
      }
    } catch {
      // ignore log failures
    }
    return NextResponse.json(
      {
        code: 500,
        message: 'SYNC_FAILED',
        details: msg,
      },
      { status: 500 }
    )
  }
}
