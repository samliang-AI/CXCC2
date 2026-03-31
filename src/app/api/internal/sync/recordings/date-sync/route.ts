/**
 * 录音清单按日期同步 API
 * 支持按日期范围同步，自动将数据存储到对应日期的文件中
 */

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
  // CXCC 常见格式：YYYY-MM-DD HH:mm:ss
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

/**
 * 提取日期部分 (YYYY-MM-DD)
 */
function extractDate(isoString: string | null): string | null {
  if (!isoString) return null
  const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

export async function POST(request: NextRequest) {
  const startedAt = new Date()
  let syncStats = {
    totalFetched: 0,
    totalUpserted: 0,
    totalFailed: 0,
    filesUpdated: new Set<string>(),
    dateDistribution: new Map<string, number>(),
  }

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
    const startTime = Number.isNaN(start.getTime())
      ? formatDateTime(new Date(now.getTime() - lookbackMinutes * 60 * 1000))
      : formatDateTime(start)
    const endTime = Number.isNaN(end.getTime()) ? formatDateTime(now) : formatDateTime(end)

    // 分页获取数据
    const allRows: Array<Record<string, unknown>> = []
    for (let p = 1; p <= maxPages; p++) {
      const { records } = await fetchCxccAgentRecordList({
        pageNum: p,
        pageSize,
        startTime,
        endTime,
      }, {
        primaryPath: '/om/agentCalldetailList/selectRecordList/api' // 录音清单专用路径
      })
      if (!records.length) break
      allRows.push(...(records as Array<Record<string, unknown>>))
      if (records.length < pageSize) break
    }

    syncStats.totalFetched = allRows.length

    const syncNow = new Date().toISOString()
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
      .filter((r): r is any => r.uuid !== null)

    // 统计日期分布
    for (const row of upsertRows) {
      const date = extractDate(row.start_time)
      if (date) {
        const current = syncStats.dateDistribution.get(date) || 0
        syncStats.dateDistribution.set(date, current + 1)
      }
    }

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
          throw new Error(`录音清单 upsert 失败：${error.message}`)
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
      // 使用优化版本：按日期分文件存储
      successCount = await upsertLocalRecordings(upsertRows.filter((row: any) => row.uuid !== null) as any)
      syncStats.totalUpserted = successCount

      // 记录更新的文件
      for (const [date] of syncStats.dateDistribution.entries()) {
        syncStats.filesUpdated.add(`qms_recording_list_${date}.json`)
      }

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

    // 数据完整性校验
    const validationResults = await validateSyncData(upsertRows)

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
        dateDistribution: Object.fromEntries(syncStats.dateDistribution),
        filesUpdated: Array.from(syncStats.filesUpdated),
        validation: validationResults,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    syncStats.totalFailed = syncStats.totalFetched - syncStats.totalUpserted

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
        stats: {
          fetched: syncStats.totalFetched,
          upserted: syncStats.totalUpserted,
          failed: syncStats.totalFailed,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * 数据完整性校验
 */
async function validateSyncData(
  rows: Array<{
    uuid: string | null
    start_time: string | null
    sync_time: string
  }>
): Promise<{
  isValid: boolean
  totalRecords: number
  validRecords: number
  invalidRecords: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
  errors: Array<{ uuid: string | null; error: string }>
}> {
  const errors: Array<{ uuid: string | null; error: string }> = []
  let validRecords = 0
  let earliest: string | null = null
  let latest: string | null = null

  for (const row of rows) {
    const date = extractDate(row.start_time)

    // 校验日期格式
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push({ uuid: row.uuid, error: 'Invalid date format' })
      continue
    }

    // 更新日期范围
    if (!earliest || date < earliest) earliest = date
    if (!latest || date > latest) latest = date

    validRecords++
  }

  return {
    isValid: errors.length === 0,
    totalRecords: rows.length,
    validRecords,
    invalidRecords: errors.length,
    dateRange: { earliest, latest },
    errors,
  }
}
