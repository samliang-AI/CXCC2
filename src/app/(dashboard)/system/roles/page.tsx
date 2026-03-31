'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Shield, Edit } from 'lucide-react'
import { toast } from 'sonner'

// 模拟角色数据
const mockRoles = [
  {
    id: 1,
    roleName: '超级管理员',
    roleCode: 'SUPER_ADMIN',
    roleLevel: 1,
    description: '拥有系统所有权限,可管理所有数据和用户',
    status: 1,
    permissions: ['all']
  },
  {
    id: 2,
    roleName: '质检人',
    roleCode: 'QUALITY_INSPECTOR',
    roleLevel: 2,
    description: '可查看/编辑全部数据,进行质检评分操作',
    status: 1,
    permissions: ['recording:view', 'recording:play', 'recording:download', 'recording:edit', 'quality:score', 'quality:view', 'dashboard:view']
  },
  {
    id: 3,
    roleName: '观看者',
    roleCode: 'VIEWER',
    roleLevel: 3,
    description: '仅可播放/下载录音,按地市查看数据',
    status: 1,
    permissions: ['recording:view', 'recording:play', 'recording:download', 'quality:view', 'dashboard:view']
  }
]

// 所有权限列表
const allPermissions = [
  { code: 'recording:view', name: '录音查看', module: '录音清单' },
  { code: 'recording:play', name: '录音播放', module: '录音清单' },
  { code: 'recording:download', name: '录音下载', module: '录音清单' },
  { code: 'recording:edit', name: '录音编辑', module: '录音清单' },
  { code: 'quality:view', name: '质检查看', module: '质检管理' },
  { code: 'quality:score', name: '质检评分', module: '质检管理' },
  { code: 'dashboard:view', name: '看板查看', module: '数据看板' },
  { code: 'system:user', name: '用户管理', module: '系统管理' },
  { code: 'system:role', name: '角色管理', module: '系统管理' },
  { code: 'system:permission', name: '权限管理', module: '系统管理' }
]

export default function RolesPage() {
  const [roles] = useState(mockRoles)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [selectedRole, setSelectedRole] = useState<any>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  const handleEditPermissions = (role: any) => {
    setSelectedRole(role)
    setSelectedPermissions(role.permissions.includes('all') 
      ? allPermissions.map(p => p.code) 
      : role.permissions
    )
    setShowPermissionDialog(true)
  }

  const handlePermissionChange = (code: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, code])
    } else {
      setSelectedPermissions(selectedPermissions.filter(p => p !== code))
    }
  }

  const handleSavePermissions = () => {
    // 实际项目中应该调用API保存权限配置
    toast.success('权限配置已保存!')
    setShowPermissionDialog(false)
  }

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {} as Record<string, typeof allPermissions>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">角色管理</h1>
        <p className="text-gray-500">管理系统角色与权限配置</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            角色列表
          </CardTitle>
          <CardDescription>共 {roles.length} 个角色</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>角色名称</TableHead>
                <TableHead>角色编码</TableHead>
                <TableHead>角色级别</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>权限数量</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.roleName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{role.roleCode}</Badge>
                  </TableCell>
                  <TableCell>{role.roleLevel}</TableCell>
                  <TableCell className="max-w-xs truncate">{role.description}</TableCell>
                  <TableCell>
                    <Badge variant={role.status === 1 ? 'default' : 'secondary'}>
                      {role.status === 1 ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes('all') ? '全部权限' : role.permissions.length}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditPermissions(role)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      配置权限
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 权限配置对话框 */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>配置权限 - {selectedRole?.roleName}</DialogTitle>
            <DialogDescription>
              为角色分配系统功能权限
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {Object.entries(groupedPermissions).map(([module, permissions]) => (
              <div key={module} className="space-y-2">
                <h4 className="font-semibold text-sm">{module}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {permissions.map((perm) => (
                    <div key={perm.code} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.code}
                        checked={selectedPermissions.includes(perm.code)}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(perm.code, checked as boolean)
                        }
                        disabled={selectedRole?.roleCode === 'SUPER_ADMIN'}
                      />
                      <label
                        htmlFor={perm.code}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {perm.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSavePermissions}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
