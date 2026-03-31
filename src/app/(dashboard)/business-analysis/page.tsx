'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function BusinessAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">经营分析</h1>
        <p className="text-gray-500">BPO经营分析管理系统</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>经营分析</CardTitle>
          <CardDescription>
            选择左侧菜单查看具体的分析数据
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-2">收益看板</h3>
              <p className="text-gray-600">查看公司的收益情况，包括收入、成本、利润等指标</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-medium mb-2">业务订单</h3>
              <p className="text-gray-600">查看业务订单的详细信息，包括订单状态、金额等</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}