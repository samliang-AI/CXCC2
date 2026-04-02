import { NextRequest, NextResponse } from 'next/server'
import { clearAuth } from '@/lib/auth/config'

export const dynamic = 'force-dynamic'

async function handleLogin(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, role } = body

    if (!username || !password || !role) {
      return NextResponse.json({
        code: 6001,
        message: '请输入用户名、密码和角色',
        data: null
      })
    }

    const mockUsers: Record<string, any> = {
      'admin': {
        id: 1,
        username: 'admin',
        realName: '管理员',
        roleCode: 'admin',
        roleName: '管理员'
      },
      'user': {
        id: 2,
        username: 'user',
        realName: '普通用户',
        roleCode: 'user',
        roleName: '普通用户'
      }
    }

    const user = mockUsers[username]
    
    if (!user || password !== '123456' || user.roleCode !== role) {
      return NextResponse.json({
        code: 6001,
        message: '用户名或密码错误',
        data: null
      })
    }

    const token = `token_${username}_${Date.now()}`

    return NextResponse.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        userInfo: user
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      code: 500,
      message: error.message || '服务器错误',
      data: null
    })
  }
}

async function handleLogout() {
  try {
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

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  switch (action) {
    case 'login':
      return handleLogin(request)
    case 'logout':
      return handleLogout()
    default:
      return NextResponse.json(
        { error: 'Invalid action. Supported actions: login, logout' },
        { status: 400 }
      )
  }
}
