// 客户明细组件 - 支持流式传输
'use client'

import { useState, useEffect } from 'react'
import { customerAPI } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface CustomerDetailsProps {
  segment: 'high' | 'medium' | 'low'
  dataSourceId: string
  initialPage?: number
}

export function CustomerDetails({ segment, dataSourceId, initialPage = 1 }: CustomerDetailsProps) {
  const [customers, setCustomers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [segmentArpu, setSegmentArpu] = useState<number | null>(null)

  useEffect(() => {
    const loadCustomers = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const result = await customerAPI.getCustomerSegment(segment, dataSourceId, page, 10)
        
        if (result.success) {
          setCustomers(result.data.customers)
          setTotal(result.data.total)
          setTotalPages(result.data.total_pages)
          setSegmentArpu(result.data.segment_arpu)
        }
      } catch (err) {
        console.error('加载客户明细失败:', err)
        setError('无法加载客户数据')
      } finally {
        setIsLoading(false)
      }
    }

    loadCustomers()
  }, [segment, dataSourceId, page])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-semibold">
                {segment === 'high' ? '高价值客户' : segment === 'medium' ? '中等价值客户' : '低价值客户'}
              </h3>
              <p className="text-sm text-gray-500">
                共 {total} 位客户 | ARPU: ¥{segmentArpu?.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <span className="text-sm text-gray-500">
              第 {page} 页 / 共 {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>客户 ID</TableHead>
              <TableHead>月均消费</TableHead>
              <TableHead>推荐套餐</TableHead>
              <TableHead>升档意向</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer: any) => (
              <TableRow key={customer.id}>
                <TableCell className="font-mono text-sm">{customer.id}</TableCell>
                <TableCell>¥{customer.月均消费?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{customer.推荐套餐}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600" 
                          style={{ width: `${customer.升档意向}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">{customer.升档意向?.toFixed(1)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {customer.月均消费 >= 100 ? (
                    <Badge className="bg-green-100 text-green-700">活跃</Badge>
                  ) : (
                    <Badge variant="secondary">普通</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {customers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>暂无客户数据</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
