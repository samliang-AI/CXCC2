'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  Search, 
  Plus, 
  Edit,
  Trash2,
  Users
} from 'lucide-react'
import { toast } from 'sonner'

// 定义用户类型
interface User {
  id: number
  username: string
  realName: string
  phone: string
  email: string
  cityCode: string | null
  cityName: string | null
  roleId: number
  roleName: string
  status: number
  lastLoginTime: string | null
  createdAt: string
}

// 模拟用户数据
const mockUsers: User[] = [
  {
    id: 1,
    username: 'admin',
    realName: '超级管理员',
    phone: '13800138000',
    email: 'admin@example.com',
    cityCode: null,
    cityName: null,
    roleId: 1,
    roleName: '超级管理员',
    status: 1,
    lastLoginTime: '2026-03-09 10:30:00',
    createdAt: '2026-01-01 00:00:00'
  },
  {
    id: 2,
    username: 'quality',
    realName: '质检员',
    phone: '13900139000',
    email: 'quality@example.com',
    cityCode: null,
    cityName: null,
    roleId: 2,
    roleName: '质检人',
    status: 1,
    lastLoginTime: '2026-03-09 09:15:00',
    createdAt: '2026-02-01 00:00:00'
  },
  {
    id: 3,
    username: 'viewer_gz',
    realName: '广州观看者',
    phone: '13700137000',
    email: 'viewer.gz@example.com',
    cityCode: '4401',
    cityName: '广州',
    roleId: 3,
    roleName: '观看者',
    status: 1,
    lastLoginTime: '2026-03-08 16:45:00',
    createdAt: '2026-02-15 00:00:00'
  },
  {
    id: 4,
    username: 'viewer_sz',
    realName: '深圳观看者',
    phone: '13600136000',
    email: 'viewer.sz@example.com',
    cityCode: '4403',
    cityName: '深圳',
    roleId: 3,
    roleName: '观看者',
    status: 0,
    lastLoginTime: null,
    createdAt: '2026-02-20 00:00:00'
  }
]

const roles = [
  { id: 1, name: '超级管理员', code: 'SUPER_ADMIN' },
  { id: 2, name: '质检人', code: 'QUALITY_INSPECTOR' },
  { id: 3, name: '观看者', code: 'VIEWER' }
]

const cities = [
  { code: '4401', name: '广州' },
  { code: '4403', name: '深圳' },
  { code: '4404', name: '珠海' },
  { code: '4405', name: '汕头' },
  { code: '4406', name: '佛山' }
]

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userForm, setUserForm] = useState({
    username: '',
    realName: '',
    phone: '',
    email: '',
    cityCode: '',
    roleId: '',
    status: 1
  })

  const handleAdd = () => {
    setUserForm({
      username: '',
      realName: '',
      phone: '',
      email: '',
      cityCode: '',
      roleId: '',
      status: 1
    })
    setShowAddDialog(true)
  }

  const handleEdit = (user: any) => {
    setSelectedUser(user)
    setUserForm({
      username: user.username,
      realName: user.realName,
      phone: user.phone,
      email: user.email,
      cityCode: user.cityCode || '',
      roleId: user.roleId.toString(),
      status: user.status
    })
    setShowEditDialog(true)
  }

  const handleDelete = (user: any) => {
    setSelectedUser(user)
    setShowDeleteDialog(true)
  }

  const handleSubmitAdd = () => {
    const role = roles.find(r => r.id === parseInt(userForm.roleId))
    const city = cities.find(c => c.code === userForm.cityCode)
    
    const newUser = {
      id: users.length + 1,
      username: userForm.username,
      realName: userForm.realName,
      phone: userForm.phone,
      email: userForm.email,
      cityCode: userForm.cityCode || null,
      cityName: city?.name || null,
      roleId: parseInt(userForm.roleId),
      roleName: role?.name || '',
      status: userForm.status,
      lastLoginTime: null,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    }
    
    setUsers([...users, newUser])
    setShowAddDialog(false)
    toast.success('用户创建成功!')
  }

  const handleSubmitEdit = () => {
    const role = roles.find(r => r.id === parseInt(userForm.roleId))
    const city = cities.find(c => c.code === userForm.cityCode)
    
    const updatedUsers = users.map(u => {
      if (u.id === selectedUser.id) {
        return {
          ...u,
          ...userForm,
          roleId: parseInt(userForm.roleId),
          roleName: role?.name || '',
          cityName: city?.name || null
        }
      }
      return u
    })
    
    setUsers(updatedUsers)
    setShowEditDialog(false)
    toast.success('用户信息更新成功!')
  }

  const handleConfirmDelete = () => {
    const filteredUsers = users.filter(u => u.id !== selectedUser.id)
    setUsers(filteredUsers)
    setShowDeleteDialog(false)
    toast.success('用户已删除!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
        <p className="text-gray-500">管理系统用户账号与权限</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              用户列表
            </CardTitle>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              新增用户
            </Button>
          </div>
          <CardDescription>共 {users.length} 个用户</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>真实姓名</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>所属地市</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>最后登录</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.realName}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.roleName}</Badge>
                  </TableCell>
                  <TableCell>{user.cityName || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 1 ? 'default' : 'secondary'}>
                      {user.status === 1 ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.lastLoginTime || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 新增用户对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>
              创建新的系统用户账号
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>用户名 *</Label>
              <Input
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label>真实姓名 *</Label>
              <Input
                value={userForm.realName}
                onChange={(e) => setUserForm({ ...userForm, realName: e.target.value })}
                placeholder="请输入真实姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="请输入手机号"
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="请输入邮箱"
              />
            </div>
            <div className="space-y-2">
              <Label>角色 *</Label>
              <Select
                value={userForm.roleId}
                onValueChange={(value) => setUserForm({ ...userForm, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {userForm.roleId === '3' && (
              <div className="space-y-2">
                <Label>所属地市 *</Label>
                <Select
                  value={userForm.cityCode}
                  onValueChange={(value) => setUserForm({ ...userForm, cityCode: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择地市" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.code} value={city.code}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={userForm.status.toString()}
                onValueChange={(value) => setUserForm({ ...userForm, status: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">启用</SelectItem>
                  <SelectItem value="0">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitAdd}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改用户信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={userForm.username}
                disabled
                className="bg-gray-100"
              />
            </div>
            <div className="space-y-2">
              <Label>真实姓名 *</Label>
              <Input
                value={userForm.realName}
                onChange={(e) => setUserForm({ ...userForm, realName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>角色 *</Label>
              <Select
                value={userForm.roleId}
                onValueChange={(value) => setUserForm({ ...userForm, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {userForm.roleId === '3' && (
              <div className="space-y-2">
                <Label>所属地市 *</Label>
                <Select
                  value={userForm.cityCode}
                  onValueChange={(value) => setUserForm({ ...userForm, cityCode: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择地市" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.code} value={city.code}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>状态</Label>
              <Select
                value={userForm.status.toString()}
                onValueChange={(value) => setUserForm({ ...userForm, status: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">启用</SelectItem>
                  <SelectItem value="0">禁用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSubmitEdit}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户 "{selectedUser?.realName}" 吗?此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              确定删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
