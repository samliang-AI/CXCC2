// API 服务层 - 通过 Next.js 代理连接 Python 后端，避免跨域
const API_BASE_URL = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:8000'

// 数据源 API
export const dataSourceAPI = {
  // 获取所有数据源（带缓存）
  async listDataSources() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/data-sources`, {
        next: {
          tags: ['data-sources'],
          revalidate: 60 // 60 秒重新验证
        }
      })
      
      if (!response.ok) throw new Error('获取数据源失败')
      return response.json()
    } catch (error) {
      console.error('❌ 获取数据源失败:', error)
      throw error
    }
  },

  // 上传数据
  async uploadData(file: File, dataName: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('data_name', dataName)

    console.log('📤 开始上传文件:', file.name, '大小:', file.size)
    console.log('📤 数据名称:', dataName)
    console.log('📤 上传 URL:', `${API_BASE_URL}/api/upload`)
    console.log('📤 网络状态:', typeof navigator !== 'undefined' && navigator.onLine ? '在线' : '离线')

    try {
      console.log('📤 正在发送请求...')
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'include'
      })

      console.log('📥 上传响应状态:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('📥 上传失败响应:', errorText)
        try {
          const error = JSON.parse(errorText)
          throw new Error(error.detail || '上传失败')
        } catch (e) {
          throw new Error(`上传失败：${errorText}`)
        }
      }

      const result = await response.json()
      console.log('📥 上传成功响应:', result)
      
      return result
    } catch (error) {
      console.error('❌ 上传错误:', error)
      console.error('❌ 错误类型:', typeof error)
      console.error('❌ 错误信息:', error)
      console.error('❌ 错误堆栈:', error)
      throw new Error(`上传失败：${String(error) || '网络连接错误'}`)
    }
  },

  // 删除数据源
  async deleteDataSource(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/data-sources/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) throw new Error('删除失败')
    
    return response.json()
  }
}

// 数据分析 API
export const analysisAPI = {
  // 执行分析（带缓存）
  async analyze(dataSourceId: string, analysisType: 'full' | 'quick' | 'custom' = 'full', customMetrics?: string[]) {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data_source_id: dataSourceId,
        analysis_type: analysisType,
        custom_metrics: customMetrics
      }),
      next: {
        tags: [`analysis-${dataSourceId}`],
        revalidate: 300 // 5 分钟重新验证
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '分析失败')
    }

    return response.json()
  },

  // 获取分析状态
  async getAnalysisStatus(analysisId: string) {
    const response = await fetch(`${API_BASE_URL}/api/analyze/${analysisId}/status`, {
      next: {
        revalidate: 10 // 10 秒重新验证
      }
    })
    if (!response.ok) throw new Error('获取状态失败')
    return response.json()
  },

  // 一键分析 (简化版)
  async quickAnalyze(filePath: string) {
    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data_source_id: filePath,
        analysis_type: 'full'
      }),
      next: {
        tags: [`analysis-${filePath}`],
        revalidate: 300
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '分析失败')
    }

    const result = await response.json()
    return result.data
  }
}

// 机器学习预测 API
export const predictAPI = {
  // 客户意向预测
  async predictCustomerIntent(customerData: any) {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_data: customerData,
        model_type: 'intent'
      })
    })

    if (!response.ok) throw new Error('预测失败')
    return response.json()
  },

  // 转化率预测
  async predictConversion(customerData: any) {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_data: customerData,
        model_type: 'conversion'
      })
    })

    if (!response.ok) throw new Error('预测失败')
    return response.json()
  }
}

// 客户明细 API
export const customerAPI = {
  // 获取指定分层的客户明细（带缓存和分页）
  async getCustomerSegment(
    segment: 'high' | 'medium' | 'low',
    dataSourceId: string,
    page: number = 1,
    pageSize: number = 10
  ) {
    console.log('📤 调用 getCustomerSegment:', {
      segment,
      dataSourceId,
      page,
      pageSize
    })
    
    const params = new URLSearchParams({
      data_source_id: dataSourceId,
      page: page.toString(),
      page_size: pageSize.toString()
    })
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/segment/${segment}?${params}`, {
        next: {
          tags: [`customers-${segment}-${dataSourceId}`],
          revalidate: 60 // 60 秒重新验证
        }
      })
      
      console.log('📥 响应状态:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('📥 错误响应:', errorText)
        try {
          const error = JSON.parse(errorText)
          throw new Error(error.detail || '获取客户明细失败')
        } catch (e) {
          throw new Error(`获取客户明细失败：${errorText}`)
        }
      }
      
      const result = await response.json()
      console.log('📥 成功响应:', result)
      return result
    } catch (error) {
      console.error('❌ 调用 getCustomerSegment 错误:', error)
      throw error
    }
  },

  // 获取单个客户详情（带缓存）
  async getCustomerDetail(customerId: string, dataSourceId: string) {
    const params = new URLSearchParams({
      data_source_id: dataSourceId
    })
    
    const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}?${params}`, {
      next: {
        tags: [`customer-${customerId}-${dataSourceId}`],
        revalidate: 300 // 5 分钟重新验证
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '获取客户详情失败')
    }
    
    return response.json()
  }
}

// 自定义报表 API
export const customReportAPI = {
  // 生成自定义报表
  async generateCustomReport(metrics: string[], dimensions: string[], filters?: any, dateRange?: { start: string; end: string }) {
    const response = await fetch(`${API_BASE_URL}/api/custom-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        metrics,
        dimensions,
        filters,
        date_range: dateRange
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '生成报表失败')
    }

    return response.json()
  },

  // 导出报表 - 暂时禁用，需要重新实现
  // async exportReport(reportId: string, format: 'pdf' | 'excel' | 'csv' = 'excel') {
  //   const response = await fetch(`${API_BASE_URL}/api/reports?type=${reportId}&format=${format}`)
  //   
  //   if (!response.ok) throw new Error('导出失败')
  //   
  //   return response.blob()
  // }
}

// WebSocket 实时数据服务
export class RealtimeDataService {
  private ws: WebSocket | null = null
  private clientId: string
  private onMessageCallback: ((data: any) => void) | null = null
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(clientId: string) {
    this.clientId = clientId
  }

  // 连接 WebSocket
  connect() {
    const wsUrl = `ws://localhost:8000/ws/realtime/${this.clientId}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('✅ WebSocket 已连接')
      // 自动订阅
      this.subscribe()
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (this.onMessageCallback) {
        this.onMessageCallback(data)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error)
    }

    this.ws.onclose = () => {
      console.log('❌ WebSocket 已断开，尝试重连...')
      // 5 秒后重连
      this.reconnectTimer = setTimeout(() => this.connect(), 5000)
    }

    return this
  }

  // 订阅实时数据
  subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('subscribe')
    }
  }

  // 取消订阅
  unsubscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('unsubscribe')
    }
  }

  // 设置消息回调
  onMessage(callback: (data: any) => void) {
    this.onMessageCallback = callback
    return this
  }

  // 断开连接
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

// 健康检查
export async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      next: {
        revalidate: 30 // 30 秒重新验证
      }
    })
    if (!response.ok) throw new Error('健康检查失败')
    return response.json()
  } catch (error) {
    console.error('API 健康检查失败:', error)
    return null
  }
}
