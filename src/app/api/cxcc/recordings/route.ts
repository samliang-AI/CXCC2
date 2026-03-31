import { NextRequest, NextResponse } from 'next/server'

import {
  fetchCxccAgentRecordList,
} from '@/lib/cxcc-agent-record-list'

/**
 * 录音清单：与 PDF「二十一、获取通话清单信息」一致，POST om/agentrecordList/api
 * （与通话清单同一事实源；试听地址需另接 getCdrByUuid / 录音清单扩展接口时可再补 playUrl）
 */
export async function POST(request: NextRequest) {
  try {
    console.log('录音清单API请求开始')
    const body = await request.json()
    console.log('录音清单API请求参数:', body)

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

    console.log('录音清单API请求参数处理完成')
    try {
      const { records, total, raw } = await fetchCxccAgentRecordList({
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
        primaryPath: '/om/agentCalldetailList/selectRecordList/api' // 录音清单专用路径
      })
      
      console.log('录音清单API查询结果:', { total, records: records.length })

      return NextResponse.json({
        code: 0,
        message: 'OK',
        rows: records,
        total,
        data: {
          records,
          total,
        },
      })
    } catch (apiError) {
      const apiMsg = apiError instanceof Error ? apiError.message : String(apiError)
      console.error('录音清单（CXCC）API错误:', apiError)
      return NextResponse.json(
        {
          code: -1,
          error: 'CXCC_API_ERROR',
          message: apiMsg,
          details: apiMsg,
        },
        { status: 502 }
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('录音清单（CXCC）路由错误:', error)
    return NextResponse.json(
      {
        code: -1,
        error: 'CXCC_ROUTE_ERROR',
        message: msg,
        details: msg,
      },
      { status: 500 }
    )
  }
}
