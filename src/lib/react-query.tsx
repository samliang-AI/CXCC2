// Next.js App Router: this file must be a Client Component because it
// renders `QueryClientProvider`.
'use client'

// React Query 配置和 hooks
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { dataSourceAPI, analysisAPI, customerAPI } from '@/lib/api'

// 创建 QueryClient 实例
const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 数据在窗口获得焦点时重新验证
        refetchOnWindowFocus: false,
        // 错误重试次数
        retry: 1,
        // 重试延迟
        retryDelay: 1000,
        // 数据保持时间（5 分钟）
        staleTime: 5 * 60 * 1000,
        // 缓存时间（30 分钟）
        gcTime: 30 * 60 * 1000,
      },
      mutations: {
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }

  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

// QueryClientProvider 包装器
export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// 数据源相关 hooks
export function useDataSources() {
  return useQuery({
    queryKey: ['data-sources'],
    queryFn: () => dataSourceAPI.listDataSources(),
  })
}

export function useUploadData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, dataName }: { file: File; dataName: string }) =>
      dataSourceAPI.uploadData(file, dataName),
    onSuccess: () => {
      // 上传成功后，使数据源列表失效
      queryClient.invalidateQueries({ queryKey: ['data-sources'] })
    },
  })
}

export function useDeleteDataSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => dataSourceAPI.deleteDataSource(id),
    onSuccess: () => {
      // 删除成功后，使数据源列表失效
      queryClient.invalidateQueries({ queryKey: ['data-sources'] })
    },
  })
}

// 数据分析相关 hooks
export function useAnalysis(dataSourceId: string) {
  return useQuery({
    queryKey: ['analysis', dataSourceId],
    queryFn: () => analysisAPI.quickAnalyze(dataSourceId),
    enabled: !!dataSourceId,
    staleTime: 5 * 60 * 1000, // 5 分钟
  })
}

export function useQuickAnalysis() {
  return useMutation({
    mutationFn: (filePath: string) => analysisAPI.quickAnalyze(filePath),
  })
}

// 客户明细相关 hooks
export function useCustomerSegment(
  segment: 'high' | 'medium' | 'low',
  dataSourceId: string,
  page: number = 1,
) {
  return useQuery({
    queryKey: ['customers', segment, dataSourceId, page],
    queryFn: () => customerAPI.getCustomerSegment(segment, dataSourceId, page, 10),
    enabled: !!dataSourceId,
    staleTime: 2 * 60 * 1000, // 2 分钟
  })
}

export function useCustomerDetail(customerId: string, dataSourceId: string) {
  return useQuery({
    queryKey: ['customer-detail', customerId, dataSourceId],
    queryFn: () => customerAPI.getCustomerDetail(customerId, dataSourceId),
    enabled: !!customerId && !!dataSourceId,
    staleTime: 5 * 60 * 1000, // 5 分钟
  })
}

// 健康检查 hook
export function useAPIHealth() {
  return useQuery({
    queryKey: ['api-health'],
    queryFn: async () => {
      const { checkAPIHealth } = await import('@/lib/api')
      return checkAPIHealth()
    },
    refetchInterval: 30 * 1000, // 30 秒检查一次
    retry: 0,
  })
}

