import { NextRequest, NextResponse } from 'next/server'
import { readLocalRecordingsByDateRange } from '@/lib/local-recording-store-optimized'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate and endDate' },
        { status: 400 }
      )
    }

    // 读取录音清单数据
    const recordings = await readLocalRecordingsByDateRange({
      startDate,
      endDate
    })

    // 过滤出客户状态为"成功客户"的记录
    const successCustomers = recordings.filter(recording => 
      recording.status_name === '成功客户'
    )

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: successCustomers
    })
  } catch (error) {
    console.error('获取成功客户数据失败:', error)
    return NextResponse.json(
      { error: 'Failed to get success customers data' },
      { status: 500 }
    )
  }
}
