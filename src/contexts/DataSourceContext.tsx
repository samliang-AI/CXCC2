// 数据源上下文 - 用于在页面间共享数据状态
'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

import { isRealDataOnly } from '@/lib/data-source-config'

// 数据源类型
export interface DataSource {
  id: number
  name: string
  filename: string
  size: string
  date: string
  records: number
  status: string
  fileData?: {
    previewRows: Record<string, string>[]
    allRows?: Record<string, string>[]  // 全部数据，用于前端统计
    columns: string[]
    actualRecords: number
    filepath?: string
  }
}

// 上下文类型
interface DataSourceContextType {
  dataSources: DataSource[]
  addDataSource: (data: Omit<DataSource, 'id' | 'records'> & { fileData?: DataSource['fileData'] }) => void
  updateDataSource: (name: string, data: Partial<DataSource>) => void
  getDataSource: (name: string) => DataSource | undefined
  clearAllDataSources: () => void
}

// 创建上下文
const DataSourceContext = createContext<DataSourceContextType | undefined>(undefined)

// Provider 组件
export function DataSourceProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 初始化数据
  const [dataSources, setDataSources] = useState<DataSource[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('uploadedDataSources')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('解析保存的数据失败:', e)
        }
      }
    }
    // 默认空数组
    return []
  })

  // 数据变化时保存到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uploadedDataSources', JSON.stringify(dataSources))
    }
  }, [dataSources])

  const addDataSource = useCallback((data: Omit<DataSource, 'id' | 'records'> & { fileData?: DataSource['fileData'] }) => {
    setDataSources(prev => {
      const newId = prev.length > 0 ? Math.max(...prev.map(d => d.id)) + 1 : 1
      const actualRecords =
        data.fileData?.actualRecords ?? (isRealDataOnly() ? 0 : Math.floor(Math.random() * 5000) + 1000)
      const newDataSource: DataSource = {
        ...data,
        id: newId,
        records: actualRecords,
        fileData: data.fileData
      }
      return [...prev, newDataSource]
    })
  }, [])

  const updateDataSource = useCallback((name: string, data: Partial<DataSource>) => {
    setDataSources(prev => prev.map(source =>
      source.name === name ? { ...source, ...data } : source
    ))
  }, [])

  const getDataSource = useCallback((name: string) => {
    return dataSources.find(source => source.name === name)
  }, [dataSources])

  const clearAllDataSources = useCallback(() => {
    setDataSources([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('uploadedDataSources')
    }
  }, [])

  return (
    <DataSourceContext.Provider value={{ dataSources, addDataSource, updateDataSource, getDataSource, clearAllDataSources }}>
      {children}
    </DataSourceContext.Provider>
  )
}

// 自定义 Hook
export function useDataSource() {
  const context = useContext(DataSourceContext)
  if (context === undefined) {
    throw new Error('useDataSource 必须在 DataSourceProvider 内使用')
  }
  return context
}
