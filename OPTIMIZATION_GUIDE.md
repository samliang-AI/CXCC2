# 优化后快速使用指南

## 🚀 快速开始

### 1. 启动所有服务

```bash
# 方式一：使用并发启动（推荐）
pnpm dev:all

# 方式二：分别启动
# 终端 1 - 前端
pnpm dev

# 终端 2 - Python 后端
pnpm dev:backend
```

### 2. 访问应用

- **前端**: http://localhost:3001
- **Python 后端 API**: http://127.0.0.1:8000
- **API 文档**: http://127.0.0.1:8000/docs

## 📦 新增功能使用

### 使用 React Query Hooks

#### 1. 获取数据源列表

```typescript
import { useDataSources } from '@/lib/react-query'

function DataSourceList() {
  const { data, isLoading, error } = useDataSources()
  
  if (isLoading) return <div>加载中...</div>
  if (error) return <div>加载失败</div>
  
  return (
    <ul>
      {data.data.map(ds => (
        <li key={ds.id}>{ds.name}</li>
      ))}
    </ul>
  )
}
```

#### 2. 上传数据

```typescript
import { useUploadData } from '@/lib/react-query'

function UploadButton() {
  const uploadData = useUploadData()
  
  const handleUpload = async (file: File, dataName: string) => {
    try {
      const result = await uploadData.mutateAsync({ file, dataName })
      console.log('上传成功:', result)
    } catch (error) {
      console.error('上传失败:', error)
    }
  }
  
  return (
    <Button
      onClick={() => handleUpload(file, dataName)}
      disabled={uploadData.isPending}
    >
      {uploadData.isPending ? '上传中...' : '上传'}
    </Button>
  )
}
```

#### 3. 获取分析数据

```typescript
import { useAnalysis } from '@/lib/react-query'

function AnalysisPanel({ dataSourceId }: { dataSourceId: string }) {
  const { data, isLoading, error } = useAnalysis(dataSourceId)
  
  if (isLoading) return <AnalysisSkeleton />
  if (error) return <div>加载分析数据失败</div>
  
  return <AnalysisData data={data} />
}
```

#### 4. 获取客户分层数据

```typescript
import { useCustomerSegment } from '@/lib/react-query'

function CustomerSegment({ segment, dataSourceId }: { 
  segment: 'high' | 'medium' | 'low'
  dataSourceId: string
}) {
  const { data, isLoading, error } = useCustomerSegment(segment, dataSourceId, 1)
  
  if (isLoading) return <CustomerSkeleton />
  if (error) return <div>加载失败</div>
  
  return <CustomerList customers={data.data.customers} />
}
```

### 使用缓存组件

#### 服务端组件中使用缓存

```typescript
// app/page.tsx (Server Component)
import { dataSourceAPI } from '@/lib/api'

export default async function HomePage() {
  // 自动缓存，基于 next.config 配置
  const dataSources = await dataSourceAPI.listDataSources()
  
  return (
    <div>
      <h1>数据源列表</h1>
      <DataSourceList data={dataSources} />
    </div>
  )
}
```

#### 添加 Suspense 边界

```typescript
// app/analysis/[id]/page.tsx
import { Suspense } from 'react'
import { AnalysisSkeleton } from '@/components/analysis/AnalysisSkeleton'
import { CustomerDetails } from '@/components/analysis/CustomerDetails'

export default async function AnalysisPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>数据分析</h1>
      
      {/* 静态内容 - 立即渲染 */}
      <Header />
      
      {/* 缓存内容 - 从缓存加载 */}
      <Suspense fallback={<AnalysisSkeleton />}>
        <AnalysisData id={params.id} />
      </Suspense>
      
      {/* 动态内容 - 流式加载 */}
      <Suspense fallback={<CustomerSkeleton />}>
        <CustomerDetails segment="high" dataSourceId={params.id} />
      </Suspense>
    </div>
  )
}
```

## 🔧 配置说明

### 缓存配置

所有缓存配置都在 `next.config.ts` 中：

```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,  // 启用 Cache Components
  experimental: {
    ppr: true,  // 启用 Partial Prerendering
  },
}
```

### API 缓存策略

在 `src/lib/api.ts` 中配置：

```typescript
// 数据源列表 - 60 秒重新验证
fetch('/api/data-sources', {
  next: {
    tags: ['data-sources'],
    revalidate: 60
  }
})

// 分析数据 - 5 分钟重新验证
fetch('/api/analyze', {
  next: {
    tags: [`analysis-${dataSourceId}`],
    revalidate: 300
  }
})
```

### React Query 配置

在 `src/lib/react-query.ts` 中配置：

```typescript
const makeQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,  // 5 分钟
        gcTime: 30 * 60 * 1000,    // 30 分钟
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}
```

## 📊 性能监控

### 开发环境

1. 打开浏览器开发者工具
2. 查看 Network 面板
3. 观察缓存命中情况
4. 检查请求的 `x-nextjs-cache` 头

### 生产环境

查看 `PERFORMANCE_OPTIMIZATION.md` 了解详细的监控指标和方法。

## 🐛 常见问题

### Q: 数据没有缓存？

A: 检查以下几点：
1. 确认 `next.config.ts` 中启用了 `cacheComponents`
2. 检查 API 调用是否包含 `next` 配置
3. 查看控制台是否有缓存相关的警告

### Q: React Query 数据不更新？

A: 尝试以下方法：
1. 手动刷新：`queryClient.invalidateQueries({ queryKey: ['data-sources'] })`
2. 检查 `staleTime` 配置是否过长
3. 确认 mutation 成功后调用了失效逻辑

### Q: 骨架屏不显示？

A: 确保：
1. 组件被 `<Suspense>` 包裹
2. Suspense 有正确的 `fallback` 属性
3. 异步组件使用了 `async/await`

### Q: 缓存何时失效？

A: 缓存在以下情况失效：
1. 达到 `revalidate` 时间
2. 调用 `revalidateTag()` 或 `updateTag()`
3. 手动调用 `queryClient.invalidateQueries()`
4. 部署新版本

## 📚 进阶使用

### 自定义缓存策略

```typescript
// 为不同数据类型设置不同缓存时间
cacheLife({
  stale: 60,      // 1 分钟 - 客户端缓存有效期
  revalidate: 300, // 5 分钟 - 开始后台刷新
  expire: 3600,   // 1 小时 - 绝对过期时间
})
```

### 预加载数据

```typescript
// 在用户点击前预加载
import { prefetchQuery } from '@tanstack/react-query'

function DataSourceItem({ id }) {
  const queryClient = useQueryClient()
  
  const handleMouseEnter = () => {
    prefetchQuery({
      queryKey: ['analysis', id],
      queryFn: () => analysisAPI.quickAnalyze(id)
    })
  }
  
  return (
    <div onMouseEnter={handleMouseEnter}>
      {/* ... */}
    </div>
  )
}
```

### 乐观更新

```typescript
// 立即更新 UI，稍后同步
const deleteDataSource = useMutation({
  mutationFn: (id: string) => dataSourceAPI.deleteDataSource(id),
  onMutate: async (id) => {
    // 取消当前查询
    await queryClient.cancelQueries({ queryKey: ['data-sources'] })
    
    // 保存之前的数据
    const previousData = queryClient.getQueryData(['data-sources'])
    
    // 乐观更新
    queryClient.setQueryData(['data-sources'], (old) => ({
      ...old,
      data: old.data.filter(ds => ds.id !== id)
    }))
    
    return { previousData }
  },
  onError: (err, id, context) => {
    // 错误时回滚
    queryClient.setQueryData(['data-sources'], context.previousData)
  }
})
```

## 🎯 下一步

1. **阅读完整文档**: `PERFORMANCE_OPTIMIZATION.md`
2. **学习 Next.js 缓存**: https://nextjs.org/docs/app/building-your-application/caching
3. **掌握 React Query**: https://tanstack.com/query/latest/docs/react/overview
4. **优化你的组件**: 参考本文档中的最佳实践

---

**提示**: 如有任何问题，请查看控制台日志或联系开发团队。
