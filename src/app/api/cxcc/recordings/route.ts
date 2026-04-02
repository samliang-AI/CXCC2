import { NextRequest, NextResponse } from 'next/server'
import { fetchCxccAgentRecordList, mapCxccRecordToRecordingRow } from '@/lib/cxcc-agent-record-list'

// GET - 实时查询 CXCC API 录音清单数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const agent = searchParams.get('agent')
    const projectId = searchParams.get('projectId')
    const calledPhone = searchParams.get('calledPhone')
    const callingPhone = searchParams.get('callingPhone')
    
    // 确定时间范围
    let targetStartTime, targetEndTime
    if (startTime && endTime) {
      targetStartTime = startTime
      targetEndTime = endTime
    } else if (date) {
      targetStartTime = `${date} 00:00:00`
      targetEndTime = `${date} 23:59:59`
    } else {
      // 如果没有提供日期，使用今天的日期
      const today = new Date().toISOString().split('T')[0]
      targetStartTime = `${today} 00:00:00`
      targetEndTime = `${today} 23:59:59`
    }
    
    // 构建查询参数
    const params: {
      pageNum: number;
      pageSize: number;
      startTime: string;
      endTime: string;
      agent?: string;
      projectId?: number;
      calledPhone?: string;
      callingPhone?: string;
    } = {
      pageNum: page,
      pageSize: pageSize,
      startTime: targetStartTime,
      endTime: targetEndTime
    }
    
    if (agent) {
      params.agent = agent
    }
    
    if (projectId) {
      params.projectId = parseInt(projectId)
    }
    
    if (calledPhone) {
      params.calledPhone = calledPhone
    }
    
    if (callingPhone) {
      params.callingPhone = callingPhone
    }
    
    // 实时查询 CXCC API（录音清单专用路径）
    const result = await fetchCxccAgentRecordList(params, {
      primaryPath: '/om/agentCalldetailList/selectRecordList/api'
    })
    
    // 映射数据格式
    const recordings = result.records.map((record, index) => mapCxccRecordToRecordingRow(record, index))
    
    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: {
        records: recordings,
        total: result.total,
        page: page,
        pageSize: pageSize
      },
      rows: recordings,
      total: result.total,
      page: page,
      pageSize: pageSize,
      dataSource: 'CXCC API 实时查询'
    })
  } catch (error) {
    console.error('实时查询录音清单数据失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      {
        code: 500,
        message: `实时查询失败：${errorMessage}`,
        data: {
          records: [],
          total: 0,
          page: 1,
          pageSize: 10
        },
        rows: [],
        total: 0,
        page: 1,
        pageSize: 10,
        dataSource: 'CXCC API 实时查询'
      },
      { status: 500 }
    )
  }
}