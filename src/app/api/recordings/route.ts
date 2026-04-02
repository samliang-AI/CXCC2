import { NextRequest, NextResponse } from 'next/server'
import { readLocalRecordingsByDateRange } from '@/lib/local-recording-store-optimized'

async function handleList(request: NextRequest) {
  try {
    // 使用 request.nextUrl.searchParams 直接获取查询参数，避免使用 request.url
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate and endDate' },
        { status: 400 }
      )
    }

    const recordings = await readLocalRecordingsByDateRange({
      startDate,
      endDate
    })

    return NextResponse.json({
      code: 0,
      message: 'OK',
      data: recordings
    })
  } catch (error) {
    console.error('获取录音数据失败:', error)
    return NextResponse.json(
      { error: 'Failed to get recordings data' },
      { status: 500 }
    )
  }
}

async function handleSuccessCustomers(request: NextRequest) {
  try {
    // 使用 request.nextUrl.searchParams 直接获取查询参数，避免使用 request.url
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: startDate and endDate' },
        { status: 400 }
      )
    }

    const recordings = await readLocalRecordingsByDateRange({
      startDate,
      endDate
    })

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

export async function GET(request: NextRequest) {
  // 使用 request.nextUrl.searchParams 直接获取查询参数，避免使用 request.url
  const action = request.nextUrl.searchParams.get('action')

  switch (action) {
    case 'list':
      return handleList(request)
    case 'success-customers':
      return handleSuccessCustomers(request)
    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: list, success-customers' },
        { status: 400 }
      )
  }
}
