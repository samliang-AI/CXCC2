import { NextRequest, NextResponse } from 'next/server'
import { loginToCxcc, getValidToken, clearTokenCache, getCurrentToken } from '@/lib/cxcc-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, companyName } = body

    const loginUsername = username || process.env.CXCC_USERNAME || 'admin'
    const loginPassword = password || process.env.CXCC_PASSWORD || 'gzxr147++'
    const loginCompanyName = companyName || process.env.CXCC_COMPANY_NAME || '广州新瑞'

    const baseUrl = (process.env.CXCC_BASE_URL || 'https://1.14.207.148:9526').replace(/\/$/, '')
    const loginUrl = `${baseUrl}/system/login`

    const loginBody = {
      companyName: loginCompanyName,
      password: loginPassword,
      username: loginUsername,
    }

    console.log('[API] /api/cxcc/login 正在调用 CXCC 登录接口...')

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginBody),
    })

    const text = await response.text()

    if (!response.ok) {
      console.error('[API] /api/cxcc/login 登录失败:', response.status, text)
      return NextResponse.json(
        { success: false, error: `登录失败: HTTP ${response.status}`, details: text },
        { status: response.status }
      )
    }

    let data: { code?: number; msg?: string; data?: { token?: string } }
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { success: false, error: '登录响应解析失败', raw: text },
        { status: 500 }
      )
    }

    if (data.code !== 0 && data.code !== 200) {
      return NextResponse.json(
        { success: false, error: data.msg || '登录失败', code: data.code },
        { status: 400 }
      )
    }

    if (!data.data?.token) {
      return NextResponse.json(
        { success: false, error: '登录响应中未找到 token', raw: data },
        { status: 500 }
      )
    }

    await loginToCxcc()

    return NextResponse.json({
      success: true,
      message: '登录成功',
      token: data.data.token,
    })
  } catch (error: any) {
    console.error('[API] /api/cxcc/login error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '登录失败' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const token = await getValidToken(false)
    return NextResponse.json({
      success: true,
      authenticated: true,
      hasToken: !!token,
      token: token ? token.substring(0, 20) + '...' : null,
    })
  } catch (error: any) {
    console.error('[API] /api/cxcc/login GET error:', error)
    return NextResponse.json({
      success: false,
      authenticated: false,
      error: error.message || '获取 token 失败',
    })
  }
}

export async function DELETE() {
  try {
    clearTokenCache()
    return NextResponse.json({
      success: true,
      message: '已清除 token 缓存',
    })
  } catch (error: any) {
    console.error('[API] /api/cxcc/login DELETE error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '清除 token 失败' },
      { status: 500 }
    )
  }
}
