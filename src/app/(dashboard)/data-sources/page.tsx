// 数据来源主页面
import Link from 'next/link'
import { Database, FileSpreadsheet, BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function DataSourcesPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">数据上传</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">上传和管理数据源文件</p>
              </div>
            </div>
            <div className="mt-4">
              <Link 
                href="/data-sources/upload" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                进入
                <span className="text-sm">→</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">数据分析</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">分析和可视化数据</p>
              </div>
            </div>
            <div className="mt-4">
              <Link 
                href="/data-sources/analysis" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                进入
                <span className="text-sm">→</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">数据源管理</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span>系统数据源</span>
              </div>
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">已连接</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span>外部数据源</span>
              </div>
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">待配置</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
