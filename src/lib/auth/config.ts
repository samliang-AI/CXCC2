import { redirect } from 'next/navigation'

const TOKEN_KEY = 'qms_token'
const USER_KEY = 'qms_user'

export interface AuthUser {
  id: number
  username: string
  realName: string
  roleCode: string
  cityName?: string
}

export function setAuth(token: string, user: AuthUser) {
  // 只在客户端环境使用localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function getAuth(): { token: string; user: AuthUser } | null {
  // 只在客户端环境从localStorage获取
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    const userStr = localStorage.getItem(USER_KEY)
    
    if (!token || !userStr) {
      return null
    }
    
    try {
      const user = JSON.parse(userStr) as AuthUser
      return { token, user }
    } catch {
      return null
    }
  }
  return null
}

export function clearAuth() {
  // 只在客户端环境清除localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

export function requireAuth() {
  const auth = getAuth()
  if (!auth) {
    redirect('/login')
  }
  return auth
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  // 超级管理员拥有所有权限
  if (user.roleCode === 'SUPER_ADMIN') {
    return true
  }
  
  // 质检人权限
  if (user.roleCode === 'QUALITY_INSPECTOR') {
    const allowedPermissions = [
      'recording:view',
      'recording:play',
      'recording:download',
      'recording:edit',
      'quality:score',
      'quality:view',
      'dashboard:view'
    ]
    return allowedPermissions.includes(permission)
  }
  
  // 观看者权限
  if (user.roleCode === 'VIEWER') {
    const allowedPermissions = [
      'recording:view',
      'recording:play',
      'recording:download',
      'quality:view',
      'dashboard:view'
    ]
    return allowedPermissions.includes(permission)
  }
  
  return false
}
