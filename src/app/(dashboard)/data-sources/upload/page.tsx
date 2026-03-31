// 数据上传页面
'use client'

import { useState, useEffect } from 'react'
import { FileSpreadsheet, Upload, Check, AlertCircle, RefreshCw, Download, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useDataSource } from '@/contexts/DataSourceContext'
import DataPreviewDialog from '@/components/DataPreviewDialog'
import { dataSourceAPI } from '@/lib/api'
import { parseFile } from '@/lib/fileParser'
import { toast } from 'sonner'

export default function UploadPage() {
  const [dataName, setDataName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [sourceType, setSourceType] = useState('excel')
  const [isClient, setIsClient] = useState(false)
  
  // 使用 Context 管理数据源
  const { dataSources, addDataSource, updateDataSource, clearAllDataSources } = useDataSource()
  
  // 预览对话框状态
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedDataSource, setSelectedDataSource] = useState<typeof dataSources[0] | null>(null)
  
  // 标记为客户端渲染
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // 将 Context 数据转换为显示格式
  const uploadedData = dataSources.map(source => ({
    id: source.id,
    name: source.name,
    filename: source.filename,
    size: source.size,
    date: source.date,
    status: source.status
  }))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploaded(false)
    }
  }

  const handleUpload = async () => {
    if (!file || !dataName) {
      toast.warning('请选择文件并输入数据名称')
      return
    }
    
    // 验证文件完整性
    const isValid = validateFile(file)
    if (!isValid) return

    setUploading(true)
    
    try {
      // 调用后端上传 API
      const uploadResult = await dataSourceAPI.uploadData(file, dataName)

      if (uploadResult.success) {
        const { filename, filepath, data_name, preview } = uploadResult.data
        
        // 解析文件内容获取预览数据
        const fileData = await parseFile(file)
        
        setUploading(false)
        setUploaded(true)
        
        // 修复：从 filepath 中提取文件名
        let storedFilepath = filepath
        if (storedFilepath && (storedFilepath.includes('/') || storedFilepath.includes('\\'))) {
          storedFilepath = storedFilepath.split('/').pop() || storedFilepath
          storedFilepath = storedFilepath.split('\\').pop() || storedFilepath
        }

        // 将新数据添加到 Context
        const now = new Date()
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        
        const sizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`
        
        // 检查是否已存在同名数据
        const existingSource = dataSources.find(source => source.name === dataName)
        
        if (existingSource) {
          // 更新已存在的数据
          updateDataSource(dataName, {
            filename: file.name,
            size: sizeStr,
            date: dateStr,
            status: '已更新',
            records: fileData.actualRecords,  // 更新记录数
            fileData: {
              ...fileData,
              filepath: storedFilepath  // 保存后端文件路径
            }
          })
        } else {
          // 添加新数据
          addDataSource({
            name: dataName,
            filename: file.name,
            size: sizeStr,
            date: dateStr,
            status: '已上传',
            fileData: {
              ...fileData,
              filepath: storedFilepath  // 保存后端文件路径
            }
          })
        }
        
        toast.success('文件上传成功！')
      } else {
        throw new Error(uploadResult.message || '上传失败')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'
      
      // 后端上传失败时，尝试本地解析并保存（降级方案）
      try {
        const fileData = await parseFile(file)
        
        const now = new Date()
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        
        const sizeStr = file.size > 1024 * 1024 
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
          : `${Math.round(file.size / 1024)} KB`
        
        const existingSource = dataSources.find(source => source.name === dataName)
        
        if (existingSource) {
          updateDataSource(dataName, {
            filename: file.name,
            size: sizeStr,
            date: dateStr,
            status: '已保存',
            records: fileData.actualRecords,
            fileData: fileData
          })
        } else {
          addDataSource({
            name: dataName,
            filename: file.name,
            size: sizeStr,
            date: dateStr,
            status: '已保存',
            fileData: fileData
          })
        }
        
        setUploaded(true)
        toast.info('数据已保存到本地，可正常使用。\n\n提示：后端服务未连接，如需后端分析等功能，请确保 Python 后端已启动（端口 8000）。')
      } catch (parseError) {
        toast.error(`上传失败: ${errorMsg}\n\n文件解析也失败，请检查文件格式是否正确。`)
      } finally {
        setUploading(false)
      }
    } finally {
      setUploading(false)
    }
  }

  // 文件完整性验证
  const validateFile = (file: File): boolean => {
    // 检查文件类型
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/json' // .json
    ]
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv|json)$/i)) {
      toast.error('不支持的文件格式！请上传 Excel (.xlsx/.xls)、CSV 或 JSON 文件。')
      return false
    }
    
    // 检查文件大小 (最大 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('文件过大！文件大小不能超过 50MB。')
      return false
    }
    
    // 检查文件名
    if (file.name.length > 100) {
      toast.error('文件名过长！请 shorten 文件名。')
      return false
    }
    
    return true
  }

  // 打开预览对话框
  const handlePreview = (dataSource: typeof dataSources[0]) => {
    setSelectedDataSource(dataSource)
    setPreviewOpen(true)
  }

  // 渲染预览对话框时传递 fileData
  const renderPreviewDialog = () => {
    if (!selectedDataSource) return null
    
    return (
      <DataPreviewDialog
        dataSource={selectedDataSource}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        fileData={selectedDataSource.fileData || null}
      />
    )
  }

  const handleReupload = () => {
    setFile(null)
    setUploaded(false)
  }

  const handleClearAll = () => {
    if (confirm('确定要清除所有已上传的数据吗？此操作不可恢复。')) {
      clearAllDataSources()
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">数据上传</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="data-name">数据名称</Label>
              <Input 
                id="data-name" 
                value={dataName}
                onChange={(e) => setDataName(e.target.value)}
                placeholder="请输入数据名称"
              />
            </div>

            <div>
              <Label htmlFor="source-type">数据源类型</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择数据源类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel 文件</SelectItem>
                  <SelectItem value="csv">CSV 文件</SelectItem>
                  <SelectItem value="json">JSON 文件</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file-upload">选择文件</Label>
              <div className="mt-2">
                <Input 
                  id="file-upload" 
                  type="file" 
                  onChange={handleFileChange} 
                  accept=".xlsx,.csv,.json"
                />
              </div>
              {file && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{file.name}</span>
                    <span className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 space-y-2">
              <Button 
                onClick={handleUpload} 
                disabled={!file || !dataName || uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    上传中...
                  </>
                ) : uploaded ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    上传成功
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    开始上传
                  </>
                )}
              </Button>

              {uploaded && (
                <Button 
                  onClick={handleReupload}
                  variant="secondary"
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重新上传
                </Button>
              )}
            </div>

            {uploaded && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-md">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>文件上传成功！新数据已覆盖旧数据。</span>
                </div>
              </div>
            )}

            {!dataName && (
              <div className="mt-2 p-3 bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>请输入数据名称</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">已上传数据</h3>
            {isClient && uploadedData.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearAll}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                清除所有数据
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {!isClient || uploadedData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无已上传的数据</p>
                <p className="text-sm mt-1">请先上传数据文件</p>
              </div>
            ) : (
              uploadedData.map((item) => {
                const dataSource = dataSources.find(ds => ds.id === item.id)
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">{item.filename} · {item.date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{item.size}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => dataSource && handlePreview(dataSource)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <Separator className="my-4" />
          <p className="text-sm text-gray-500">
            注意：新上传的数据会自动覆盖同名的旧数据。点击"清除所有数据"可删除全部数据。
          </p>
        </CardContent>
      </Card>

      {/* 数据预览对话框 */}
      {isClient && renderPreviewDialog()}
    </div>
  )
}
