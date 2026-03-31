import { NextRequest, NextResponse } from 'next/server'
import { clearAuth } from '@/lib/auth/config'

export async function POST(request: NextRequest) {
  try {
    // 清除认证信息
    clearAuth()

    return NextResponse.json({
      code: 200,
      message: '注销成功',
      data: null
    })
  } catch (error: any) {
    return NextResponse.json({
      code: 500,
      message: error.message || '服务器错误',
      data: null
    })
  }
}