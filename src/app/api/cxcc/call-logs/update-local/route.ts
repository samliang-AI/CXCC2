import { NextRequest, NextResponse } from 'next/server'

import {
  fetchCxccAgentRecordList,
  mapCxccRecordToCallLog
} from '@/lib/cxcc-agent-record-list'
import { upsertLocalCallLogs } from '@/lib/local-call-log-store-optimized'

/**
 * 通话清单：根据API结果更新本地文件
 * POST /api/cxcc/call-logs/update-local
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      pageNum = 1,
      pageSize = 100000, // 一次获取更多数据
      agentNo = '',
      projectId = '',
      startTime = '',
      endTime = '',
      callingPhone = '',
      calledPhone = '',
    } = body

    // 1. 从API获取数据
    const { records, total } = await fetchCxccAgentRecordList({
      pageNum,
      pageSize,
      agent: agentNo || undefined,
      projectId:
        projectId !== '' && projectId !== null && projectId !== undefined
          ? Number(projectId)
          : undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      callingPhone: callingPhone || undefined,
      calledPhone: calledPhone || undefined,
    }, {
      primaryPath: '/om/agentrecordList/api' // 通话清单专用路径（PDF 二十一）
    })

    // 2. 转换为通话清单格式
    const callLogs = records.map((record, index) => mapCxccRecordToCallLog(record, index))

    // 3. 更新本地文件
    const upsertedCount = await upsertLocalCallLogs(callLogs, {
      batchSize: 10000
    })

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        total: total,
        upserted: upsertedCount,
        message: `成功更新本地文件，共处理 ${callLogs.length} 条记录，写入 ${upsertedCount} 条记录`
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('通话清单（CXCC）更新本地文件错误:', error)
    return NextResponse.json(
      {
        code: -1,
        error: 'CXCC_CALL_LOGS_UPDATE_FAILED',
        message: msg,
        details: msg,
      },
      { status: 502 }
    )
  }
}
