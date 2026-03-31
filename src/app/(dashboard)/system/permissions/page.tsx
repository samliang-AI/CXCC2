'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Key } from 'lucide-react'

// 定义权限类型
interface Permission {
  id: number
  permissionName: string
  permissionCode: string
  permissionType: number
  parentId: number
  path: string | null
  icon: string | null
  sort: number
  status: number
  children?: Permission[]
}

// 模拟权限数据
const mockPermissions: Permission[] = [
  {
    id: 1,
    permissionName: '录音清单',
    permissionCode: 'recording',
    permissionType: 1,
    parentId: 0,
    path: '/recordings',
    icon: 'FileAudio',
    sort: 1,
    status: 1
  },
  {
    id: 2,
    permissionName: '录音查看',
    permissionCode: 'recording:view',
    permissionType: 3,
    parentId: 1,
    path: null,
    icon: null,
    sort: 1,
    status: 1
  },
  {
    id: 3,
    permissionName: '录音播放',
    permissionCode: 'recording:play',
    permissionType: 3,
    parentId: 1,
    path: null,
    icon: null,
    sort: 2,
    status: 1
  },
  {
    id: 4,
    permissionName: '录音下载',
    permissionCode: 'recording:download',
    permissionType: 3,
    parentId: 1,
    path: null,
    icon: null,
    sort: 3,
    status: 1
  },
  {
    id: 5,
    permissionName: '录音编辑',
    permissionCode: 'recording:edit',
    permissionType: 3,
    parentId: 1,
    path: null,
    icon: null,
    sort: 4,
    status: 1
  },
  {
    id: 6,
    permissionName: '质检管理',
    permissionCode: 'quality',
    permissionType: 1,
    parentId: 0,
    path: '/quality',
    icon: 'ClipboardCheck',
    sort: 2,
    status: 1
  },
  {
    id: 7,
    permissionName: '质检查看',
    permissionCode: 'quality:view',
    permissionType: 3,
    parentId: 6,
    path: null,
    icon: null,
    sort: 1,
    status: 1
  },
  {
    id: 8,
    permissionName: '质检评分',
    permissionCode: 'quality:score',
    permissionType: 3,
    parentId: 6,
    path: null,
    icon: null,
    sort: 2,
    status: 1
  },
  {
    id: 9,
    permissionName: '数据看板',
    permissionCode: 'dashboard',
    permissionType: 1,
    parentId: 0,
    path: '/dashboard',
    icon: 'LayoutDashboard',
    sort: 3,
    status: 1
  },
  {
    id: 10,
    permissionName: '看板查看',
    permissionCode: 'dashboard:view',
    permissionType: 3,
    parentId: 9,
    path: null,
    icon: null,
    sort: 1,
    status: 1
  },
  {
    id: 11,
    permissionName: '系统管理',
    permissionCode: 'system',
    permissionType: 1,
    parentId: 0,
    path: '/system',
    icon: 'Settings',
    sort: 4,
    status: 1
  },
  {
    id: 12,
    permissionName: '用户管理',
    permissionCode: 'system:user',
    permissionType: 2,
    parentId: 11,
    path: '/system/users',
    icon: 'Users',
    sort: 1,
    status: 1
  },
  {
    id: 13,
    permissionName: '角色管理',
    permissionCode: 'system:role',
    permissionType: 2,
    parentId: 11,
    path: '/system/roles',
    icon: 'Shield',
    sort: 2,
    status: 1
  },
  {
    id: 14,
    permissionName: '权限管理',
    permissionCode: 'system:permission',
    permissionType: 2,
    parentId: 11,
    path: '/system/permissions',
    icon: 'Key',
    sort: 3,
    status: 1
  }
]

const typeMap: Record<number, string> = {
  1: '菜单',
  2: '页面',
  3: '接口'
}

export default function PermissionsPage() {
  const [permissions] = useState(mockPermissions)

  // 构建权限树结构
  const buildPermissionTree = (permissions: Permission[], parentId = 0): Permission[] => {
    return permissions
      .filter(p => p.parentId === parentId)
      .map(p => ({
        ...p,
        children: buildPermissionTree(permissions, p.id)
      }))
      .sort((a, b) => a.sort - b.sort)
  }

  const renderPermissionRow = (permission: Permission, level = 0): React.ReactElement[] => {
    const rows = [
      <TableRow key={permission.id}>
        <TableCell>
          <div style={{ paddingLeft: `${level * 20}px` }} className="flex items-center gap-2">
            {permission.children && permission.children.length > 0 && (
              <span className="text-gray-400">└</span>
            )}
            <span className="font-medium">{permission.permissionName}</span>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline">{permission.permissionCode}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{typeMap[permission.permissionType]}</Badge>
        </TableCell>
        <TableCell>{permission.path || '-'}</TableCell>
        <TableCell>{permission.icon || '-'}</TableCell>
        <TableCell>{permission.sort}</TableCell>
        <TableCell>
          <Badge variant={permission.status === 1 ? 'default' : 'secondary'}>
            {permission.status === 1 ? '启用' : '禁用'}
          </Badge>
        </TableCell>
      </TableRow>
    ]

    if (permission.children && permission.children.length > 0) {
      permission.children.forEach((child: Permission) => {
        rows.push(...renderPermissionRow(child, level + 1))
      })
    }

    return rows
  }

  const permissionTree = buildPermissionTree(permissions)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">权限管理</h1>
        <p className="text-gray-500">查看系统权限配置</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            权限列表
          </CardTitle>
          <CardDescription>
            系统权限树形结构展示
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>权限名称</TableHead>
                <TableHead>权限编码</TableHead>
                <TableHead>权限类型</TableHead>
                <TableHead>路由路径</TableHead>
                <TableHead>图标</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionTree.map((permission) => renderPermissionRow(permission))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
