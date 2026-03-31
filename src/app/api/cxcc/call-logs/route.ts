import { NextRequest, NextResponse } from 'next/server'

import {
  fetchCxccAgentRecordList,
  mapCxccRecordToCallLog
} from '@/lib/cxcc-agent-record-list'

/**
 * 通话清单：与 PDF「二十一、获取通话清单信息」一致，POST om/agentrecordList/api
 * （与录音清单同一事实源）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      pageNum = 1,
      pageSize = 20,
      agentNo = '',
      projectId = '',
      startTime = '',
      endTime = '',
      callingPhone = '',
      calledPhone = '',
    } = body

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

    // 转换为通话清单格式
    const callLogs = records.map((record, index) => mapCxccRecordToCallLog(record, index))

    return NextResponse.json({
      code: 0,
      message: 'OK',
      rows: callLogs,
      total,
      data: {
        records: callLogs,
        total,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('通话清单（CXCC）错误:', error)
    return NextResponse.json(
      {
        code: -1,
        error: 'CXCC_CALL_LOGS_FAILED',
        message: msg,
        details: msg,
      },
      { status: 502 }
    )
  }
}
