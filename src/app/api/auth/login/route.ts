import { NextRequest, NextResponse } from 'next/server'
import { setAuth } from '@/lib/auth/config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, role } = body

    // 简化处理: 根据选择的角色模拟登录
    // 实际项目中应该验证数据库中的用户信息
    const mockUsers: Record<string, any> = {
      'admin': {
        id: 1,
        username: 'admin',
        realName: '超级管理员',
        roleCode: 'SUPER_ADMIN',
        cityName: null
      },
      'quality': {
        id: 2,
        username: 'quality',
        realName: '质检员',
        roleCode: 'QUALITY_INSPECTOR',
        cityName: null
      },
      'viewer': {
        id: 3,
        username: 'viewer',
        realName: '观看者',
        roleCode: 'VIEWER',
        cityName: '广州'
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

    // 生成简单的token (实际项目应该使用JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
    
    // 设置认证信息
    setAuth(token, {
      id: user.id,
      username: user.username,
      realName: user.realName,
      roleCode: user.roleCode,
      cityName: user.cityName
    })

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
