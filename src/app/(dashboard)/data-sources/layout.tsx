// 数据来源模块布局
import { ReactNode } from 'react'
import { DataSourceProvider } from '@/contexts/DataSourceContext'

export default function DataSourcesLayout({ children }: { children: ReactNode }) {
  return (
    <DataSourceProvider>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据来源</h1>
        </div>
        {children}
      </div>
    </DataSourceProvider>
  )
}
