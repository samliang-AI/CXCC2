// 自定义报表页面
'use client'

import { useState } from 'react'
import { BarChart3, Download, Filter, Calendar, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { customReportAPI } from '@/lib/api'
import { EChart } from '@/components/charts/EChart'
import { toast } from 'sonner'

// 可用指标
const availableMetrics = [
  { id: 'avg_consumption', name: '月均消费', type: 'numeric' },
  { id: 'avg_flow', name: '月均流量', type: 'numeric' },
  { id: 'avg_voice', name: '月均语音', type: 'numeric' },
  { id: 'total_records', name: '总记录数', type: 'count' },
  { id: 'upgrade_rate', name: '升档率', type: 'percentage' },
  { id: 'data_quality', name: '数据质量', type: 'percentage' },
  { id: 'flow_overuse', name: '流量超套', type: 'count' },
  { id: 'voice_overuse', name: '语音超套', type: 'count' }
]

// 可用维度
const availableDimensions = [
  { id: 'package', name: '套餐类型' },
  { id: 'date', name: '日期' },
  { id: 'region', name: '地区' },
  { id: 'customer_segment', name: '客户分层' },
  { id: 'channel', name: '渠道' }
]

export default function CustomReportPage() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  // 切换指标
  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    )
  }

  // 切换维度
  const toggleDimension = (dimensionId: string) => {
    setSelectedDimensions(prev =>
      prev.includes(dimensionId)
        ? prev.filter(id => id !== dimensionId)
        : [...prev, dimensionId]
    )
  }

  // 生成报表
  const handleGenerateReport = async () => {
    if (selectedMetrics.length === 0 || selectedDimensions.length === 0) {
      toast.warning('请至少选择一个指标和一个维度')
      return
    }

    setGenerating(true)
    try {
      const response = await customReportAPI.generateCustomReport(
        selectedMetrics,
        selectedDimensions,
        null,
        dateRange.start && dateRange.end ? { start: dateRange.start, end: dateRange.end } : undefined
      )
      setReportData(response.data)
    } catch (error) {
      console.error('生成报表失败:', error)
      toast.error('生成报表失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  // 导出报表
  const handleExportReport = async (format: 'excel' | 'pdf' | 'csv') => {
    if (!reportData) return
    
    try {
      // 这里应该调用导出 API
      toast.info(`导出${format.toUpperCase()}功能开发中...`)
    } catch (error) {
      console.error('导出失败:', error)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">自定义报表</h1>
          <p className="text-muted-foreground mt-1">
            自定义分析维度和指标，生成专属数据分析报表
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">配置报表</TabsTrigger>
          <TabsTrigger value="preview">报表预览</TabsTrigger>
          <TabsTrigger value="export">导出报表</TabsTrigger>
        </TabsList>

        {/* 配置报表 */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* 选择指标 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  选择指标
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableMetrics.map(metric => (
                  <div key={metric.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={metric.id}
                      checked={selectedMetrics.includes(metric.id)}
                      onCheckedChange={() => toggleMetric(metric.id)}
                    />
                    <Label htmlFor={metric.id} className="flex-1">
                      {metric.name}
                      <Badge variant="outline" className="ml-2 text-xs">
                        {metric.type === 'numeric' ? '数值' : metric.type === 'percentage' ? '百分比' : '计数'}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 选择维度 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  选择维度
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {availableDimensions.map(dimension => (
                  <div key={dimension.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={dimension.id}
                      checked={selectedDimensions.includes(dimension.id)}
                      onCheckedChange={() => toggleDimension(dimension.id)}
                    />
                    <Label htmlFor={dimension.id} className="flex-1">
                      {dimension.name}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 日期范围 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                日期范围
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>开始日期</Label>
                  <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束日期</Label>
                  <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 已选项目 */}
          {(selectedMetrics.length > 0 || selectedDimensions.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>已选择</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedMetrics.map(id => {
                    const metric = availableMetrics.find(m => m.id === id)
                    return (
                      <Badge key={id} variant="secondary" className="gap-1">
                        📊 {metric?.name}
                        <button
                          onClick={() => toggleMetric(id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                  {selectedDimensions.map(id => {
                    const dimension = availableDimensions.find(d => d.id === id)
                    return (
                      <Badge key={id} variant="outline" className="gap-1">
                        🔷 {dimension?.name}
                        <button
                          onClick={() => toggleDimension(id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 生成按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setSelectedMetrics([])
              setSelectedDimensions([])
              setDateRange({ start: '', end: '' })
            }}>
              重置
            </Button>
            <Button onClick={handleGenerateReport} disabled={generating}>
              {generating ? '生成中...' : '生成报表'}
            </Button>
          </div>
        </TabsContent>

        {/* 报表预览 */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>报表预览</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {selectedMetrics.map(id => {
                      const metric = availableMetrics.find(m => m.id === id)
                      return (
                        <div key={id} className="p-4 border rounded-lg">
                          <div className="text-sm text-muted-foreground">{metric?.name}</div>
                          <div className="text-2xl font-bold mt-1">
                            {Math.round(Math.random() * 1000)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <Separator />
                  
                  {/* 模拟图表 */}
                  <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>图表区域 - 根据选择的维度和指标动态生成</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>请先配置报表并点击"生成报表"按钮</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 导出报表 */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>导出报表</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground">选择导出格式:</p>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleExportReport('excel')}
                    >
                      <div className="text-2xl">📊</div>
                      <span>Excel (.xlsx)</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleExportReport('pdf')}
                    >
                      <div className="text-2xl">📄</div>
                      <span>PDF (.pdf)</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col items-center justify-center gap-2"
                      onClick={() => handleExportReport('csv')}
                    >
                      <div className="text-2xl">📋</div>
                      <span>CSV (.csv)</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>请先生成报表后再导出</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
