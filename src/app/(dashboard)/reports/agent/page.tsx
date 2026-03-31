'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Search, 
  RefreshCw, 
  Download,
  FileSpreadsheet
} from 'lucide-react'

// 任务名称列表
const tasks = [
  { id: '1', name: '宽带升级营销' },
  { id: '2', name: '5G套餐推广' },
  { id: '3', name: '流量包销售' }
]

// 地市列表
const cities = [
  { code: '4401', name: '广州' },
  { code: '4403', name: '深圳' },
  { code: '4404', name: '珠海' },
  { code: '4405', name: '汕头' },
  { code: '4406', name: '佛山' },
  { code: '4407', name: '江门' },
  { code: '4408', name: '湛江' },
  { code: '4409', name: '茂名' },
  { code: '4412', name: '肇庆' },
  { code: '4413', name: '惠州' },
  { code: '4414', name: '梅州' },
  { code: '4415', name: '汕尾' },
  { code: '4416', name: '河源' },
  { code: '4417', name: '阳江' },
  { code: '4418', name: '清远' },
  { code: '4419', name: '东莞' },
  { code: '4420', name: '中山' },
  { code: '4451', name: '潮州' },
  { code: '4452', name: '揭阳' },
  { code: '4453', name: '云浮' },
  { code: '4421', name: '韶关' }
]

// 模拟坐席报表数据
const mockAgentReports = [
  {
    id: 1,
    agentCode: '1147',
    agentName: '林宇君',
    taskName: '宽带升级营销',
    totalCalls: 156,
    connectedCalls: 124,
    successCalls: 89,
    successRate: 57.1,
    avgCallDuration: 125,
    totalDuration: 19500,
    city: '广州'
  },
  {
    id: 2,
    agentCode: '1148',
    agentName: '刘土梅',
    taskName: '宽带升级营销',
    totalCalls: 142,
    connectedCalls: 118,
    successCalls: 76,
    successRate: 53.5,
    avgCallDuration: 118,
    totalDuration: 16756,
    city: '深圳'
  },
  {
    id: 3,
    agentCode: '1149',
    agentName: '张小明',
    taskName: '5G套餐推广',
    totalCalls: 178,
    connectedCalls: 145,
    successCalls: 98,
    successRate: 55.1,
    avgCallDuration: 132,
    totalDuration: 23496,
    city: '佛山'
  },
  {
    id: 4,
    agentCode: '1150',
    agentName: '李小红',
    taskName: '宽带升级营销',
    totalCalls: 134,
    connectedCalls: 108,
    successCalls: 72,
    successRate: 53.7,
    avgCallDuration: 115,
    totalDuration: 15410,
    city: '东莞'
  },
  {
    id: 5,
    agentCode: '1151',
    agentName: '王大伟',
    taskName: '5G套餐推广',
    totalCalls: 165,
    connectedCalls: 132,
    successCalls: 85,
    successRate: 51.5,
    avgCallDuration: 128,
    totalDuration: 21120,
    city: '珠海'
  },
  {
    id: 6,
    agentCode: '1152',
    agentName: '陈小芳',
    taskName: '流量包销售',
    totalCalls: 198,
    connectedCalls: 168,
    successCalls: 112,
    successRate: 56.6,
    avgCallDuration: 98,
    totalDuration: 19404,
    city: '广州'
  },
  {
    id: 7,
    agentCode: '1153',
    agentName: '赵大力',
    taskName: '流量包销售',
    totalCalls: 145,
    connectedCalls: 112,
    successCalls: 68,
    successRate: 46.9,
    avgCallDuration: 145,
    totalDuration: 21025,
    city: '江门'
  },
  {
    id: 8,
    agentCode: '1154',
    agentName: '周小敏',
    taskName: '宽带升级营销',
    totalCalls: 167,
    connectedCalls: 138,
    successCalls: 95,
    successRate: 56.9,
    avgCallDuration: 122,
    totalDuration: 20374,
    city: '惠州'
  }
]

export default function AgentReportPage() {
  const [reports] = useState(mockAgentReports)
  const [filters, setFilters] = useState({
    taskName: 'all',
    agentCode: '',
    city: 'all',
    startDate: '',
    endDate: ''
  })

  // 筛选数据
  const filteredReports = reports.filter(report => {
    if (filters.taskName !== 'all' && report.taskName !== filters.taskName) {
      return false
    }
    if (filters.agentCode && !report.agentCode.includes(filters.agentCode)) {
      return false
    }
    if (filters.city !== 'all' && report.city !== filters.city) {
      return false
    }
    return true
  })

  // 计算合计
  const totals = filteredReports.reduce((acc, report) => ({
    totalCalls: acc.totalCalls + report.totalCalls,
    connectedCalls: acc.connectedCalls + report.connectedCalls,
    successCalls: acc.successCalls + report.successCalls,
    totalDuration: acc.totalDuration + report.totalDuration
  }), { totalCalls: 0, connectedCalls: 0, successCalls: 0, totalDuration: 0 })

  const handleRefresh = () => {
    // 刷新数据
    console.log('Refreshing data...')
  }

  const handleExport = () => {
    // 导出数据
    const headers = ['坐席工号', '坐席姓名', '任务名称', '地市', '总呼叫量', '接通量', '成功量', '成功率(%)', '平均通话时长(秒)', '总通话时长(秒)']
    const rows = filteredReports.map(report => [
      report.agentCode,
      report.agentName,
      report.taskName,
      report.city,
      report.totalCalls,
      report.connectedCalls,
      report.successCalls,
      report.successRate,
      report.avgCallDuration,
      report.totalDuration
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `坐席报表_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}时${minutes}分${secs}秒`
    }
    return `${minutes}分${secs}秒`
  }

  return (
    <div className="space-y-6">
      {/* 面包屑导航 */}
      <div className="text-sm text-gray-500">
        主页 / 报表查询 / 坐席报表
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">坐席报表</h1>
        <p className="text-gray-500">查看坐席工作统计数据</p>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">查询筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="text-sm font-medium mb-2 block">任务名称</label>
              <Select
                value={filters.taskName}
                onValueChange={(value) => setFilters({ ...filters, taskName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部任务" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部任务</SelectItem>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.name}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">地市</label>
              <Select
                value={filters.city}
                onValueChange={(value) => setFilters({ ...filters, city: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部地市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部地市</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city.code} value={city.name}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">工号</label>
              <Input
                placeholder="请输入坐席工号"
                value={filters.agentCode}
                onChange={(e) => setFilters({ ...filters, agentCode: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">开始日期</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">结束日期</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button>
                <Search className="h-4 w-4 mr-2" />
                查询
              </Button>
              <Button variant="outline" onClick={() => setFilters({
                taskName: 'all',
                agentCode: '',
                city: 'all',
                startDate: '',
                endDate: ''
              })}>
                清空
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                坐席统计数据
              </CardTitle>
              <CardDescription>共 {filteredReports.length} 条记录</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>坐席工号</TableHead>
                  <TableHead>坐席姓名</TableHead>
                  <TableHead>任务名称</TableHead>
                  <TableHead>地市</TableHead>
                  <TableHead className="text-right">总呼叫量</TableHead>
                  <TableHead className="text-right">接通量</TableHead>
                  <TableHead className="text-right">成功量</TableHead>
                  <TableHead className="text-right">成功率(%)</TableHead>
                  <TableHead className="text-right">平均通话时长</TableHead>
                  <TableHead className="text-right">总通话时长</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.agentCode}</TableCell>
                    <TableCell>{report.agentName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.taskName}</Badge>
                    </TableCell>
                    <TableCell>{report.city}</TableCell>
                    <TableCell className="text-right">{report.totalCalls}</TableCell>
                    <TableCell className="text-right">{report.connectedCalls}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {report.successCalls}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={report.successRate >= 55 ? 'default' : 'secondary'}>
                        {report.successRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{report.avgCallDuration}秒</TableCell>
                    <TableCell className="text-right">{formatDuration(report.totalDuration)}</TableCell>
                  </TableRow>
                ))}
                {/* 合计行 */}
                <TableRow className="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <TableCell colSpan={4}>合计</TableCell>
                  <TableCell className="text-right">{totals.totalCalls}</TableCell>
                  <TableCell className="text-right">{totals.connectedCalls}</TableCell>
                  <TableCell className="text-right text-green-600">{totals.successCalls}</TableCell>
                  <TableCell className="text-right">
                    {((totals.successCalls / totals.totalCalls) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round(totals.totalDuration / filteredReports.length)}秒
                  </TableCell>
                  <TableCell className="text-right">{formatDuration(totals.totalDuration)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
