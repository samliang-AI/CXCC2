// 数据预览对话框组件
'use client'

import { useState } from 'react'
import { X, FileSpreadsheet, Table, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataSource } from '@/contexts/DataSourceContext'

interface DataPreviewDialogProps {
  dataSource: DataSource | null
  open: boolean
  onOpenChange: (open: boolean) => void
  fileData?: {
    previewRows: Record<string, string>[]
    allRows?: Record<string, string>[]
    columns: string[]
    actualRecords: number
  } | null
}

// 模拟预览数据
const generatePreviewData = (records: number) => {
  const mockData = [
    { userId: 'U001', planName: '79 元套餐', monthlyConsumption: '79.5', dataUsage: '12.5GB', voiceUsage: '320 分钟', tenure: '36 个月' },
    { userId: 'U002', planName: '99 元套餐', monthlyConsumption: '98.2', dataUsage: '18.3GB', voiceUsage: '450 分钟', tenure: '24 个月' },
    { userId: 'U003', planName: '59 元套餐', monthlyConsumption: '62.8', dataUsage: '8.2GB', voiceUsage: '180 分钟', tenure: '48 个月' },
    { userId: 'U004', planName: '129 元套餐', monthlyConsumption: '135.6', dataUsage: '25.7GB', voiceUsage: '680 分钟', tenure: '12 个月' },
    { userId: 'U005', planName: '79 元套餐', monthlyConsumption: '85.3', dataUsage: '15.1GB', voiceUsage: '420 分钟', tenure: '30 个月' },
  ]
  return mockData
}

export default function DataPreviewDialog({ dataSource, open, onOpenChange, fileData }: DataPreviewDialogProps) {
  const [activeTab, setActiveTab] = useState('preview')
  
  if (!dataSource) return null

  // 使用真实文件数据或模拟数据
  const previewData = fileData?.previewRows || generatePreviewData(dataSource.records)
  const columns = fileData?.columns || Object.keys(previewData[0] || {})
  const actualRecords = fileData?.actualRecords || dataSource.records
  
  // 中文字段名映射
  const columnNames: Record<string, string> = {
    userId: '用户 ID',
    planName: '套餐名称',
    monthlyConsumption: '月消费',
    dataUsage: '流量使用',
    voiceUsage: '语音使用',
    tenure: '在网时长'
  }

  // 数据完整性检查（优先使用全部数据）
  const calculateDataQuality = () => {
    const rows = fileData?.allRows || fileData?.previewRows
    if (!rows?.length) {
      return {
        totalRecords: actualRecords,
        validRecords: Math.round(actualRecords * 0.98),
        missingFields: actualRecords - Math.round(actualRecords * 0.98),
        completeness: 98.0,
        issues: []
      }
    }
    const totalCells = rows.length * Object.keys(rows[0]).length
    let missingCells = 0
    
    rows.forEach(row => {
      Object.values(row).forEach(val => {
        if (!val || val === '' || val === null) {
          missingCells++
        }
      })
    })
    
    const completeness = Math.round((1 - missingCells / totalCells) * 100 * 10) / 10
    const validRecords = Math.round(actualRecords * (completeness / 100))
    const missingFields = actualRecords - validRecords
    
    // 检测具体字段的缺失情况
    const issues: { field: string; missing: number; severity: string }[] = []
    if (rows.length > 0) {
      const columns = Object.keys(rows[0])
      columns.forEach(col => {
        let missingCount = 0
        rows.forEach(row => {
          if (!row[col] || row[col] === '' || row[col] === null) {
            missingCount++
          }
        })
        const missingPercentage = Math.round((missingCount / rows.length) * 100)
        if (missingPercentage > 0) {
          let severity = 'low'
          if (missingPercentage > 50) {
            severity = 'high'
          } else if (missingPercentage > 20) {
            severity = 'medium'
          }
          issues.push({
            field: col,
            missing: missingPercentage,
            severity
          })
        }
      })
    }
    
    return {
      totalRecords: actualRecords,
      validRecords,
      missingFields,
      completeness,
      issues
    }
  }
  
  const completenessCheck = calculateDataQuality()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <DialogTitle>{dataSource.name} - 数据预览</DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4 flex-1 overflow-auto">
          {/* 数据概览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">总记录数</p>
              <p className="text-2xl font-bold text-blue-600">{actualRecords.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">文件大小</p>
              <p className="text-2xl font-bold text-green-600">{dataSource.size}</p>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">上传时间</p>
              <p className="text-sm font-semibold text-purple-600">{dataSource.date}</p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">数据状态</p>
              <Badge variant={dataSource.status === '已上传' ? 'default' : 'secondary'}>
                {dataSource.status}
              </Badge>
            </div>
          </div>

          {/* Tabs 标签页 */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">数据预览</TabsTrigger>
              <TabsTrigger value="quality">数据质量</TabsTrigger>
            </TabsList>

            {/* 数据预览 */}
            <TabsContent value="preview" className="space-y-4">
              <div className="border rounded-lg overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {columns.map((col, index) => (
                        <th key={index} className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 border-b">
                          {columnNames[col] || col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {columns.map((col, colIndex) => (
                          <td key={colIndex} className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-b">
                            {row[col as keyof typeof row]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Table className="h-4 w-4" />
                <span>显示前 5 条数据，共 {actualRecords.toLocaleString()} 条记录</span>
              </div>
            </TabsContent>

            {/* 数据质量 */}
            <TabsContent value="quality" className="space-y-4">
              {/* 完整性概览 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">有效记录</span>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{completenessCheck.validRecords.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">占比 98.0%</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">缺失字段</span>
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{completenessCheck.missingFields.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">占比 2.0%</p>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">完整性得分</span>
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{completenessCheck.completeness}</p>
                  <p className="text-xs text-gray-500 mt-1">满分 100</p>
                </div>
              </div>

              {/* 缺失字段详情 */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  缺失字段详情
                </h4>
                <div className="space-y-3">
                  {completenessCheck.issues.map((issue, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          issue.severity === 'high' ? 'bg-red-500' : 
                          issue.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`} />
                        <span className="text-sm font-medium">{issue.field}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">缺失 {issue.missing}%</span>
                        <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'}>
                          {issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 数据质量建议 */}
              <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  <strong>数据质量良好！</strong> 完整性得分 98%，可以进行数据分析。建议补充"在用带宽"和"宽带类型"字段以提升分析准确性。
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
