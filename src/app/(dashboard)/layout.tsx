'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  FileAudio, 
  ClipboardCheck, 
  Settings, 
  Users, 
  Shield, 
  Key,
  Menu,
  X,
  LogOut,
  User,
  BarChart3,
  FileSpreadsheet,
  Database,
  Users2,
  Headphones,
  PhoneCall,
  List,
  Filter,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getAuth } from '@/lib/auth/config'

interface SidebarItem {
  title: string
  href: string
  icon: React.ReactNode
  children?: SidebarItem[]
  permission?: string
}

const sidebarItems: SidebarItem[] = [
  {
    title: '智能数据机器人',
    href: '/chat',
    icon: <Sparkles className="h-5 w-5" />,
    permission: 'chat:use'
  },
  {
    title: '经营分析',
    href: '/business-analysis',
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      {
        title: '收益看板',
        href: '/business-analysis/revenue-dashboard',
        icon: <BarChart3 className="h-5 w-5" />,
        permission: 'business-analysis:revenue'
      },
      {
        title: '业务订单',
        href: '/business-analysis/orders',
        icon: <FileSpreadsheet className="h-5 w-5" />,
        permission: 'business-analysis:orders'
      }
    ]
  },
  {
    title: '数据来源',
    href: '/data-sources',
    icon: <Database className="h-5 w-5" />,
    children: [
      {
        title: '数据上传',
        href: '/data-sources/upload',
        icon: <FileSpreadsheet className="h-5 w-5" />,
        permission: 'data-sources:upload'
      },
      {
        title: '数据分析',
        href: '/data-sources/analysis',
        icon: <BarChart3 className="h-5 w-5" />,
        permission: 'data-sources:analysis'
      }
    ]
  },
  {
    title: '报表查询',
    href: '/reports',
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      {
        title: '数据看板',
        href: '/dashboard',
        icon: <LayoutDashboard className="h-5 w-5" />,
        permission: 'dashboard:view'
      },
      {
        title: '团队看板',
        href: '/reports/team',
        icon: <Users2 className="h-5 w-5" />,
        permission: 'reports:team'
      },
      {
        title: '外呼结果',
        href: '/reports/outbound-result',
        icon: <PhoneCall className="h-5 w-5" />,
        permission: 'reports:outbound-result'
      },
      {
        title: '类型筛选',
        href: '/reports/type-filter',
        icon: <Filter className="h-5 w-5" />,
        permission: 'reports:type-filter'
      }
    ]
  },
  {
    title: '数据查询',
    href: '/data',
    icon: <Database className="h-5 w-5" />,
    children: [
      {
        title: '录音清单',
        href: '/recordings',
        icon: <FileAudio className="h-5 w-5" />,
        permission: 'recording:view'
      },
      {
        title: '质检管理',
        href: '/quality',
        icon: <ClipboardCheck className="h-5 w-5" />,
        permission: 'quality:view'
      },
      {
        title: '坐席报表',
        href: '/reports/agent',
        icon: <FileSpreadsheet className="h-5 w-5" />,
        permission: 'reports:agent'
      },
      {
        title: '通话清单',
        href: '/data/call-logs',
        icon: <List className="h-5 w-5" />,
        permission: 'data:call-logs'
      }
    ]
  },
  {
    title: '系统管理',
    href: '/system',
    icon: <Settings className="h-5 w-5" />,
    children: [
      {
        title: '用户管理',
        href: '/system/users',
        icon: <Users className="h-5 w-5" />,
        permission: 'system:user'
      },
      {
        title: '角色管理',
        href: '/system/roles',
        icon: <Shield className="h-5 w-5" />,
        permission: 'system:role'
      },
      {
        title: '权限管理',
        href: '/system/permissions',
        icon: <Key className="h-5 w-5" />,
        permission: 'system:permission'
      },
      {
        title: '外呼团队',
        href: '/system/teams',
        icon: <Users2 className="h-5 w-5" />,
        permission: 'system:team'
      },
      {
        title: '坐席设置',
        href: '/system/agents',
        icon: <Headphones className="h-5 w-5" />,
        permission: 'system:agent'
      }
    ]
  }
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // 获取真实的用户信息
  const user = getAuth()?.user || {
    username: 'admin',
    realName: '超级管理员',
    roleCode: 'SUPER_ADMIN'
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">BPO经营分析管理系统</h1>
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {sidebarItems.map((item) => (
            <div key={item.href}>
              {item.children ? (
                <>
                  <div className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    {item.title}
                  </div>
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
                        isActive(child.href)
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      )}
                    >
                      {child.icon}
                      <span>{child.title}</span>
                    </Link>
                  ))}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  )}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 shadow-sm">
          <div className="flex items-center justify-between h-full px-4">
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarFallback>{user.realName[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.realName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.username}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>个人中心</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>退出登录</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
