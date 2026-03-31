'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">报表查询</h1>
        <p className="text-gray-500">查看各类统计报表</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            报表查询
          </CardTitle>
          <CardDescription>请从左侧菜单选择要查看的报表</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>请从左侧菜单选择要查看的报表类型</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
