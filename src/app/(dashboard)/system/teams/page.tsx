'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Search, Users2 } from 'lucide-react'

type Resp = {
  code: number
  message: string
  data?: {
    list: Record<string, unknown>[]
    total: number
    page: number
    pageSize: number
  }
}

export default function TeamsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    keyword: '',
  })

  const fetchData = async (forcePage?: number) => {
    setLoading(true)
    setError('')
    try {
      const currentPage = forcePage ?? page
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
      })
      if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim())
      const res = await fetch(`/api/local/teams?${params.toString()}`)
      const json: Resp = await res.json()
      if (!res.ok || json.code !== 200 || !json.data) throw new Error(json.message || '加载失败')
      setRows(json.data.list || [])
      setTotal(json.data.total || 0)
      setPage(currentPage)
    } catch (e) {
      setRows([])
      setTotal(0)
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // 每5分钟自动同步数据
    const interval = setInterval(() => {
      fetchData(page)
    }, 5 * 60 * 1000)
    
    // 清理定时器
    return () => clearInterval(interval)
  }, [pageSize, page])

  const cols = useMemo(
    () =>
      rows.reduce<string[]>((acc, row) => {
        Object.keys(row).forEach((k) => {
          if (!acc.includes(k)) acc.push(k)
        })
        return acc
      }, []),
    [rows]
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Users2 className="h-8 w-8" />
          外呼团队
        </h1>
        <p className="text-gray-500 mt-1">本地累计数据视图（每5分钟自动同步）</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>查询条件</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="text-sm font-medium mb-2 block">团队名称/关键字</label>
            <Input
              value={filters.keyword}
              onChange={(e) => setFilters((p) => ({ ...p, keyword: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => fetchData(1)}>
              <Search className="h-4 w-4 mr-2" />
              查询
            </Button>
            <Button variant="outline" onClick={() => fetchData(page)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>团队列表</CardTitle>
          <CardDescription>{loading ? '加载中...' : `共 ${total} 条`}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={Math.max(cols.length, 1)} className="text-center py-10 text-gray-500">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, idx) => (
                    <TableRow key={String(row.teamKey || idx)}>
                      {cols.map((c) => (
                        <TableCell key={`${String(row.teamKey || idx)}-${c}`}>
                          {row[c] === null || row[c] === undefined || row[c] === ''
                            ? '-'
                            : String(row[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex items-center gap-2">
              <select
                className="px-2 py-1 border rounded"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => fetchData(page - 1)}>
                上一页
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => fetchData(page + 1)}>
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
